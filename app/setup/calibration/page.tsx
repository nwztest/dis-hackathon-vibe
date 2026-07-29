"use client";

import Link from "next/link";
import { CheckCircle2, CircleDashed, CloudCog, HeartPulse, Wifi } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { useDeviceSetup } from "@/components/DeviceSetupProvider";

export default function SetupCalibrationPage() {
  const setup = useDeviceSetup();
  const checks = [
    { key: "wifi", label: "Wi-Fi association", icon: Wifi },
    { key: "api", label: "HTTPS device API", icon: CloudCog },
    { key: "inference", label: "JPEG inference", icon: CheckCircle2 },
    { key: "heartbeat", label: "Dashboard heartbeat", icon: HeartPulse },
  ] as const;
  return (
    <SetupShell currentStep={3}>
      <section className="setup-card narrow">
        <div className="section-heading">
          <h1>Verify a test frame</h1>
          <p>The device captures one transient JPEG and reports each stage. The browser never receives the image.</p>
        </div>
        <div className="test-result-grid">
          {checks.map(({ key, label, icon: Icon }) => {
            const value = setup.testResults?.[key];
            return (
              <div className={`test-result ${value === true ? "passed" : value === false ? "failed" : ""}`} key={key}>
                {value === undefined ? <CircleDashed size={19} /> : <Icon size={19} />}
                <span>{label}</span><strong>{value === undefined ? "Pending" : value ? "Passed" : "Failed"}</strong>
              </div>
            );
          })}
        </div>
        <button type="button" className="primary-button full" onClick={() => void setup.runTests()} disabled={!setup.serialConnected || setup.busy}>
          {setup.busy ? "Testing…" : "Capture and upload test frame"}
        </button>
        {!setup.serialConnected && <div className="setup-notice warning">Return to step 2 and connect the provisioned camera over Web Serial.</div>}
        {setup.testResults && <div className="setup-notice">{setup.testResults.message}</div>}
        {setup.localStreamUrl ? (
          <a className="secondary-button full" href={setup.localStreamUrl} target="_blank" rel="noreferrer">
            Open local live view
          </a>
        ) : null}
        {setup.error && <div className="action-error">{setup.error}</div>}
        <div className="setup-actions">
          <Link className="secondary-button" href="/setup/identify">Back</Link>
          <Link className={`primary-button${!setup.testResults ? " disabled" : ""}`} href={setup.testResults ? "/setup/complete" : "#"}>Review device</Link>
        </div>
      </section>
    </SetupShell>
  );
}
