import Link from "next/link";
import { ClipboardCheck, ListFilter } from "lucide-react";
import { acknowledgeAlertAction, resolveAlertAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { SeverityBadge } from "@/components/Status";
import { getAlerts, getHomes, getRooms } from "@/lib/data";
import { formatHomeAddress } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [alerts, homes, rooms] = await Promise.all([getAlerts(), getHomes(), getRooms()]);

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Alerts</h1>
            <p>Review open, acknowledged, and resolved home safety events.</p>
          </div>
          <button type="button"><ListFilter size={16} /> Filters</button>
        </div>
        <div className="tabs" role="tablist" aria-label="Alert status">
          <button className="active" type="button">Open</button>
          <button type="button">Acknowledged</button>
          <button type="button">Resolved</button>
          <button type="button">All</button>
        </div>
        <section className="list-panel">
          {alerts.map((alert) => (
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
      </main>
    </AppShell>
  );
}

function roomLabel(roomId: string, rooms: Awaited<ReturnType<typeof getRooms>>, homes: Awaited<ReturnType<typeof getHomes>>) {
  const room = rooms.find((item) => item.id === roomId);
  const home = room ? homes.find((item) => item.id === room.homeId) : undefined;
  return `${home?.seniorName ?? "Unknown senior"} · ${room?.name ?? "Unknown room"}`;
}

function homeDescription(homeId: string, homes: Awaited<ReturnType<typeof getHomes>>) {
  const home = homes.find((item) => item.id === homeId);
  if (!home) return "Unknown home";
  return `${formatHomeAddress(home)} · ${home.seniorPhone}`;
}
