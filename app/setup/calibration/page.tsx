import Link from "next/link";
import { CheckCircle2, Move3D, Ruler, ShieldCheck } from "lucide-react";
import { SetupShell } from "@/components/SetupShell";

export default function SetupCalibrationPage() {
  return (
    <SetupShell currentStep={3}>
      <section className="setup-card narrow">
        <div className="section-heading">
          <h1>Calibrate sensors</h1>
          <p>Confirm the node is mounted and the room is empty before capturing orientation and floor-distance baselines.</p>
        </div>
        <ul className="setup-checklist">
          <li><CheckCircle2 size={16} /> Node mounted firmly, not dangling.</li>
          <li><CheckCircle2 size={16} /> VL53L5X faces downward or diagonally toward the floor.</li>
          <li><CheckCircle2 size={16} /> No person is inside the toilet or shower during baseline capture.</li>
        </ul>
        <div className="calibration-box">
          <ShieldCheck size={36} />
          <strong>Baseline capture ready</strong>
          <span>No camera, video, or resident identity data is used.</span>
        </div>
        <div className="metric-grid">
          <div className="metric"><Move3D size={18} /><span>BNO085 orientation</span><strong>Upright</strong></div>
          <div className="metric"><Ruler size={18} /><span>VL53L5X floor distance</span><strong>2.1 m</strong></div>
          <div className="metric"><ShieldCheck size={18} /><span>Calibration state</span><strong>Ready</strong></div>
        </div>
        <div className="setup-actions">
          <Link className="secondary-button" href="/setup/identify">Back</Link>
          <Link className="primary-button" href="/setup/complete">Next step</Link>
        </div>
      </section>
    </SetupShell>
  );
}
