import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { generateDeviceToken, hashDeviceToken } from "@/lib/device-auth";
import { DEFAULT_CAPTURE_INTERVAL_MS, deviceStatusFromHeartbeat } from "@/lib/device-ingestion";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

type ProvisionPayload = {
  roomId?: unknown;
  deviceUid?: unknown;
};

const CAMERA_PROFILE = "esp32s3_cam_common";
const FIRMWARE_VERSION = "0.1.2";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Admin provisioning is not configured." }, { status: 503 });
  }
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can provision or rotate device credentials." }, { status: 403 });
  }

  let payload: ProvisionPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON body is required." }, { status: 400 });
  }
  const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
  const deviceUid = typeof payload.deviceUid === "string" ? payload.deviceUid.trim().toUpperCase() : "";
  if (!roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(deviceUid)) {
    return NextResponse.json({ error: "deviceUid must be 3–64 letters, numbers, dashes, or underscores." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, home_id, name, type")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room was not found." }, { status: 404 });
  if (room.type !== "room") {
    return NextResponse.json({ error: "Shower ToF provisioning is not available in this iteration." }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("devices")
    .select("id, device_type")
    .eq("device_uid", deviceUid)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing && existing.device_type !== "room_camera") {
    return NextResponse.json({ error: "That device ID belongs to a non-camera device." }, { status: 409 });
  }

  const { error: replacedError } = await supabase
    .from("devices")
    .update({ status: "unassigned" })
    .eq("room_id", roomId)
    .eq("device_type", "room_camera")
    .neq("device_uid", deviceUid);
  if (replacedError) return NextResponse.json({ error: replacedError.message }, { status: 500 });

  let device: { id: string; device_uid: string };
  if (existing) {
    const { data, error } = await supabase
      .from("devices")
      .update({
        room_id: roomId,
        status: "offline",
        camera_profile: CAMERA_PROFILE,
        capture_interval_ms: DEFAULT_CAPTURE_INTERVAL_MS,
        configured_at: now,
        firmware_version: FIRMWARE_VERSION,
        hardware: "ESP32-S3-CAM · common pin profile",
        privacy: "Transient inference only; frames are not stored",
      })
      .eq("id", existing.id)
      .select("id, device_uid")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    device = data;
  } else {
    const { data, error } = await supabase
      .from("devices")
      .insert({
        room_id: roomId,
        device_uid: deviceUid,
        device_type: "room_camera",
        status: "offline",
        firmware_version: FIRMWARE_VERSION,
        camera_profile: CAMERA_PROFILE,
        capture_interval_ms: DEFAULT_CAPTURE_INTERVAL_MS,
        configured_at: now,
        heartbeat_label: "Awaiting first frame",
        signal_label: "No heartbeat",
        hardware: "ESP32-S3-CAM · common pin profile",
        privacy: "Transient inference only; frames are not stored",
      })
      .select("id, device_uid")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    device = data;
  }

  const token = generateDeviceToken();
  const { error: credentialError } = await supabase
    .from("device_credentials")
    .upsert({
      device_id: device.id,
      token_hash: hashDeviceToken(token),
      created_by: profile.id,
      rotated_at: now,
    }, { onConflict: "device_id" });
  if (credentialError) return NextResponse.json({ error: credentialError.message }, { status: 500 });

  await supabase.from("dashboard_audit_events").insert({
    actor_id: profile.id,
    action: "device_credential_rotated",
    home_id: room.home_id,
    room_id: room.id,
    details: { deviceUid: device.device_uid, cameraProfile: CAMERA_PROFILE },
  });

  return NextResponse.json(
    {
      ok: true,
      deviceToken: token,
      device: {
        id: device.device_uid,
        roomId: room.id,
        roomName: room.name,
        cameraProfile: CAMERA_PROFILE,
        captureIntervalMs: DEFAULT_CAPTURE_INTERVAL_MS,
        firmwareVersion: FIRMWARE_VERSION,
        status: "offline",
        configuredAt: now,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Device status is not configured." }, { status: 503 });
  }
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "caregiver") {
    return NextResponse.json({ error: "Approval required." }, { status: 403 });
  }
  const deviceUid = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceUid) return NextResponse.json({ error: "deviceId is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: device, error } = await supabase
    .from("devices")
    .select("id, room_id, device_uid, status, firmware_version, last_seen_at, camera_profile, capture_interval_ms, configured_at")
    .eq("device_uid", deviceUid)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!device) return NextResponse.json({ error: "Device was not found." }, { status: 404 });

  const { data: room } = await supabase
    .from("rooms")
    .select("id, home_id, name")
    .eq("id", device.room_id)
    .maybeSingle();
  const { data: home } = room
    ? await supabase.from("homes").select("senior_name, block_number, unit_number").eq("id", room.home_id).maybeSingle()
    : { data: null };
  const derivedStatus = deviceStatusFromHeartbeat(device.status, device.last_seen_at);

  return NextResponse.json({
    ok: true,
    device: {
      id: device.device_uid,
      roomId: room?.id ?? null,
      roomName: room?.name ?? "Unassigned",
      homeLabel: home ? `${home.senior_name} · Blk ${home.block_number}, #${home.unit_number}` : "",
      status: derivedStatus,
      firmwareVersion: device.firmware_version ?? "Unknown",
      cameraProfile: device.camera_profile ?? "Unknown",
      captureIntervalMs: device.capture_interval_ms,
      configuredAt: device.configured_at,
      lastSeenAt: device.last_seen_at,
    },
  }, { headers: { "cache-control": "no-store" } });
}
