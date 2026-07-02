import Link from "next/link";
import { RefreshCw, Router, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { devices, homeAddress, roomById, roomLabel } from "@/lib/mock-data";

export default function DevicesPage() {
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
            const room = roomById(device.roomId);
            return (
              <article className="table-row device-table" key={device.id}>
                <div><Router size={18} /><strong>{device.id}</strong><small>{device.hardware}</small></div>
                <span>{roomLabel(device.roomId)}<small>{homeAddress(room.homeId)}</small></span>
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
