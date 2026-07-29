import { AppShell } from "@/components/AppShell";
import { AddHomeButton, AddRoomButton } from "@/components/DashboardModals";
import { DashboardSearchView } from "@/components/DashboardSearchView";
import { getDashboardData } from "@/lib/data";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireCurrentProfile("/dashboard");
  const { homes, rooms, counts } = await getDashboardData();
  const canManageHomes = profile?.role === "admin";

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
        <DashboardSearchView canManageHomes={canManageHomes} counts={counts} homes={homes} rooms={rooms} />
      </main>
    </AppShell>
  );
}
