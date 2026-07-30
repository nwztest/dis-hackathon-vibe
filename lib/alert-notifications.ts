import type { AlertRecord, AlertStatus } from "./mock-data";

export type AlertSeverity = AlertRecord["severity"];

export type AlertSnapshot = {
  id: string;
  homeId: string;
  roomId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  reason: string;
  evidence: string;
  confidence: number;
};

export type AlertNotification = AlertSnapshot & {
  seniorName: string;
  roomName: string;
};

export type AlertChangeType = "INSERT" | "UPDATE";

export function snapshotFromAlertRecord(alert: AlertRecord): AlertSnapshot {
  return {
    id: alert.id,
    homeId: alert.homeId,
    roomId: alert.roomId,
    severity: alert.severity,
    status: alert.status,
    reason: alert.reason,
    evidence: alert.evidence,
    confidence: alert.confidence,
  };
}

export function seedAlertSnapshots(alerts: AlertRecord[]) {
  return new Map(alerts.map((alert) => [alert.id, snapshotFromAlertRecord(alert)]));
}

export function shouldNotifyForAlertChange(
  changeType: AlertChangeType,
  previous: AlertSnapshot | undefined,
  next: AlertSnapshot,
) {
  if (next.status !== "open") return false;
  if (changeType === "INSERT") return true;
  return previous?.severity === "suspicious" && next.severity === "danger";
}

export function notificationKey(alert: Pick<AlertSnapshot, "id" | "severity">) {
  return `${alert.id}:${alert.severity}`;
}

export function enqueueAlertNotification(
  queue: AlertNotification[],
  notification: AlertNotification,
) {
  const withoutDuplicateOrEarlierSeverity = queue.filter(
    (item) =>
      notificationKey(item) !== notificationKey(notification) &&
      !(item.id === notification.id && notification.severity === "danger"),
  );
  return [...withoutDuplicateOrEarlierSeverity, notification].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "danger" ? -1 : 1;
  });
}

export function removeAlertNotifications(queue: AlertNotification[], alertId: string) {
  return queue.filter((notification) => notification.id !== alertId);
}

export function hasPendingDangerAlert(alerts: Iterable<AlertSnapshot>) {
  for (const alert of alerts) {
    if (alert.severity === "danger" && alert.status !== "resolved") return true;
  }
  return false;
}

