from __future__ import annotations

import base64
import io
import os
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw
from dotenv import load_dotenv


worker_dir = Path(__file__).resolve().parent
load_dotenv(worker_dir.parent / ".env")
load_dotenv(worker_dir / ".env", override=True)


FrameRate = Literal["5s", "2s", "1fps", "2fps"]
PersonLocation = Literal["floor", "bed", "sofa", "chair", "unknown"]
PersonPosture = Literal["lying", "sitting", "standing", "unknown"]
Movement = Literal["none", "small", "active", "unknown"]
FaceExpression = Literal["negative", "neutral", "unknown"]
FallStage = Literal["none", "candidate", "confirmed"]


app = FastAPI(title="CareGuard Demo Inference Worker")


class InferFrameRequest(BaseModel):
    roomId: str
    capturedAt: str
    frameRate: FrameRate
    imageBase64: str
    callbackUrl: str | None = None


class InferFrameResponse(BaseModel):
    roomId: str
    capturedAt: str
    frameRate: FrameRate
    personLocation: PersonLocation = "unknown"
    personPosture: PersonPosture = "unknown"
    movement: Movement = "unknown"
    faceExpression: FaceExpression = "unknown"
    bloodDetected: bool = False
    fallStage: FallStage = "none"
    fallDetected: bool = False
    fallConfidence: float = Field(default=0, ge=0, le=100)
    confidence: float = Field(default=0, ge=0, le=100)
    evidence: str = ""
    annotatedImageBase64: str | None = None


@dataclass
class PoseObservation:
    captured_at: datetime
    posture: PersonPosture
    torso_angle: float | None
    torso_center_y: float
    body_center_y: float
    normalized_keypoints: list[tuple[float, float] | None]
    confidence: float


@dataclass
class RoomMotionState:
    previous: PoseObservation | None = None
    candidate_at: datetime | None = None
    candidate_confidence: float = 0
    confirmed_at: datetime | None = None
    last_seen_at: datetime | None = None


@dataclass
class TemporalResult:
    movement: Movement = "unknown"
    fall_stage: FallStage = "none"
    fall_detected: bool = False
    fall_confidence: float = 0
    evidence: str = ""


room_motion_states: dict[str, RoomMotionState] = {}
room_motion_states_lock = threading.Lock()


@app.get("/health")
def health() -> dict[str, Any]:
    mode = worker_mode()
    return {
        "ok": True,
        "mode": mode,
        "model": os.getenv("YOLO_MODEL", "yolov8n-pose.pt"),
        "showYoloBoxes": show_yolo_boxes(),
        "bloodDetectionEnabled": blood_detection_enabled(),
        "fallDetectionEnabled": fall_detection_enabled(),
        "fallDetectionNote": "Rapid fall transitions require 1 fps or 2 fps capture.",
        "yoloAvailable": yolo_available(),
    }


@app.post("/infer-frame", response_model=InferFrameResponse)
def infer_frame(payload: InferFrameRequest, authorization: str | None = Header(default=None)) -> InferFrameResponse:
    require_worker_secret(authorization)

    image = decode_image(payload.imageBase64)
    blood_detected = blood_detection_enabled() and detect_blood_like_region(image)
    mode = worker_mode()

    if mode == "mock" or (mode == "auto" and not yolo_available()):
        return mock_response(payload, blood_detected)

    if mode == "yolo" and not yolo_available():
        raise HTTPException(status_code=503, detail="Ultralytics YOLO is not installed or could not be loaded.")

    try:
        return yolo_response(payload, image, blood_detected)
    except Exception as exc:
        if mode == "yolo":
            raise HTTPException(status_code=500, detail=f"YOLO inference failed: {exc}") from exc
        return mock_response(payload, blood_detected)


def require_worker_secret(authorization: str | None) -> None:
    expected = os.getenv("DEMO_WORKER_SECRET")
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid worker secret.")


def worker_mode() -> str:
    mode = os.getenv("WORKER_MODE", "auto").strip().lower()
    return mode if mode in {"auto", "mock", "yolo"} else "auto"


