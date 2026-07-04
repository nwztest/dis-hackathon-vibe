import { AppShell } from "@/components/AppShell";
import { DemoCameraClient, type DemoCameraRoom } from "@/components/DemoCameraClient";
import { getHomes, getRooms } from "@/lib/data";
import { formatHomeAddress } from "@/lib/mock-data";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DemoCameraPage() {
  const profile = await requireCurrentProfile("/demo/camera");
  const [homes, rooms] = await Promise.all([getHomes(), getRooms()]);
  const cameraRooms: DemoCameraRoom[] = rooms
    .filter((room) => room.type === "room" && room.deviceType === "room_camera")
    .map((room) => {
      const home = homes.find((item) => item.id === room.homeId);
      return {
        id: room.id,
        name: room.name,
        status: room.status,
        deviceId: room.deviceId,
        homeLabel: home ? `${home.seniorName} · ${formatHomeAddress(home)}` : "Unknown home",
      };
    });

  return (
    <AppShell profile={profile ?? undefined}>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Demo camera</h1>
            <p>Use this laptop camera as a temporary room camera for YOLO worker demos.</p>
          </div>
        </div>
        <DemoCameraClient rooms={cameraRooms} />
      </main>
    </AppShell>
  );
}
