import type { RoomStatus } from "@/lib/mock-data";

export type DemoFrameRate = "5s" | "2s" | "1fps" | "2fps";
export type DemoPersonLocation = "floor" | "bed" | "sofa" | "chair" | "unknown";
export type DemoPersonPosture = "lying" | "sitting" | "standing" | "unknown";
export type DemoMovement = "none" | "small" | "active" | "unknown";
export type DemoFaceExpression = "negative" | "neutral" | "unknown";
export type DemoFallStage = "none" | "candidate" | "confirmed";

export type DemoInferenceInput = {
  roomId: string;
  capturedAt: string;
  frameRate: DemoFrameRate;
  personLocation?: DemoPersonLocation;
  personPosture?: DemoPersonPosture;
  movement?: DemoMovement;
  faceExpression?: DemoFaceExpression;
  bloodDetected?: boolean;
  fallStage?: DemoFallStage;
  fallDetected?: boolean;
  fallConfidence?: number;
  confidence?: number;
  evidence?: string;
  annotatedImageBase64?: string;
};

export type DemoRuleState = {
  currentStatus?: RoomStatus;
  lyingStartedAt?: string;
  floorLyingStartedAt?: string;
  negativeFloorStartedAt?: string;
  noMovementStartedAt?: string;
  statusStartedAt?: string;
};

export type DemoRuleDecision = {
  status: RoomStatus;
  occupied: boolean;
  reason: string;
  evidence: string;
  severity?: "suspicious" | "danger";
  metadata: Record<string, unknown>;
};

const floorDangerMs = 60_000;
const negativeFloorDangerMs = 10_000;
const noMovementDangerMs = 12 * 60 * 60 * 1000;

export const frameRateOptions: Array<{ value: DemoFrameRate; label: string; intervalMs: number }> = [
  { value: "5s", label: "Every 5 seconds", intervalMs: 5000 },
  { value: "2s", label: "Every 2 seconds", intervalMs: 2000 },
  { value: "1fps", label: "1 fps", intervalMs: 1000 },
  { value: "2fps", label: "2 fps", intervalMs: 500 },
];

export function frameRateIntervalMs(frameRate: DemoFrameRate) {
  return frameRateOptions.find((option) => option.value === frameRate)?.intervalMs ?? 5000;
}

export function isDemoFrameRate(value: unknown): value is DemoFrameRate {
  return typeof value === "string" && frameRateOptions.some((option) => option.value === value);
}