def show_yolo_boxes() -> bool:
    return os.getenv("SHOW_YOLO_BOXES", "false").strip().lower() in {"1", "true", "yes", "on"}


def blood_detection_enabled() -> bool:
    return os.getenv("ENABLE_BLOOD_DETECTION", "false").strip().lower() in {"1", "true", "yes", "on"}


def fall_detection_enabled() -> bool:
    return os.getenv("ENABLE_FALL_DETECTION", "true").strip().lower() in {"1", "true", "yes", "on"}


def decode_image(image_base64: str) -> Image.Image:
    raw = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
    try:
        data = base64.b64decode(raw, validate=True)
        image = Image.open(io.BytesIO(data))
        return image.convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="imageBase64 is not a valid image.") from exc


def detect_blood_like_region(image: Image.Image) -> bool:
    arr = np.asarray(image.resize((160, 120)))
    red = arr[:, :, 0].astype(np.int16)
    green = arr[:, :, 1].astype(np.int16)
    blue = arr[:, :, 2].astype(np.int16)
    red_mask = (red > 115) & (red > green * 1.45) & (red > blue * 1.45) & (green < 110)
    return bool(red_mask.mean() > 0.015)


def mock_response(payload: InferFrameRequest, blood_detected: bool) -> InferFrameResponse:
    scenario = os.getenv("DEMO_SCENARIO", "empty").strip().lower()
    base = {
        "roomId": payload.roomId,
        "capturedAt": payload.capturedAt,
        "frameRate": payload.frameRate,
    }

    if blood_detected or scenario == "blood":
        return InferFrameResponse(
            **base,
            personLocation="floor",
            personPosture="lying",
            movement="none",
            faceExpression="unknown",
            bloodDetected=True,
            confidence=82,
            evidence="Mock worker detected a blood-like red region.",
        )

    scenarios: dict[str, dict[str, Any]] = {
        "fall": {
            "personLocation": "unknown",
            "personPosture": "lying",
            "movement": "active",
            "faceExpression": "unknown",
            "bloodDetected": False,
            "fallStage": "confirmed",
            "fallDetected": True,
            "fallConfidence": 91,
            "confidence": 91,
            "evidence": "Mock worker: rapid upright-to-lying transition confirmed as a fall.",
        },
        "floor_suspicious": {
            "personLocation": "floor",
            "personPosture": "lying",
            "movement": "none",
            "faceExpression": "neutral",
            "bloodDetected": False,
            "confidence": 76,
            "evidence": "Mock worker: person lying on floor.",
        },
        "floor_danger": {
            "personLocation": "floor",
            "personPosture": "lying",
            "movement": "small",
            "faceExpression": "negative",
            "bloodDetected": False,
            "confidence": 88,
            "evidence": "Mock worker: person lying on floor with movement and negative expression.",
        },
        "bed_occupied": {
            "personLocation": "bed",
            "personPosture": "lying",
            "movement": "small",
            "faceExpression": "neutral",
            "bloodDetected": False,
            "confidence": 81,
            "evidence": "Mock worker: person lying on bed.",
        },
        "empty": {
            "personLocation": "unknown",
            "personPosture": "unknown",
            "movement": "unknown",
            "faceExpression": "unknown",
            "bloodDetected": False,
            "confidence": 55,
            "evidence": "Mock worker: no person detected.",
        },
    }

    return InferFrameResponse(**base, **scenarios.get(scenario, scenarios["empty"]))


@lru_cache(maxsize=1)
def load_yolo_model() -> Any:
    from ultralytics import YOLO

    return YOLO(os.getenv("YOLO_MODEL", "yolov8n-pose.pt"))


def yolo_available() -> bool:
    try:
        load_yolo_model()
        return True
    except Exception:
        return False


