import Link from "next/link";
import { RefreshCw, Router, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDevices, getHomes, getRooms } from "@/lib/data";
import { formatHomeAddress } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const [devices, rooms, homes] = await Promise.all([getDevices(), getRooms(), getHomes()]);

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Devices</h1>
            <p>Room camera and shower ToF nodes assigned to individual senior homes.</p>
          </div>
          <Link className="primary-button" href="/setup/select-room">Add device</Link>
        </div>
        <div className="search-row compact">
          <Search size={18} />
          <input placeholder="Search by device ID or room" />
        </div>
        <section className="table-panel">
          <div className="table-header device-table">
            <span>Device</span>
            <span>Home area</span>
            <span>Status</span>
            <span>Heartbeat</span>
            <span>Actions</span>
          </div>
          {devices.map((device) => {
            const room = rooms.find((item) => item.id === device.roomId);
            const home = room ? homes.find((item) => item.id === room.homeId) : undefined;
            return (
              <article className="table-row device-table" key={device.id}>
                <div><Router size={18} /><strong>{device.id}</strong><small>{device.hardware}</small></div>
                <span>{home?.seniorName ?? "Unknown senior"} · {room?.name ?? "Unknown room"}<small>{home ? formatHomeAddress(home) : "Unknown home"}</small></span>
                <span className={`status-pill ${device.status}`}>{device.status}</span>
                <span>{device.heartbeat}<small>{device.signal} · firmware {device.firmware} · {device.privacy}</small></span>
                <div className="button-row">
                  <button type="button" disabled><RefreshCw size={14} /> Reboot</button>
                  <button type="button" disabled>Calibrate</button>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
