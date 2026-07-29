"use client";

import Link from "next/link";
import { Camera, Search, ShowerHead, Wifi, WifiOff, Wrench } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { useDeviceSetup } from "@/components/DeviceSetupProvider";
import { formatHomeAddress } from "@/lib/mock-data";

export default function SetupSelectRoomPage() {
  const setup = useDeviceSetup();
  return (
    <SetupShell currentStep={1}>
      <section className="setup-card">
        <div className="section-heading">
          <h1>Select camera room</h1>
          <p>Choose an existing camera to rotate credentials, or a room where a replacement camera will be installed.</p>
        </div>
        {setup.role !== "admin" && <div className="setup-notice">Device details are read-only. Only administrators can provision hardware.</div>}
        <div className="search-row compact">
          <Search size={18} />
          <input aria-label="Search rooms" placeholder="Search by senior, block, unit, or area" />
        </div>
        <div className="setup-room-grid">
          {setup.rooms.map((room) => {
            const home = setup.homes.find((item) => item.id === room.homeId);
            const device = setup.devices.find((item) => item.roomId === room.id);
            const selected = setup.selectedRoomId === room.id;
            const StatusIcon = device?.status === "offline" ? WifiOff : device?.status === "maintenance" ? Wrench : Wifi;
            return (
              <button className={`setup-room-card${selected ? " selected" : ""}`} type="button" key={room.id} onClick={() => setup.selectRoom(room.id)}>
                <div className="setup-room-card-head">
                  <div>
                    <strong>{home?.seniorName ?? "Unknown senior"} · {room.name}</strong>
                    <span>{home ? formatHomeAddress(home) : "Unknown home"}</span>
                  </div>
                  <span className={`status-pill ${device?.status ?? "unassigned"}`}>{device?.status ?? "unassigned"}</span>
                </div>
                <div className="setup-device-meta">
                  <span>{room.type === "room" ? <Camera size={15} /> : <ShowerHead size={15} />}{room.type === "room" ? "Room camera" : "Shower ToF"}</span>
                  <span><StatusIcon size={15} />{device?.id ?? "No device assigned"}</span>
                  <span>{device?.heartbeat ?? "Not connected"}</span>
                  <span>{room.type === "shower" ? "Existing ToF records preserved; provisioning is not available yet." : device ? "Existing device or replacement" : "New camera assignment"}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="setup-actions">
          <Link className="secondary-button" href="/devices">Cancel setup</Link>
          <Link className={`primary-button${setup.selectedRoom?.type === "shower" ? " disabled" : ""}`} href={setup.selectedRoom?.type === "room" ? "/setup/identify" : "#"}>Next step</Link>
        </div>
      </section>
    </SetupShell>
  );
}