def yolo_response(payload: InferFrameRequest, image: Image.Image, blood_detected: bool) -> InferFrameResponse:
    model = load_yolo_model()
    results = model.predict(np.asarray(image), verbose=False)
    result = results[0] if results else None
    person = best_person_pose(result)

    if not person:
        temporal = temporal_no_person(payload.roomId, payload.capturedAt)
        annotated_image = annotated_image_base64(result, fall_label(temporal)) if show_yolo_boxes() else None
        return InferFrameResponse(
            roomId=payload.roomId,
            capturedAt=payload.capturedAt,
            frameRate=payload.frameRate,
            bloodDetected=blood_detected,
            fallStage=temporal.fall_stage,
            fallDetected=temporal.fall_detected,
            fallConfidence=temporal.fall_confidence,
            confidence=78 if blood_detected else 45,
            evidence=temporal.evidence or "YOLO pose did not find a confident person.",
            annotatedImageBase64=annotated_image,
        )

    posture = estimate_posture(person["box"], person["keypoints"], person["keypoint_confidences"])
    temporal = analyze_temporal_pose(
        room_id=payload.roomId,
        captured_at=payload.capturedAt,
        frame_rate=payload.frameRate,
        image_size=image.size,
        person=person,
        posture=posture,
    )
    confidence = float(round(person["confidence"] * 100, 1))
    evidence = temporal.evidence or f"YOLO pose estimated {posture} posture."
    annotated_image = annotated_image_base64(result, fall_label(temporal)) if show_yolo_boxes() else None

    return InferFrameResponse(
        roomId=payload.roomId,
        capturedAt=payload.capturedAt,
        frameRate=payload.frameRate,
        personLocation="unknown",
        personPosture=posture,
        movement=temporal.movement,
        faceExpression="unknown",
        bloodDetected=blood_detected,
        fallStage=temporal.fall_stage,
        fallDetected=temporal.fall_detected,
        fallConfidence=temporal.fall_confidence,
        confidence=confidence,
        evidence=evidence,
        annotatedImageBase64=annotated_image,
    )


def annotated_image_base64(result: Any, label: str = "") -> str | None:
    if result is None:
        return None
    try:
        plotted = result.plot()
        image = Image.fromarray(plotted[:, :, ::-1])
        if label:
            draw = ImageDraw.Draw(image)
            text_box = draw.textbbox((0, 0), label)
            text_width = text_box[2] - text_box[0]
            text_height = text_box[3] - text_box[1]
            color = (185, 28, 28) if "CONFIRMED" in label else (180, 83, 9)
            draw.rectangle((8, 8, 24 + text_width, 22 + text_height), fill=color)
            draw.text((16, 13), label, fill=(255, 255, 255))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=72)
        return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:
        return None


def best_person_pose(result: Any) -> dict[str, Any] | None:
    if result is None or result.boxes is None or len(result.boxes) == 0:
        return None

    boxes = result.boxes
    keypoints = getattr(result, "keypoints", None)
    best_index = None
    best_confidence = 0.0

    for idx, box in enumerate(boxes):
        cls = int(box.cls[0]) if box.cls is not None else 0
        confidence = float(box.conf[0]) if box.conf is not None else 0
        if cls == 0 and confidence > best_confidence:
            best_index = idx
            best_confidence = confidence

    if best_index is None:
        return None

    xyxy = boxes[best_index].xyxy[0].tolist()
    pose_points: list[list[float]] = []
    pose_confidences: list[float] = []
    if keypoints is not None and keypoints.xy is not None:
        pose_points = keypoints.xy[best_index].tolist()
        if getattr(keypoints, "conf", None) is not None:
            pose_confidences = keypoints.conf[best_index].tolist()

    return {
        "box": xyxy,
        "keypoints": pose_points,
        "keypoint_confidences": pose_confidences,
        "confidence": best_confidence,
    }


def estimate_posture(
    box: list[float],
    keypoints: list[list[float]],
    keypoint_confidences: list[float] | None = None,
) -> PersonPosture:
    x1, y1, x2, y2 = box
    width = max(1.0, x2 - x1)
    height = max(1.0, y2 - y1)
    aspect = width / height

    shoulder_hip_angle = torso_angle_degrees(keypoints, keypoint_confidences)
    if shoulder_hip_angle is not None:
        if shoulder_hip_angle < 32:
            return "lying"
        if shoulder_hip_angle < 52:
            return "sitting"
        knee_angle = average_knee_angle_degrees(keypoints, keypoint_confidences)
        return "sitting" if knee_angle is not None and knee_angle < 135 else "standing"

    if height > width * 1.35:
        return "standing"
    if aspect > 1.55:
        return "lying"
    return "sitting"


