export const MAX_DEVICE_FRAME_BYTES = 1024 * 1024;
export const DEVICE_FRAME_RATE = "2fps" as const;
export const DEFAULT_CAPTURE_INTERVAL_MS = 500;

export type DeviceState = {
  id: string;
  room_id: string | null;
  device_uid: string;
  device_type: string;
  status: string;
  firmware_version: string | null;
  capture_interval_ms: number | null;
  configured_at: string | null;
  last_frame_at: string | null;
};

export function findDeviceByUid(devices: DeviceState[], deviceUid: string) {
  return devices.find((device) => device.device_uid === deviceUid) ?? null;
}

export function frameExceedsLimit(byteLength: number) {
  return byteLength > MAX_DEVICE_FRAME_BYTES;
}

export function mapWorkerErrorStatus(status: number) {
  if (status === 400 || status === 415 || status === 422) return 422;
  if (status === 503) return 503;
  return 502;
}

export function validateJpegContentType(contentType: string | null) {
  return contentType?.split(";", 1)[0].trim().toLowerCase() === "image/jpeg";
}

export function validateJpegBytes(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}

export function deviceStateError(device: DeviceState): { status: number; error: string } | null {
  if (device.device_type !== "room_camera") {
    return { status: 422, error: "This endpoint accepts room camera devices only." };
  }
  if (!device.room_id || device.status === "unassigned") {
    return { status: 409, error: "Device is not assigned to a room." };
  }
  if (device.status === "maintenance") {
    return { status: 423, error: "Device is in maintenance mode." };
  }
  return null;
}

export function cadenceWaitMs(device: DeviceState, now: Date) {
  if (!device.last_frame_at) return 0;
  const lastFrameAt = new Date(device.last_frame_at).getTime();
  if (!Number.isFinite(lastFrameAt)) return 0;
  const interval = Math.max(DEFAULT_CAPTURE_INTERVAL_MS, device.capture_interval_ms ?? DEFAULT_CAPTURE_INTERVAL_MS);
  return Math.max(0, interval - (now.getTime() - lastFrameAt));
}

export function safeFirmwareVersion(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9._+-]{1,32}$/.test(trimmed) ? trimmed : null;
}
