import type { RoomStatus } from "@/lib/mock-data";

const filterItems: Array<{ key: "all" | RoomStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "danger", label: "Danger" },
  { key: "suspicious", label: "Suspicious" },
  { key: "offline", label: "Offline" },
  { key: "maintenance", label: "Maintenance" },
];

export function DashboardStatusFilter({
  counts,
  total,
}: {
  counts: Record<RoomStatus, number>;
  total: number;
}) {
  return (
    <section className="status-filter" aria-label="Room status filters">
      {filterItems.map((item) => {
        const count = item.key === "all" ? total : counts[item.key];
        return (
          <button className={item.key === "all" ? "active" : ""} type="button" key={item.key}>
            <span>{item.label}</span>
            <strong>{count}</strong>
          </button>
        );
      })}
    </section>
  );
}