def torso_angle_degrees(
    keypoints: list[list[float]],
    keypoint_confidences: list[float] | None = None,
) -> float | None:
    # COCO pose indexes: shoulders 5/6, hips 11/12.
    if len(keypoints) < 13:
        return None

    left_shoulder, right_shoulder = keypoints[5], keypoints[6]
    left_hip, right_hip = keypoints[11], keypoints[12]
    shoulder = midpoint(
        left_shoulder,
        right_shoulder,
        confidence_pair(keypoint_confidences, 5, 6),
    )
    hip = midpoint(
        left_hip,
        right_hip,
        confidence_pair(keypoint_confidences, 11, 12),
    )
    if not shoulder or not hip:
        return None

    dx = abs(shoulder[0] - hip[0])
    dy = abs(shoulder[1] - hip[1])
    if dx == 0 and dy == 0:
        return None
    return float(np.degrees(np.arctan2(dy, dx)))


def midpoint(
    a: list[float],
    b: list[float],
    confidences: tuple[float, float] | None = None,
) -> tuple[float, float] | None:
    if len(a) < 2 or len(b) < 2:
        return None
    if confidences is not None and min(confidences) < 0.25:
        return None
    if (a[0] == 0 and a[1] == 0) or (b[0] == 0 and b[1] == 0):
        return None
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def confidence_pair(confidences: list[float] | None, first: int, second: int) -> tuple[float, float] | None:
    if not confidences or len(confidences) <= max(first, second):
        return None
    return (float(confidences[first]), float(confidences[second]))


def average_knee_angle_degrees(
    keypoints: list[list[float]],
    keypoint_confidences: list[float] | None = None,
) -> float | None:
    # COCO pose indexes: hips 11/12, knees 13/14, ankles 15/16.
    if len(keypoints) < 17:
        return None

    angles = [
        joint_angle_degrees(keypoints, keypoint_confidences, 11, 13, 15),
        joint_angle_degrees(keypoints, keypoint_confidences, 12, 14, 16),
    ]
    valid_angles = [angle for angle in angles if angle is not None]
    return float(np.mean(valid_angles)) if valid_angles else None


def joint_angle_degrees(
    keypoints: list[list[float]],
    confidences: list[float] | None,
    first: int,
    vertex: int,
    third: int,
) -> float | None:
    points = [keypoints[first], keypoints[vertex], keypoints[third]]
    if any(len(point) < 2 or (point[0] == 0 and point[1] == 0) for point in points):
        return None
    if confidences and len(confidences) > max(first, vertex, third):
        if min(float(confidences[index]) for index in (first, vertex, third)) < 0.25:
            return None

    vector_a = np.asarray(points[0], dtype=np.float32) - np.asarray(points[1], dtype=np.float32)
    vector_b = np.asarray(points[2], dtype=np.float32) - np.asarray(points[1], dtype=np.float32)
    denominator = float(np.linalg.norm(vector_a) * np.linalg.norm(vector_b))
    if denominator <= 1e-6:
        return None
    cosine = float(np.clip(np.dot(vector_a, vector_b) / denominator, -1, 1))
    return float(np.degrees(np.arccos(cosine)))


