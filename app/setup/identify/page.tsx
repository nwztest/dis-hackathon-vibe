"use client";

import { useState } from "react";
import Link from "next/link";
import { Cable, Camera, LockKeyhole, Wifi } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { useDeviceSetup } from "@/components/DeviceSetupProvider";

export default function SetupIdentifyPage() {
  const setup = useDeviceSetup();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const unavailable = setup.role !== "admin" || !setup.provisioningConfigured || !setup.serialSupported || !setup.secureContext;
  const endpointValue = () => apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  async function provision() {
    setSubmitted(false);
    try {
      await setup.provision({ ssid, password, apiBaseUrl: endpointValue() });
      setPassword("");
      setSubmitted(true);
    } catch {
      // The provider exposes a safe user-facing error.
    }
  }

  return (
    <SetupShell currentStep={2}>
      <section className="setup-card">
        <div className="section-heading">
          <h1>Connect and provision ESP32-S3-CAM</h1>
          <p>Confirm the common camera profile, connect through Web Serial, then securely transmit Wi-Fi and device credentials.</p>
        </div>
        {unavailable && (
          <div className="setup-notice warning">
            {setup.role !== "admin" ? "Only administrators can provision or rotate credentials."
              : !setup.provisioningConfigured ? "Supabase and the service-role key must be configured before provisioning."
                : !setup.secureContext ? "Open this page over HTTPS (or localhost) to use Web Serial."
                  : "Use desktop Chrome or Edge; this browser does not expose Web Serial."}
          </div>
        )}
        <div className="two-column setup-provision-grid">
          <article className="panel">
            <Camera size={22} />
            <h2>Hardware profile</h2>
            <dl className="definition-list compact">
              <div><dt>Profile</dt><dd>esp32s3_cam_common</dd></div>
              <div><dt>Sensor</dt><dd>OV2640 / OV3660</dd></div>
              <div><dt>Capture</dt><dd>VGA JPEG · quality 12 · 2 FPS target</dd></div>
              <div><dt>PSRAM</dt><dd>Required · two frame buffers</dd></div>
            </dl>
            <label>Device ID<input value={setup.deviceUid} onChange={(event) => setup.setDeviceUid(event.target.value.toUpperCase())} autoComplete="off" /></label>
            <button type="button" onClick={() => void setup.connectSerial()} disabled={unavailable || setup.busy || setup.serialConnected}>
              <Cable size={16} /> {setup.serialConnected ? "Serial connected" : "Connect Web Serial"}
            </button>
            <div className="inline-status"><Cable size={16} />{setup.serialMessage}</div>
          </article>
          <article className="panel">
            <Wifi size={22} />
            <h2>Network and endpoint</h2>
            <label>Wi-Fi name<input value={ssid} onChange={(event) => setSsid(event.target.value)} autoComplete="off" /></label>
            <label>Wi-Fi password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
            <label>Public API origin<input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} placeholder="https://careguard.example" autoComplete="off" /></label>
            <p className="privacy-note"><LockKeyhole size={15} />The password and one-time plaintext device token stay in memory only until the serial write completes.</p>
            <button type="button" onClick={() => void provision()} disabled={unavailable || !setup.serialConnected || setup.busy}>
              {setup.busy ? "Provisioning…" : setup.selectedDevice ? "Rotate token and provision" : "Create device and provision"}
            </button>
          </article>
        </div>
        {setup.error && <div className="action-error">{setup.error}</div>}
        {submitted && <div className="setup-notice success">Configuration was acknowledged by the ESP32-S3-CAM. The plaintext token is no longer held by the wizard.</div>}
        <div className="setup-actions">
          <Link className="secondary-button" href="/setup/select-room">Back</Link>
          <Link className={`primary-button${!setup.provisionedDevice ? " disabled" : ""}`} href={setup.provisionedDevice ? "/setup/calibration" : "#"}>Run verification</Link>
        </div>
      </section>
    </SetupShell>
  );
}
