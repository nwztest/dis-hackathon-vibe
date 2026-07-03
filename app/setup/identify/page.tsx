import Link from "next/link";
import { Keyboard, Radio, Router } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupIdentifyPage() {
  await requireCurrentProfile("/setup/identify");

  return (
    <SetupShell currentStep={2}>
      <section className="setup-card">
        <div className="section-heading">
          <h1>Pair sensor node</h1>
          <p>Match the physical node to the selected home area before calibration.</p>
        </div>
        <div className="two-column">
          <article className="panel">
            <Keyboard size={22} />
            <h2>Printed node ID</h2>
            <label>
              Node ID
              <input placeholder="CAM-BED-123 or TOF-SHW-123" />
            </label>
            <button type="button">Send identify command</button>
          </article>
          <article className="panel muted">
            <Router size={22} />
            <h2>Expected node checks</h2>
            <ul className="plain-list">
              <li>Publishes heartbeat over Wi-Fi/MQTT.</li>
              <li>Room camera reports still-frame posture analysis every 5 seconds.</li>
              <li>Shower node reports VL53L5X depth grid summary only.</li>
              <li>Microphone input is not required for this prototype.</li>
            </ul>
            <div className="inline-status">
              <Radio size={16} />
              Waiting for node heartbeat
            </div>
          </article>
        </div>
        <div className="setup-actions">
          <Link className="secondary-button" href="/setup/select-room">Back</Link>
          <Link className="primary-button" href="/setup/calibration">Next step</Link>
        </div>
      </section>
    </SetupShell>
  );
}
