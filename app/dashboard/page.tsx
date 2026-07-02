import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AddHomeButton, AddRoomButton } from "@/components/DashboardModals";
import { DashboardSearchView } from "@/components/DashboardSearchView";
import { DashboardStatusFilter } from "@/components/DashboardStatusFilter";
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
            <AddHomeButton />
            <AddRoomButton homes={homes} />
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
              <Link className="secondary-button" href={`/rooms/${activeAlert.id}`}>Open alert</Link>
            </div>
          </section>
        ) : null}
        <DashboardStatusFilter counts={counts} total={rooms.length} />
        <DashboardSearchView homes={homes} rooms={rooms} />
      </main>
    </AppShell>
  );
}
