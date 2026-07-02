import Link from "next/link";
import { AlertTriangle, Filter, Search } from "lucide-react";
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
        <section className="dashboard-home-panel" aria-label="Monitored homes">
          <div className="section-toolbar">
            <h2>Monitored homes</h2>
            <div className="search-row compact">
              <Search size={18} />
              <input placeholder="Search senior, block, unit, or phone" />
            </div>
          </div>
          <div className="home-table">
            <div className="home-table-header">
              <span>Senior</span>
              <span>Phone</span>
              <span>Medical details</span>
              <span>Areas</span>
              <span>Open alerts</span>
            </div>
            {homes.map((home) => {
              const homeRooms = rooms.filter((room) => room.homeId === home.id);
              const openAlerts = homeRooms.filter((room) => room.status === "danger" || room.status === "suspicious");
              const firstRoom = homeRooms[0];
              return (
                <article className={openAlerts.length > 0 ? "home-table-row attention" : "home-table-row"} key={home.id}>
                  <div>
                    <strong>{home.seniorName}</strong>
                    <span>{homeAddress(home.id)} · {home.address}</span>
                  </div>
                  <span>{home.seniorPhone}</span>
                  <span>{home.medicalDetails}</span>
                  <span>{homeRooms.map((room) => room.name).join(", ")}</span>
                  <div className="home-alert-cell">
                    <strong>{openAlerts.length}</strong>
                    {firstRoom ? <Link className="text-link" href={`/rooms/${firstRoom.id}`}>Open</Link> : null}
                  </div>
                </article>
              );
            })}
          </div>
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
