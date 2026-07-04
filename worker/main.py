from __future__ import annotations

import base64
import io
import os
from functools import lru_cache
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image


FrameRate = Literal["5s", "2s", "1fps", "2fps"]
PersonLocation = Literal["floor", "bed", "sofa", "chair", "unknown"]
PersonPosture = Literal["lying", "sitting", "standing", "unknown"]
Movement = Literal["none", "small", "active", "unknown"]
FaceExpression = Literal["negative", "neutral", "unknown"]


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
    confidence: float = Field(default=0, ge=0, le=100)
    evidence: str = ""


@app.get("/health")
def health() -> dict[str, Any]:
    mode = worker_mode()
    return {
        "ok": True,
        "mode": mode,
        "model": os.getenv("YOLO_MODEL", "yolov8n-pose.pt"),
        "yoloAvailable": yolo_available(),
    }


@app.post("/infer-frame", response_model=InferFrameResponse)
def infer_frame(payload: InferFrameRequest, authorization: str | None = Header(default=None)) -> InferFrameResponse:
    require_worker_secret(authorization)

    image = decode_image(payload.imageBase64)
    blood_detected = detect_blood_like_region(image)
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
        return InferFrameResponse(
            roomId=payload.roomId,
            capturedAt=payload.capturedAt,
            frameRate=payload.frameRate,
            bloodDetected=blood_detected,
            confidence=78 if blood_detected else 45,
            evidence="YOLO pose did not find a confident person.",
        )

    posture = estimate_posture(person["box"], person["keypoints"])
    location = estimate_location(person["box"], image.height, posture)
    movement = "unknown"
    confidence = float(round(person["confidence"] * 100, 1))
    evidence = f"YOLO pose estimated {posture} posture at {location}."

    return InferFrameResponse(
        roomId=payload.roomId,
        capturedAt=payload.capturedAt,
        frameRate=payload.frameRate,
        personLocation=location,
        personPosture=posture,
        movement=movement,
        faceExpression="unknown",
        bloodDetected=blood_detected,
        confidence=confidence,
        evidence=evidence,
    )


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
    if keypoints is not None and keypoints.xy is not None:
        pose_points = keypoints.xy[best_index].tolist()

    return {
        "box": xyxy,
        "keypoints": pose_points,
        "confidence": best_confidence,
    }


def estimate_posture(box: list[float], keypoints: list[list[float]]) -> PersonPosture:
    x1, y1, x2, y2 = box
    width = max(1.0, x2 - x1)
    height = max(1.0, y2 - y1)
    aspect = width / height

    if aspect > 1.25:
        return "lying"

    shoulder_hip_angle = torso_angle_degrees(keypoints)
    if shoulder_hip_angle is not None:
        if shoulder_hip_angle < 35:
            return "lying"
        if shoulder_hip_angle > 62:
            return "standing"

    if height > width * 1.6:
        return "standing"
    return "sitting"


def estimate_location(box: list[float], image_height: int, posture: PersonPosture) -> PersonLocation:
    _, _, _, y2 = box
    bottom_ratio = y2 / max(1, image_height)
    if posture == "lying" and bottom_ratio > 0.62:
        return "floor"
    return "unknown"


def torso_angle_degrees(keypoints: list[list[float]]) -> float | None:
    # COCO pose indexes: shoulders 5/6, hips 11/12.
    if len(keypoints) < 13:
        return None

    left_shoulder, right_shoulder = keypoints[5], keypoints[6]
    left_hip, right_hip = keypoints[11], keypoints[12]
    shoulder = midpoint(left_shoulder, right_shoulder)
    hip = midpoint(left_hip, right_hip)
    if not shoulder or not hip:
        return None

    dx = abs(shoulder[0] - hip[0])
    dy = abs(shoulder[1] - hip[1])
    if dx == 0 and dy == 0:
        return None
    return float(np.degrees(np.arctan2(dy, dx)))


def midpoint(a: list[float], b: list[float]) -> tuple[float, float] | None:
    if len(a) < 2 or len(b) < 2:
        return None
    if (a[0] == 0 and a[1] == 0) or (b[0] == 0 and b[1] == 0):
        return None
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
