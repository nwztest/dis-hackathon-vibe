import { AlertTriangle, Filter } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RoomCard } from "@/components/RoomCard";
import { rooms, statusCounts } from "@/lib/mock-data";

export default function DashboardPage() {
  const counts = statusCounts();
  const activeAlert = rooms.find((room) => room.status === "danger");

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>One Care @ Jurong Spring</h1>
            <p>Live bathroom safety overview for sensor-monitored toilets and showers.</p>
          </div>
          <div className="filter-row">
            <button type="button"><Filter size={16} /> All floors</button>
            <button type="button">Toilets + showers</button>
          </div>
        </div>
        {activeAlert ? (
          <section className="alert-panel danger">
            <div>
              <AlertTriangle size={22} />
              <div>
                <h2>{activeAlert.name}: possible fall detected</h2>
                <p>{activeAlert.alertReason}</p>
              </div>
            </div>
            <div className="button-row">
              <button type="button">Acknowledge</button>
              <button type="button">Open alert</button>
            </div>
          </section>
        ) : null}
        <section className="summary-grid">
          {Object.entries(counts).map(([status, count]) => (
            <article className={`summary-card ${status}`} key={status}>
              <span>{status}</span>
              <strong>{count}</strong>
            </article>
          ))}
        </section>
        <section className="room-grid">
          {rooms.map((room) => <RoomCard room={room} key={room.id} />)}
        </section>
      </main>
    </AppShell>
  );
}
