import { DeviceSetupProvider } from "@/components/DeviceSetupProvider";
import { requireCurrentProfile } from "@/lib/auth";
import { getDevices, getHomes, getRooms } from "@/lib/data";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCurrentProfile("/setup/select-room");
  const [devices, homes, rooms] = await Promise.all([getDevices(), getHomes(), getRooms()]);
  return (
    <DeviceSetupProvider
      devices={devices}
      homes={homes}
      rooms={rooms}
      role={profile?.role ?? "family"}
      provisioningConfigured={hasSupabaseEnv() && hasSupabaseAdminEnv()}
    >
      {children}
    </DeviceSetupProvider>
  );
}