export function evaluateRoomCameraInference(input: DemoInferenceInput, previous: DemoRuleState = {}): DemoRuleDecision {
  const capturedAt = validDate(input.capturedAt) ?? new Date();
  const nowMs = capturedAt.getTime();
  const isLying = input.personPosture === "lying";
  const isOnFloor = input.personLocation === "floor";
  const isUnknownLocation = input.personLocation === "unknown" || !input.personLocation;
  const isRestingSurface = input.personLocation === "bed" || input.personLocation === "sofa" || input.personLocation === "chair";
  const hasDetectedPosture =
    input.personPosture === "lying" || input.personPosture === "sitting" || input.personPosture === "standing";
  const hasMovement = input.movement === "small" || input.movement === "active";
  const hasNoMovement = input.movement === "none";
  const lyingStartedAt = isLying && isUnknownLocation ? previous.lyingStartedAt ?? capturedAt.toISOString() : undefined;
  const floorLyingStartedAt = isLying && isOnFloor ? previous.floorLyingStartedAt ?? capturedAt.toISOString() : undefined;
  const negativeFloorStartedAt =
    isLying && isOnFloor && input.faceExpression === "negative"
      ? previous.negativeFloorStartedAt ?? capturedAt.toISOString()
      : undefined;
  const noMovementStartedAt =
    isLying && isRestingSurface && hasNoMovement ? previous.noMovementStartedAt ?? capturedAt.toISOString() : undefined;
  const lyingDurationMs = elapsedMs(lyingStartedAt, nowMs);
  const floorDurationMs = elapsedMs(floorLyingStartedAt, nowMs);
  const negativeFloorDurationMs = elapsedMs(negativeFloorStartedAt, nowMs);
  const noMovementDurationMs = elapsedMs(noMovementStartedAt, nowMs);

  let status: RoomStatus = "unoccupied";
  let severity: DemoRuleDecision["severity"];
  let reason = "no_person_detected";
  let evidence = input.evidence || "No person detected in the latest demo frame.";
  let occupied = false;

  if (input.bloodDetected) {
    status = "danger";
    severity = "danger";
    reason = "blood_detected";
    evidence = input.evidence || "Blood-like region detected in room camera frame.";
    occupied = true;
  } else if (input.fallDetected || input.fallStage === "confirmed") {
    status = "danger";
    severity = "danger";
    reason = "fall_detected";
    evidence = input.evidence || "A rapid upright-to-lying transition was confirmed across consecutive camera frames.";
    occupied = true;
  } else if (input.fallStage === "candidate") {
    status = "suspicious";
    severity = "suspicious";
    reason = "possible_fall_transition";
    evidence = input.evidence || "A possible fall transition was detected; awaiting confirmation from the next frame.";
    occupied = true;
  } else if (isLying && isOnFloor && hasMovement) {
    status = "danger";
    severity = "danger";
    reason = "lying_on_floor_with_movement";
    evidence = input.evidence || "Person is lying on the floor with visible movement.";
    occupied = true;
  } else if (isLying && isOnFloor && negativeFloorDurationMs >= negativeFloorDangerMs) {
    status = "danger";
    severity = "danger";
    reason = "lying_on_floor_negative_expression_more_than_10_seconds";
    evidence = input.evidence || "Person is lying on the floor with a negative expression for more than 10 seconds.";
    occupied = true;
  } else if (isLying && isOnFloor && floorDurationMs >= floorDangerMs) {
    status = "danger";
    severity = "danger";
    reason = "lying_on_floor_more_than_60_seconds";
    evidence = input.evidence || "Person is lying on the floor for more than 1 minute.";
    occupied = true;
  } else if (isLying && isOnFloor) {
    status = "suspicious";
    severity = "suspicious";
    reason = "lying_on_floor_watch";
    evidence = input.evidence || "Person is lying on the floor; waiting for danger threshold.";
    occupied = true;
  } else if (isLying && isUnknownLocation && lyingDurationMs >= floorDangerMs) {
    status = "danger";
    severity = "danger";
    reason = "lying_posture_more_than_60_seconds";
    evidence = "Person appears to be lying down for more than 1 minute; room location is not classified in this demo.";
    occupied = true;
  } else if (isLying && isUnknownLocation) {
    status = "suspicious";
    severity = "suspicious";
    reason = "lying_posture_watch";
    evidence = "Person appears to be lying down; room location is not classified in this demo.";
    occupied = true;
  } else if (isLying && isRestingSurface && noMovementDurationMs >= noMovementDangerMs) {
    status = "danger";
    severity = "danger";
    reason = "no_movement_on_bed_sofa_chair_more_than_12_hours";
    evidence = input.evidence || "Person is lying on a resting surface with no movement for more than 12 hours.";
    occupied = true;
  } else if (isLying && isRestingSurface) {
    status = "occupied";
    reason = "lying_on_bed_sofa_chair_occupied";
    evidence = input.evidence || `Person is lying on ${input.personLocation}.`;
    occupied = true;
  } else if (hasDetectedPosture) {
    status = "occupied";
    reason = "person_detected";
    evidence = input.evidence || `Person detected ${input.personPosture}.`;
    occupied = true;
  } else if (input.personLocation && input.personLocation !== "unknown") {
    status = "occupied";
    reason = "person_detected";
    evidence = input.evidence || "Person detected in room camera frame.";
    occupied = true;
  }

  const statusStartedAt = status === previous.currentStatus ? previous.statusStartedAt ?? capturedAt.toISOString() : capturedAt.toISOString();

  return {
    status,
    occupied,
    reason,
    evidence,
    severity,
    metadata: {
      demoMode: "laptop_camera",
      frameRate: input.frameRate,
      frameIntervalSeconds: frameRateIntervalMs(input.frameRate) / 1000,
      lastInferenceAt: capturedAt.toISOString(),
      currentStatus: status,
      lyingStartedAt,
      floorLyingStartedAt,
      negativeFloorStartedAt,
      noMovementStartedAt,
      statusStartedAt,
      personLocation: input.personLocation ?? "unknown",
      personPosture: input.personPosture ?? "unknown",
      movement: input.movement ?? "unknown",
      faceExpression: input.faceExpression ?? "unknown",
      bloodDetected: Boolean(input.bloodDetected),
      fallStage: input.fallStage ?? "none",
      fallDetected: Boolean(input.fallDetected),
      fallConfidence: input.fallConfidence,
      confidence: input.confidence,
      alertReason: reason,
      evidence,
    },
  };
}

export function previousRuleState(metadata: Record<string, unknown> | null | undefined): DemoRuleState {
  return {
    currentStatus: roomStatusValue(metadata, "currentStatus"),
    lyingStartedAt: stringValue(metadata, "lyingStartedAt"),
    floorLyingStartedAt: stringValue(metadata, "floorLyingStartedAt"),
    negativeFloorStartedAt: stringValue(metadata, "negativeFloorStartedAt"),
    noMovementStartedAt: stringValue(metadata, "noMovementStartedAt"),
    statusStartedAt: stringValue(metadata, "statusStartedAt"),
  };
}

function elapsedMs(start: string | undefined, nowMs: number) {
  if (!start) return 0;
  const startMs = Date.parse(start);
  return Number.isFinite(startMs) ? Math.max(0, nowMs - startMs) : 0;
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function stringValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function roomStatusValue(metadata: Record<string, unknown> | null | undefined, key: string): RoomStatus | undefined {
  const value = metadata?.[key];
  return value === "unoccupied" ||
    value === "occupied" ||
    value === "suspicious" ||
    value === "danger" ||
    value === "offline" ||
    value === "maintenance"
    ? value
    : undefined;
}
