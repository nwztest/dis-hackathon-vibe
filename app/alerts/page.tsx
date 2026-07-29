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
      <main className="page-content alerts-page">
        <div className="page-heading">
          <div>
            <span className="page-eyebrow">Response center</span>
            <h1>Active alerts</h1>
            <p>A focused response queue for incidents that still need caregiver action.</p>
          </div>
        </div>
        <AlertsFilterView alerts={alerts} homes={homes} rooms={rooms} />
      </main>
    </AppShell>
  );
}
