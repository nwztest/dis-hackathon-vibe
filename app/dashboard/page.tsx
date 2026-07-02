import { AlertTriangle, Filter } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RoomCard } from "@/components/RoomCard";
import { homeAddress, homeById, homes, rooms, statusCounts } from "@/lib/mock-data";

export default function DashboardPage() {
  const counts = statusCounts();
  const activeAlert = rooms.find((room) => room.status === "danger");
  const activeHome = activeAlert ? homeById(activeAlert.homeId) : null;

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Home safety watch</h1>
            <p>Live room and shower monitoring for seniors living in their own HDB homes.</p>
          </div>
          <div className="filter-row">
            <button type="button"><Filter size={16} /> All blocks</button>
            <button type="button">Rooms + showers</button>
          </div>
        </div>
        {activeAlert && activeHome ? (
          <section className="alert-panel danger">
            <div>
              <AlertTriangle size={22} />
              <div>
                <h2>{activeHome.seniorName}: danger in {activeAlert.name}</h2>
                <p>{homeAddress(activeHome.id)} · {activeHome.seniorPhone} · {activeAlert.alertReason}</p>
              </div>
            </div>
            <div className="button-row">
              <button type="button">Call senior</button>
              <button type="button">Call contact</button>
              <button type="button">Open alert</button>
            </div>
          </section>
        ) : null}
        <section className="home-strip" aria-label="Monitored homes">
          {homes.map((home) => {
            const homeRooms = rooms.filter((room) => room.homeId === home.id);
            const needsAttention = homeRooms.some((room) => room.status === "danger" || room.status === "suspicious");
            return (
              <article className={needsAttention ? "home-summary attention" : "home-summary"} key={home.id}>
                <div>
                  <h2>{home.seniorName}</h2>
                  <p>{homeAddress(home.id)} · {home.address}</p>
                </div>
                <strong>{homeRooms.filter((room) => room.status === "danger" || room.status === "suspicious").length}</strong>
              </article>
            );
          })}
        </section>
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
