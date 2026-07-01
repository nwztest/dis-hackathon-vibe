import Link from "next/link";
import { CheckCircle2, Network } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";

export default function SetupCompletePage() {
  return (
    <SetupShell currentStep={4}>
      <section className="setup-card narrow">
        <div className="complete-message">
          <CheckCircle2 size={44} />
          <h1>Verification ready</h1>
          <p>The selected toilet or shower node is paired, calibrated, and ready to appear in the dashboard.</p>
        </div>
        <article className="panel">
          <h2>Device summary</h2>
          <dl className="definition-list">
            <div><dt>Device type</dt><dd>ESP32 + BNO085 + VL53L5X</dd></div>
            <div><dt>Assigned room</dt><dd>Shower 01</dd></div>
            <div><dt>Connection</dt><dd>Online</dd></div>
            <div><dt>Firmware</dt><dd>0.1.0</dd></div>
            <div><dt>Local alert output</dt><dd>Servo flag available for demo</dd></div>
            <div><dt>Dashboard state</dt><dd>Sensor-only monitoring</dd></div>
          </dl>
        </article>
        <button className="secondary-button full" type="button" disabled>
          <Network size={16} />
          Test alert unavailable in UI-only prototype
        </button>
        <div className="setup-actions">
          <Link className="secondary-button" href="/settings">Review settings</Link>
          <Link className="primary-button" href="/dashboard">Finish setup</Link>
        </div>
      </section>
    </SetupShell>
  );
}
