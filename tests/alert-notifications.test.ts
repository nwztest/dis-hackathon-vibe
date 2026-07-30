import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueAlertNotification,
  hasPendingDangerAlert,
  notificationKey,
  removeAlertNotifications,
  seedAlertSnapshots,
  shouldShowAlertNotificationOnPath,
  shouldNotifyForAlertChange,
  snapshotFromAlertRecord,
  type AlertNotification,
} from "../lib/alert-notifications.ts";
import type { AlertRecord } from "../lib/mock-data.ts";

const suspiciousAlert: AlertRecord = {
  id: "alert-1",
  homeId: "home-1",
  roomId: "room-1",
  severity: "suspicious",
  status: "open",
  openedAt: "10:00",
  reason: "possible_fall_transition",
  confidence: 72,
  duration: "10 sec",
  evidence: "A possible fall transition was detected.",
};

function notification(
  overrides: Partial<AlertNotification> = {},
): AlertNotification {
  return {
    ...snapshotFromAlertRecord(suspiciousAlert),
    seniorName: "Test Senior",
    roomName: "Bedroom",
    ...overrides,
  };
}

test("initial active alerts seed state without creating notification queue entries", () => {
  const snapshots = seedAlertSnapshots([suspiciousAlert]);
  assert.equal(snapshots.size, 1);
  assert.equal(snapshots.get("alert-1")?.severity, "suspicious");
});

test("notifications are suppressed on the alerts page", () => {
  assert.equal(shouldShowAlertNotificationOnPath("/alerts"), false);
  assert.equal(shouldShowAlertNotificationOnPath("/dashboard"), true);
  assert.equal(shouldShowAlertNotificationOnPath("/rooms/room-1"), true);
});

test("new open alerts notify, while acknowledged and resolved inserts do not", () => {
  const open = snapshotFromAlertRecord(suspiciousAlert);
  assert.equal(shouldNotifyForAlertChange("INSERT", undefined, open), true);
  assert.equal(
    shouldNotifyForAlertChange("INSERT", undefined, { ...open, status: "acknowledged" }),
    false,
  );
  assert.equal(
    shouldNotifyForAlertChange("INSERT", undefined, { ...open, status: "resolved" }),
    false,
  );
});

test("only a suspicious-to-danger update creates an escalation notification", () => {
  const suspicious = snapshotFromAlertRecord(suspiciousAlert);
  const danger = { ...suspicious, severity: "danger" as const };
  assert.equal(shouldNotifyForAlertChange("UPDATE", suspicious, danger), true);
  assert.equal(shouldNotifyForAlertChange("UPDATE", danger, danger), false);
  assert.equal(
    shouldNotifyForAlertChange("UPDATE", suspicious, { ...danger, status: "acknowledged" }),
    false,
  );
});

test("notifications are deduplicated by alert and severity", () => {
  const item = notification();
  const queue = enqueueAlertNotification(enqueueAlertNotification([], item), item);
  assert.equal(queue.length, 1);
  assert.equal(notificationKey(queue[0]), "alert-1:suspicious");
});

test("danger notifications sort ahead of suspicious notifications", () => {
  const suspicious = notification({ id: "alert-suspicious" });
  const danger = notification({ id: "alert-danger", severity: "danger" });
  const queue = enqueueAlertNotification(
    enqueueAlertNotification([], suspicious),
    danger,
  );
  assert.deepEqual(queue.map((item) => item.id), ["alert-danger", "alert-suspicious"]);
});

test("danger escalation replaces the same alert's suspicious notification", () => {
  const suspicious = notification();
  const danger = notification({ severity: "danger" });
  const queue = enqueueAlertNotification(
    enqueueAlertNotification([], suspicious),
    danger,
  );
  assert.deepEqual(queue.map((item) => item.severity), ["danger"]);
});

test("dismissal or an external status change removes all queued severities", () => {
  const queue = [
    notification(),
    notification({ id: "alert-2", severity: "danger" }),
  ];
  assert.deepEqual(
    removeAlertNotifications(queue, "alert-1").map((item) => item.id),
    ["alert-2"],
  );
});

test("danger indicator remains for acknowledged alerts and clears on resolution", () => {
  const danger = {
    ...snapshotFromAlertRecord(suspiciousAlert),
    severity: "danger" as const,
    status: "acknowledged" as const,
  };
  assert.equal(hasPendingDangerAlert([danger]), true);
  assert.equal(hasPendingDangerAlert([{ ...danger, status: "resolved" }]), false);
});
