"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { useDeviceSetup } from "@/components/DeviceSetupProvider";

export default function SetupCompletePage() {
  const setup = useDeviceSetup();
  const device = setup.provisionedDevice;
  return (
    <SetupShell currentStep={4}>
      <section className="setup-card narrow">
        <div className="complete-message">
          <CheckCircle2 size={44} />
          <h1>{device?.status === "online" ? "Camera is online" : "Provisioning complete"}</h1>
          <p>The assigned room and server-derived heartbeat below come from the device registry.</p>
        </div>
        {device ? (
          <article className="panel">
            <h2>Device summary</h2>
            <dl className="definition-list">
              <div><dt>Device</dt><dd>{device.id}</dd></div>
              <div><dt>Assigned area</dt><dd>{device.homeLabel ? `${device.homeLabel} · ` : ""}{device.roomName}</dd></div>
              <div><dt>Connection</dt><dd><span className={`status-pill ${device.status}`}>{device.status}</span></dd></div>
              <div><dt>Firmware</dt><dd>{device.firmwareVersion}</dd></div>
              <div><dt>Camera profile</dt><dd>{device.cameraProfile}</dd></div>
              <div><dt>Cadence</dt><dd>{device.captureIntervalMs} ms · 2 FPS target</dd></div>
              <div><dt>Last heartbeat</dt><dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Awaiting first accepted frame"}</dd></div>
              {setup.localStreamUrl ? (
                <div>
                  <dt>Local live view</dt>
                  <dd><a className="text-link" href={setup.localStreamUrl} target="_blank" rel="noreferrer">Open on this Wi-Fi</a></dd>
                </div>
              ) : null}
            </dl>
          </article>
        ) : <div className="setup-notice warning">No provisioned device is held in this setup session. Return to the provisioning step.</div>}
        <button className="secondary-button full" type="button" onClick={() => void setup.refreshSummary()} disabled={!device || setup.busy}>
          <RefreshCw size={16} /> Refresh heartbeat
        </button>
        {setup.error && <div className="action-error">{setup.error}</div>}
        <div className="setup-actions">
          <Link className="secondary-button" href="/setup/identify">Review setup</Link>
          <Link className="primary-button" href="/devices">Finish setup</Link>
        </div>
      </section>
    </SetupShell>
  );
}
