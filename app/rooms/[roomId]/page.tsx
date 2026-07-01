import Link from "next/link";
import { Activity, AlertTriangle, RotateCcw, Ruler, Timer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Status";
import { roomById } from "@/lib/mock-data";

export default async function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = roomById(roomId);
  const hasAlert = room.status === "danger" || room.status === "suspicious";

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <Link className="text-link" href="/dashboard">Back to dashboard</Link>
            <h1>{room.name}</h1>
            <p>{room.floor} · {room.type} · Device {room.deviceId}</p>
          </div>
          <StatusBadge status={room.status} />
        </div>
        {hasAlert ? (
          <section className={`alert-panel ${room.status}`}>
            <div>
              <AlertTriangle size={22} />
              <div>
                <h2>{room.status === "danger" ? "Active danger alert" : "Suspicious pattern under review"}</h2>
                <p>{room.alertReason}</p>
              </div>
            </div>
            <div className="button-row">
              <button type="button">Acknowledge</button>
              <button type="button">Resolve</button>
              <button type="button">Reset</button>
            </div>
          </section>
        ) : null}
        <section className="detail-grid">
          <article className="panel">
            <h2>Current situation</h2>
            <dl className="definition-list">
              <div><dt>Occupancy</dt><dd>{room.occupied ? "Occupied" : "Unoccupied"}</dd></div>
              <div><dt>Time in status</dt><dd>{room.timeInStatus}</dd></div>
              <div><dt>Last device heartbeat</dt><dd>{room.lastSeen}</dd></div>
              <div><dt>Privacy mode</dt><dd>Sensor-only</dd></div>
            </dl>
          </article>
          <article className="panel wide">
            <h2>Sensor summary</h2>
            <div className="metric-grid">
              <Metric icon={<Activity size={18} />} label="Acceleration peak" value={`${room.accelPeakG ?? 1.02}g`} />
              <Metric icon={<RotateCcw size={18} />} label="Orientation change" value={`${room.angleChangeDeg ?? 8} deg`} />
              <Metric icon={<Timer size={18} />} label="Stillness" value={`${room.stillnessSeconds ?? 0}s`} />
              <Metric icon={<Ruler size={18} />} label="Floor distance" value={`${room.floorDistanceMm ?? 1100} mm`} />
            </div>
          </article>
          <article className="panel full">
            <h2>Event timeline</h2>
            <ol className="timeline">
              <li><strong>08:42</strong><span>Impact spike detected by BNO085.</span></li>
              <li><strong>08:42</strong><span>Orientation changed from upright baseline.</span></li>
              <li><strong>08:42</strong><span>VL53L5X reading confirmed near-floor distance.</span></li>
              <li><strong>08:43</strong><span>Dashboard alert created for staff response.</span></li>
            </ol>
          </article>
        </section>
      </main>
    </AppShell>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
