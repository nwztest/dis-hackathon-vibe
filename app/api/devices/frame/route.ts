import { NextResponse, type NextRequest } from "next/server";
import { applyDemoInferenceResult } from "@/lib/demo-supabase";
import { bearerToken, matchesDeviceToken } from "@/lib/device-auth";
import {
  cadenceWaitMs,
  DEVICE_FRAME_RATE,
  deviceStateError,
  frameExceedsLimit,
  mapWorkerErrorStatus,
  safeFirmwareVersion,
  validateJpegBytes,
  validateJpegContentType,
  type DeviceState,
} from "@/lib/device-ingestion";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  demoWorkerSecret,
  hasSupabaseAdminEnv,
  inferenceWorkerUrl,
} from "@/lib/supabase/env";

export const runtime = "nodejs";

type CredentialRow = {
  device_id: string;
  token_hash: string;
};

export async function POST(request: NextRequest) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Device ingestion is not configured." }, { status: 503 });
  }
  if (!inferenceWorkerUrl) {
    return NextResponse.json({ error: "Inference worker is not configured." }, { status: 503 });
  }

  const deviceUid = request.headers.get("x-device-id")?.trim();
  const token = bearerToken(request.headers.get("authorization"));
  if (!deviceUid || !token) {
    return NextResponse.json({ error: "Device credentials are required." }, { status: 401 });
  }
  if (!validateJpegContentType(request.headers.get("content-type"))) {
    return NextResponse.json({ error: "Content-Type must be image/jpeg." }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && frameExceedsLimit(declaredLength)) {
    return NextResponse.json({ error: "JPEG exceeds the 1 MB limit." }, { status: 413 });
  }

  const supabase = createAdminClient();
  const { data: deviceData, error: deviceError } = await supabase
    .from("devices")
    .select("id, room_id, device_uid, device_type, status, firmware_version, capture_interval_ms, configured_at, last_frame_at")
    .eq("device_uid", deviceUid)
    .maybeSingle();
  const device = deviceData as DeviceState | null;

  if (deviceError || !device) {
    return NextResponse.json({ error: "Invalid device credentials." }, { status: 401 });
  }

  const { data: credentialData, error: credentialError } = await supabase
    .from("device_credentials")
    .select("device_id, token_hash")
    .eq("device_id", device.id)
    .maybeSingle();
  const credential = credentialData as CredentialRow | null;

  if (credentialError || !credential || !matchesDeviceToken(token, credential.token_hash)) {
    return NextResponse.json({ error: "Invalid device credentials." }, { status: 401 });
  }

  const stateError = deviceStateError(device);
  if (stateError) {
    return NextResponse.json({ error: stateError.error }, { status: stateError.status });
  }

  const now = new Date();
  const waitMs = cadenceWaitMs(device, now);
  if (waitMs > 0) {
    return NextResponse.json(
      { error: "Frame cadence exceeded.", retryAfterMs: waitMs },
      { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(waitMs / 1000))) } },
    );
  }

  let frameBuffer: ArrayBuffer;
  let bytes: Uint8Array;
  try {
    frameBuffer = await request.arrayBuffer();
    bytes = new Uint8Array(frameBuffer);
  } catch {
    return NextResponse.json({ error: "JPEG body could not be read." }, { status: 400 });
  }
  if (frameExceedsLimit(bytes.byteLength)) {
    return NextResponse.json({ error: "JPEG exceeds the 1 MB limit." }, { status: 413 });
  }
  if (!validateJpegBytes(bytes)) {
    return NextResponse.json({ error: "Body is not a valid JPEG." }, { status: 422 });
  }

  const capturedAt = now.toISOString();
  const reportedFirmware = safeFirmwareVersion(request.headers.get("x-firmware-version"));
  const { error: heartbeatError } = await supabase
    .from("devices")
    .update({
      status: "online",
      last_seen_at: capturedAt,
      last_frame_at: capturedAt,
      configured_at: device.configured_at ?? capturedAt,
      ...(reportedFirmware ? { firmware_version: reportedFirmware } : {}),
      heartbeat_label: "Just now",
      hardware: "ESP32-S3-CAM · VGA JPEG · 2 FPS target",
      privacy: "Transient inference only; frames are not stored",
    })
    .eq("id", device.id);
  if (heartbeatError) {
    return NextResponse.json({ error: "Device heartbeat could not be updated." }, { status: 500 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let workerResponse: Response;
  try {
    workerResponse = await fetch(`${inferenceWorkerUrl.replace(/\/$/, "")}/infer-frame-bytes`, {
      method: "POST",
      headers: {
        "content-type": "image/jpeg",
        "x-room-id": device.room_id!,
        "x-captured-at": capturedAt,
        "x-frame-rate": DEVICE_FRAME_RATE,
        ...(demoWorkerSecret ? { authorization: `Bearer ${demoWorkerSecret}` } : {}),
      },
      body: frameBuffer,
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "Inference worker timed out." : "Inference worker is unreachable." },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!workerResponse.ok) {
    const status = mapWorkerErrorStatus(workerResponse.status);
    return NextResponse.json(
      { error: status === 422 ? "Inference worker rejected the JPEG." : `Inference worker returned ${workerResponse.status}.` },
      { status },
    );
  }

  const inference = await workerResponse.json();
  try {
    const result = await applyDemoInferenceResult(
      supabase,
      {
        ...inference,
        roomId: device.room_id!,
        capturedAt,
        frameRate: DEVICE_FRAME_RATE,
      },
      { deviceDatabaseId: device.id },
    );
    return NextResponse.json({ ok: true, capturedAt, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inference result could not be applied." },
      { status: 500 },
    );
  }
}
