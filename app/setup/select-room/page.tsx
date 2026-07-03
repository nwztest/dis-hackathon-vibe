import Link from "next/link";
import { Search, Wifi, WifiOff, Wrench } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { getDevices, getHomes, getRooms } from "@/lib/data";
import { formatHomeAddress } from "@/lib/mock-data";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupSelectRoomPage() {
  await requireCurrentProfile("/setup/select-room");
  const [devices, rooms, homes] = await Promise.all([getDevices(), getRooms(), getHomes()]);

  return (
    <SetupShell currentStep={1}>
      <section className="setup-card">
        <div className="section-heading">
          <h1>Select target</h1>
          <p>Choose the senior home area to install, replace, or recalibrate.</p>
        </div>
        <div className="search-row compact">
          <Search size={18} />
          <input placeholder="Search by senior, block, unit, or area" />
          <select aria-label="Area type">
            <option>All areas</option>
            <option>Rooms</option>
            <option>Showers</option>
          </select>
        </div>
        <div className="setup-room-grid">
          {rooms.map((room) => {
            const home = homes.find((item) => item.id === room.homeId);
            const device = devices.find((item) => item.roomId === room.id);
            const deviceStatus = device?.status ?? "unassigned";
            const StatusIcon =
              deviceStatus === "offline" ? WifiOff : deviceStatus === "maintenance" ? Wrench : Wifi;
            const setupAction =
              deviceStatus === "offline"
                ? "Replace or reconnect node"
                : deviceStatus === "maintenance"
                  ? "Resume after service"
                  : "Recalibrate or replace node";

            return (
              <button className="setup-room-card" type="button" key={room.id}>
                <div className="setup-room-card-head">
                  <div>
                    <strong>{home?.seniorName ?? "Unknown senior"} · {room.name}</strong>
                    <span>{home ? formatHomeAddress(home) : "Unknown home"} · {room.type === "shower" ? "Shower ToF" : "Room camera"}</span>
                  </div>
                  <span className={`status-pill ${deviceStatus}`}>{deviceStatus}</span>
                </div>
                <div className="setup-device-meta">
                  <span>
                    <StatusIcon size={15} />
                    {device?.id ?? "No device assigned"}
                  </span>
                  <span>{device?.heartbeat ?? "Not connected"}</span>
                  <span>{device?.signal ?? "No signal"}{device ? ` · firmware ${device.firmware}` : ""}</span>
                  <span>{setupAction}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="setup-actions">
          <Link className="secondary-button" href="/dashboard">Cancel setup</Link>
          <Link className="primary-button" href="/setup/identify">Next step</Link>
        </div>
      </section>
    </SetupShell>
  );
}
