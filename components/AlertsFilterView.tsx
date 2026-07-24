"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { acknowledgeAlertAction, resolveAlertAction } from "@/app/actions";
import { SeverityBadge } from "@/components/Status";
import { formatHomeAddress, type AlertRecord, type SeniorHome, type Room } from "@/lib/mock-data";

type AlertFilterKey = "all" | "unacknowledged" | "open" | "acknowledged" | "resolved" | "danger" | "suspicious";

const alertFilters: Array<{ key: AlertFilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "unacknowledged", label: "Unacknowledged" },
  { key: "open", label: "Open" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "danger", label: "Danger" },
  { key: "suspicious", label: "Suspicious" },
];

export function AlertsFilterView({
  alerts,
  homes,
  rooms,
}: {
  alerts: AlertRecord[];
  homes: SeniorHome[];
  rooms: Room[];
}) {
  const [activeFilter, setActiveFilter] = useState<AlertFilterKey>("all");
  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => matchesAlertFilter(alert, activeFilter)),
    [activeFilter, alerts],
  );
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        alertFilters.map((filter) => [filter.key, alerts.filter((alert) => matchesAlertFilter(alert, filter.key)).length]),
      ) as Record<AlertFilterKey, number>,
    [alerts],
  );

  return (
    <>
      <section className="status-filter" aria-label="Alert filters">
        {alertFilters.map((filter) => {
          return (
            <button
              aria-pressed={activeFilter === filter.key}
              className={activeFilter === filter.key ? "active" : ""}
              type="button"
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
            >
              <span>{filter.label}</span>
              <strong>{filterCounts[filter.key]}</strong>
            </button>
          );
        })}
      </section>
      {filteredAlerts.length > 0 ? (
        <section className="list-panel">
          {filteredAlerts.map((alert) => (
            <article className="alert-row" key={alert.id}>
              <div className="alert-row-main">
                <ClipboardCheck size={18} />
                <div>
                  <h2>{roomLabel(alert.roomId, rooms, homes)}</h2>
                  <p>{homeDescription(alert.homeId, homes)} · {alert.reason}</p>
                </div>
              </div>
              <SeverityBadge severity={alert.severity} />
              <dl>
                <div><dt>Confidence</dt><dd>{alert.confidence}%</dd></div>
                <div><dt>Duration</dt><dd>{alert.duration}</dd></div>
                <div><dt>Opened</dt><dd>{alert.openedAt}</dd></div>
              </dl>
              <div className="button-row">
                {alert.status === "open" ? (
                  <>
                    <form action={acknowledgeAlertAction.bind(null, alert.id)}>
                      <button type="submit">Acknowledge</button>
                    </form>
                    <form action={resolveAlertAction.bind(null, alert.id)}>
                      <button type="submit">Resolve</button>
                    </form>
                  </>
                ) : null}
                <Link className="secondary-button" href={`/rooms/${alert.roomId}`}>Open detail</Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No matching alerts</h2>
          <p>No alerts match the selected filter.</p>
        </section>
      )}
    </>
  );
}

function matchesAlertFilter(alert: AlertRecord, filter: AlertFilterKey) {
  if (filter === "all") return true;
  if (filter === "unacknowledged") return alert.status === "open" && !alert.acknowledgedBy;
  if (filter === "danger" || filter === "suspicious") return alert.severity === filter;
  return alert.status === filter;
}

function roomLabel(roomId: string, rooms: Room[], homes: SeniorHome[]) {
  const room = rooms.find((item) => item.id === roomId);
  const home = room ? homes.find((item) => item.id === room.homeId) : undefined;
  return `${home?.seniorName ?? "Unknown senior"} · ${room?.name ?? "Unknown room"}`;
}

function homeDescription(homeId: string, homes: SeniorHome[]) {
  const home = homes.find((item) => item.id === homeId);
  if (!home) return "Unknown home";
  return `${formatHomeAddress(home)} · ${home.seniorPhone}`;
}
