import assert from "node:assert/strict";
import test from "node:test";
import {
  bearerToken,
  generateDeviceToken,
  hashDeviceToken,
  matchesDeviceToken,
} from "../lib/device-auth.ts";
import {
  cadenceWaitMs,
  deviceStateError,
  findDeviceByUid,
  frameExceedsLimit,
  mapWorkerErrorStatus,
  MAX_DEVICE_FRAME_BYTES,
  validateJpegBytes,
  validateJpegContentType,
  type DeviceState,
} from "../lib/device-ingestion.ts";

const baseDevice: DeviceState = {
  id: "device-db-id",
  room_id: "room-id",
  device_uid: "CAM-TEST-1",
  device_type: "room_camera",
  status: "online",
  firmware_version: "0.1.0",
  capture_interval_ms: 500,
  configured_at: "2026-07-29T00:00:00Z",
  last_frame_at: null,
};

test("device tokens are random, hashed, and compared without accepting a wrong token", () => {
  const first = generateDeviceToken();
  const second = generateDeviceToken();
  assert.notEqual(first, second);
  assert.match(hashDeviceToken(first), /^[0-9a-f]{64}$/);
  assert.equal(matchesDeviceToken(first, hashDeviceToken(first)), true);
  assert.equal(matchesDeviceToken(second, hashDeviceToken(first)), false);
  assert.equal(matchesDeviceToken(first, "invalid"), false);
  assert.equal(bearerToken(`Bearer ${first}`), first);
  assert.equal(bearerToken("Basic no"), null);
});

test("device lookup uses the exact device UID", () => {
  assert.equal(findDeviceByUid([baseDevice], "CAM-TEST-1")?.id, "device-db-id");
  assert.equal(findDeviceByUid([baseDevice], "cam-test-1"), null);
});

test("content validation requires JPEG media type and JPEG markers", () => {
  assert.equal(validateJpegContentType("image/jpeg"), true);
  assert.equal(validateJpegContentType("image/jpeg; charset=binary"), true);
  assert.equal(validateJpegContentType("image/png"), false);
  assert.equal(validateJpegBytes(Uint8Array.from([0xff, 0xd8, 1, 2, 0xff, 0xd9])), true);
  assert.equal(validateJpegBytes(Uint8Array.from([0xff, 0xd8, 1, 2])), false);
});

test("the byte limit rejects only bodies larger than 1 MB", () => {
  assert.equal(frameExceedsLimit(MAX_DEVICE_FRAME_BYTES), false);
  assert.equal(frameExceedsLimit(MAX_DEVICE_FRAME_BYTES + 1), true);
});

test("unassigned, maintenance, and non-camera devices are explicitly rejected", () => {
  assert.equal(deviceStateError(baseDevice), null);
  assert.deepEqual(deviceStateError({ ...baseDevice, status: "unassigned" }), {
    status: 409, error: "Device is not assigned to a room.",
  });
  assert.deepEqual(deviceStateError({ ...baseDevice, status: "maintenance" }), {
    status: 423, error: "Device is in maintenance mode.",
  });
  assert.equal(deviceStateError({ ...baseDevice, device_type: "tof_shower" })?.status, 422);
});

test("cadence and worker errors map to explicit client responses", () => {
  const now = new Date("2026-07-29T00:00:00.300Z");
  assert.equal(cadenceWaitMs({ ...baseDevice, last_frame_at: "2026-07-29T00:00:00.000Z" }, now), 200);
  assert.equal(mapWorkerErrorStatus(400), 422);
  assert.equal(mapWorkerErrorStatus(422), 422);
  assert.equal(mapWorkerErrorStatus(503), 503);
  assert.equal(mapWorkerErrorStatus(500), 502);
});
