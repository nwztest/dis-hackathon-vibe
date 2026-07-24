import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AddHomeButton, AddRoomButton } from "@/components/DashboardModals";
import { DashboardSearchView } from "@/components/DashboardSearchView";
import { formatHomeAddress } from "@/lib/mock-data";
import { getDashboardData } from "@/lib/data";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireCurrentProfile("/dashboard");
  const { homes, rooms, counts } = await getDashboardData();
  const canManageHomes = profile?.role === "admin";
  const activeAlert = rooms.find((room) => room.status === "danger");
  const activeHome = activeAlert ? homes.find((home) => home.id === activeAlert.homeId) : null;

  return (
    <AppShell profile={profile ?? undefined}>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Home safety watch</h1>
            <p>Live room and shower monitoring for seniors living in their own HDB homes.</p>
          </div>
          {canManageHomes ? (
            <div className="filter-row">
              <AddHomeButton />
              <AddRoomButton homes={homes} />
            </div>
          ) : null}
        </div>
        {activeAlert && activeHome ? (
          <section className="alert-panel danger">
            <div>
              <AlertTriangle size={22} />
              <div>
                <h2>{activeHome.seniorName}: danger in {activeAlert.name}</h2>
                <p>{formatHomeAddress(activeHome)} · {activeHome.seniorPhone} · {activeAlert.alertReason}</p>
              </div>
            </div>
            <div className="button-row">
              <button type="button">Call senior</button>
              <button type="button">Call contact</button>
              <Link className="secondary-button" href={`/rooms/${activeAlert.id}`}>Open alert</Link>
            </div>
          </section>
        ) : null}
        <DashboardSearchView canManageHomes={canManageHomes} counts={counts} homes={homes} rooms={rooms} />
      </main>
    </AppShell>
  );
}
