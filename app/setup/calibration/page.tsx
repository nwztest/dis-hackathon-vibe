import Link from "next/link";
import { CheckCircle2, Move3D, Ruler, ShieldCheck } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupCalibrationPage() {
  await requireCurrentProfile("/setup/calibration");

  return (
    <SetupShell currentStep={3}>
      <section className="setup-card narrow">
        <div className="section-heading">
          <h1>Calibrate sensors</h1>
          <p>Confirm the area is empty before capturing the room camera reference or shower depth baseline.</p>
        </div>
        <ul className="setup-checklist">
          <li><CheckCircle2 size={16} /> Room camera sees bed, sofa, chair, and floor zones clearly.</li>
          <li><CheckCircle2 size={16} /> Shower VL53L5X faces downward or diagonally toward the floor.</li>
          <li><CheckCircle2 size={16} /> No person is inside the room or shower during baseline capture.</li>
          <li><CheckCircle2 size={16} /> Small shower toiletries may remain; large blob changes should not be learned as baseline.</li>
        </ul>
        <div className="calibration-box">
          <ShieldCheck size={36} />
          <strong>Baseline capture ready</strong>
          <span>Room cameras analyze still photos only. Showers remain depth-only.</span>
        </div>
        <div className="metric-grid">
          <div className="metric"><Move3D size={18} /><span>Room zones</span><strong>Mapped</strong></div>
          <div className="metric"><Ruler size={18} /><span>Shower floor distance</span><strong>1.7 m</strong></div>
          <div className="metric"><ShieldCheck size={18} /><span>Clutter tolerance</span><strong>Enabled</strong></div>
        </div>
        <div className="setup-actions">
          <Link className="secondary-button" href="/setup/identify">Back</Link>
          <Link className="primary-button" href="/setup/complete">Next step</Link>
        </div>
      </section>
    </SetupShell>
  );
}