def analyze_temporal_pose(
    room_id: str,
    captured_at: str,
    frame_rate: FrameRate,
    image_size: tuple[int, int],
    person: dict[str, Any],
    posture: PersonPosture,
) -> TemporalResult:
    observed_at = parse_captured_at(captured_at)
    observation = make_pose_observation(observed_at, image_size, person, posture)

    with room_motion_states_lock:
        prune_room_motion_states(observed_at)
        state = room_motion_states.setdefault(room_id, RoomMotionState())
        previous = state.previous
        movement = estimate_movement(previous, observation)
        result = TemporalResult(movement=movement)

        if not fall_detection_enabled():
            state.previous = observation
            state.last_seen_at = observed_at
            state.candidate_at = None
            state.confirmed_at = None
            return result

        confirmation_window = max(2.5, min(8.0, frame_interval_seconds(frame_rate) * 2.5))

        if state.confirmed_at is not None:
            confirmed_age = seconds_between(state.confirmed_at, observed_at)
            if posture == "lying" and 0 <= confirmed_age <= 30:
                result.fall_stage = "confirmed"
                result.fall_detected = True
                result.fall_confidence = state.candidate_confidence
                result.evidence = "Fall remains confirmed: person is still in a lying posture."
            elif posture in {"standing", "sitting"} or confirmed_age > 30:
                state.confirmed_at = None
                state.candidate_at = None

        if result.fall_stage == "none" and state.candidate_at is not None:
            candidate_age = seconds_between(state.candidate_at, observed_at)
            if posture == "lying" and 0 < candidate_age <= confirmation_window:
                state.confirmed_at = observed_at
                result.fall_stage = "confirmed"
                result.fall_detected = True
                result.fall_confidence = max(70, state.candidate_confidence)
                result.evidence = (
                    "Fall confirmed across consecutive frames after a rapid upright-to-lying transition."
                )
            elif posture in {"standing", "sitting"} or candidate_age > confirmation_window:
                state.candidate_at = None
                state.candidate_confidence = 0

        if result.fall_stage == "none":
            candidate_confidence = fall_candidate_confidence(previous, observation, movement)
            if candidate_confidence >= 60:
                state.candidate_at = observed_at
                state.candidate_confidence = candidate_confidence
                result.fall_stage = "candidate"
                result.fall_confidence = candidate_confidence
                result.evidence = (
                    "Possible fall: rapid upright-to-lying pose transition detected; awaiting the next frame."
                )

        state.previous = observation
        state.last_seen_at = observed_at
        return result


def temporal_no_person(room_id: str, captured_at: str) -> TemporalResult:
    observed_at = parse_captured_at(captured_at)
    with room_motion_states_lock:
        prune_room_motion_states(observed_at)
        state = room_motion_states.setdefault(room_id, RoomMotionState())

        if state.confirmed_at is not None:
            age = seconds_between(state.confirmed_at, observed_at)
            if 0 <= age <= 10:
                return TemporalResult(
                    fall_stage="confirmed",
                    fall_detected=True,
                    fall_confidence=state.candidate_confidence,
                    evidence="Fall was just confirmed, but the person is no longer confidently visible.",
                )
            if age > 10:
                state.confirmed_at = None
                state.candidate_at = None
                state.candidate_confidence = 0

        if state.candidate_at is not None:
            age = seconds_between(state.candidate_at, observed_at)
            if 0 <= age <= 4:
                return TemporalResult(
                    fall_stage="candidate",
                    fall_confidence=max(45, state.candidate_confidence - 15),
                    evidence="Possible fall transition detected, but the person is not visible enough to confirm it.",
                )
            state.candidate_at = None
            state.candidate_confidence = 0

        return TemporalResult()


def make_pose_observation(
    captured_at: datetime,
    image_size: tuple[int, int],
    person: dict[str, Any],
    posture: PersonPosture,
) -> PoseObservation:
    image_width, image_height = image_size
    box = person["box"]
    keypoints = person["keypoints"]
    confidences = person.get("keypoint_confidences") or []
    torso_angle = torso_angle_degrees(keypoints, confidences)
    torso_center = pose_torso_center(keypoints, confidences)

    x1, y1, x2, y2 = box
    body_center_y = ((y1 + y2) / 2) / max(1, image_height)
    torso_center_y = (
        torso_center[1] / max(1, image_height)
        if torso_center is not None
        else body_center_y
    )

    normalized_keypoints: list[tuple[float, float] | None] = []
    for index, point in enumerate(keypoints):
        confidence = float(confidences[index]) if index < len(confidences) else 1
        if len(point) < 2 or (point[0] == 0 and point[1] == 0) or confidence < 0.25:
            normalized_keypoints.append(None)
        else:
            normalized_keypoints.append(
                (float(point[0]) / max(1, image_width), float(point[1]) / max(1, image_height))
            )

    return PoseObservation(
        captured_at=captured_at,
        posture=posture,
        torso_angle=torso_angle,
        torso_center_y=torso_center_y,
        body_center_y=body_center_y,
        normalized_keypoints=normalized_keypoints,
        confidence=float(person["confidence"]),
    )


