import type { RoomStatus } from "@/lib/mock-data";

const labels: Record<RoomStatus, string> = {
  unoccupied: "Unoccupied",
  occupied: "Occupied",
  suspicious: "Suspicious",
  danger: "Danger",
  offline: "Offline",
  maintenance: "Maintenance",
};

export function StatusBadge({ status }: { status: RoomStatus }) {
  return <span className={`status-badge ${status}`}>{labels[status]}</span>;
}

export function SeverityBadge({ severity }: { severity: "suspicious" | "danger" }) {
  return <span className={`status-badge ${severity}`}>{severity === "danger" ? "Danger" : "Suspicious"}</span>;
}
