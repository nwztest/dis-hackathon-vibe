import { AppShell } from "@/components/AppShell";
import { AlertsFilterView } from "@/components/AlertsFilterView";
import { getAlerts, getHomes, getRooms } from "@/lib/data";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const profile = await requireCurrentProfile("/alerts");
  const [alerts, homes, rooms] = await Promise.all([getAlerts(), getHomes(), getRooms()]);

  return (
    <AppShell profile={profile ?? undefined}>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Alerts</h1>
            <p>Review open, acknowledged, and resolved home safety events.</p>
          </div>
        </div>
        <AlertsFilterView alerts={alerts} homes={homes} rooms={rooms} />
      </main>
    </AppShell>
  );
}