def pose_torso_center(
    keypoints: list[list[float]],
    confidences: list[float] | None,
) -> tuple[float, float] | None:
    if len(keypoints) < 13:
        return None
    shoulder = midpoint(keypoints[5], keypoints[6], confidence_pair(confidences, 5, 6))
    hip = midpoint(keypoints[11], keypoints[12], confidence_pair(confidences, 11, 12))
    if shoulder is None or hip is None:
        return shoulder or hip
    return ((shoulder[0] + hip[0]) / 2, (shoulder[1] + hip[1]) / 2)


def estimate_movement(previous: PoseObservation | None, current: PoseObservation) -> Movement:
    if previous is None:
        return "unknown"
    elapsed = seconds_between(previous.captured_at, current.captured_at)
    if elapsed <= 0 or elapsed > 10:
        return "unknown"

    distances = []
    for old_point, new_point in zip(previous.normalized_keypoints, current.normalized_keypoints):
        if old_point is None or new_point is None:
            continue
        distances.append(float(np.hypot(new_point[0] - old_point[0], new_point[1] - old_point[1])))

    if len(distances) < 4:
        center_speed = abs(current.body_center_y - previous.body_center_y) / elapsed
        speed = center_speed
    else:
        speed = float(np.median(distances)) / elapsed

    if speed < 0.012:
        return "none"
    if speed < 0.075:
        return "small"
    return "active"


def fall_candidate_confidence(
    previous: PoseObservation | None,
    current: PoseObservation,
    movement: Movement,
) -> float:
    if previous is None or current.posture != "lying" or previous.posture not in {"standing", "sitting"}:
        return 0

    elapsed = seconds_between(previous.captured_at, current.captured_at)
    if elapsed <= 0 or elapsed > 2.5:
        return 0

    previous_angle = previous.torso_angle
    current_angle = current.torso_angle
    if previous_angle is None or current_angle is None:
        return 0

    angle_change = max(0, previous_angle - current_angle)
    torso_drop = max(0, current.torso_center_y - previous.torso_center_y)
    body_drop = max(0, current.body_center_y - previous.body_center_y)
    vertical_speed = max(torso_drop, body_drop) / elapsed
    angular_speed = angle_change / elapsed

    if angle_change < 28 or movement != "active":
        return 0
    if vertical_speed < 0.035 and angular_speed < 35:
        return 0

    posture_score = 24 if previous.posture == "standing" else 16
    angle_score = min(28, angle_change / 55 * 28)
    drop_score = min(28, vertical_speed / 0.18 * 28)
    confidence_score = min(previous.confidence, current.confidence) * 20
    return float(round(min(99, posture_score + angle_score + drop_score + confidence_score), 1))


def parse_captured_at(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def seconds_between(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds()


def frame_interval_seconds(frame_rate: FrameRate) -> float:
    return {"5s": 5, "2s": 2, "1fps": 1, "2fps": 0.5}[frame_rate]


def prune_room_motion_states(now: datetime) -> None:
    stale_room_ids = [
        room_id
        for room_id, state in room_motion_states.items()
        if state.last_seen_at is not None and seconds_between(state.last_seen_at, now) > 3600
    ]
    for room_id in stale_room_ids:
        del room_motion_states[room_id]


def fall_label(result: TemporalResult) -> str:
    if result.fall_stage == "confirmed":
        return f"FALL CONFIRMED {result.fall_confidence:.0f}%"
    if result.fall_stage == "candidate":
        return f"POSSIBLE FALL {result.fall_confidence:.0f}%"
    return ""
