import type { CurrentProfile } from "@/lib/auth";
import { getAlerts } from "@/lib/data";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile?: CurrentProfile;
}) {
  const alerts = await getAlerts();
  const hasPendingDangerAlert = alerts.some(
    (alert) => alert.severity === "danger" && alert.status !== "resolved",
  );

  return (
    <AppShellClient profile={profile} hasPendingDangerAlert={hasPendingDangerAlert}>
      {children}
    </AppShellClient>
  );
}
