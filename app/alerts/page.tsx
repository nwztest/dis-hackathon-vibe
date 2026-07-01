import Link from "next/link";
import { ClipboardCheck, ListFilter } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SeverityBadge } from "@/components/Status";
import { alerts, roomLabel } from "@/lib/mock-data";

export default function AlertsPage() {
  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Alerts</h1>
            <p>Review open, acknowledged, and resolved fall-detection events.</p>
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
                  <h2>{roomLabel(alert.roomId)}</h2>
                  <p>{alert.reason}</p>
                </div>
              </div>
              <SeverityBadge severity={alert.severity} />
              <dl>
                <div><dt>Confidence</dt><dd>{alert.confidence}%</dd></div>
                <div><dt>Stillness</dt><dd>{alert.stillnessSeconds}s</dd></div>
                <div><dt>Opened</dt><dd>{alert.openedAt}</dd></div>
              </dl>
              <Link className="secondary-button" href={`/rooms/${alert.roomId}`}>Open detail</Link>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
