import type { RoomStatus } from "@/lib/mock-data";

export type DashboardStatusFilterKey = "all" | "danger" | "suspicious" | "offline" | "maintenance";

const filterItems: Array<{ key: DashboardStatusFilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "danger", label: "Danger" },
  { key: "suspicious", label: "Suspicious" },
  { key: "offline", label: "Offline" },
  { key: "maintenance", label: "Maintenance" },
];

export function DashboardStatusFilter({
  activeFilter,
  counts,
  onFilterChange,
  total,
}: {
  activeFilter: DashboardStatusFilterKey;
  counts: Record<RoomStatus, number>;
  onFilterChange: (filter: DashboardStatusFilterKey) => void;
  total: number;
}) {
  return (
    <section className="status-filter" aria-label="Room status filters">
      {filterItems.map((item) => {
        const count = item.key === "all" ? total : counts[item.key];
        return (
          <button
            aria-pressed={activeFilter === item.key}
            className={activeFilter === item.key ? "active" : ""}
            type="button"
            key={item.key}
            onClick={() => onFilterChange(item.key)}
          >
            <span>{item.label}</span>
            <strong>{count}</strong>
          </button>
        );
      })}
    </section>
  );
}
