import Link from "next/link";
import { AlertTriangle, Camera, Droplets, Move3D, Ruler, Timer } from "lucide-react";
import { acknowledgeAlertAction, resolveAlertAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Status";
import { getRoomDetail } from "@/lib/data";
import { formatHomeAddress } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room, home, alert, events } = await getRoomDetail(roomId);
  const hasAlert = room.status === "danger" || room.status === "suspicious";
  const isShower = room.type === "shower";

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <Link className="text-link" href="/dashboard">Back to dashboard</Link>
            <h1>{room.name}</h1>
            <p>{home.seniorName} · {formatHomeAddress(home)} · Device {room.deviceId}</p>
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
              <button type="button">Call senior</button>
              <button type="button">Call contact</button>
              {alert ? (
                <>
                  <form action={acknowledgeAlertAction.bind(null, alert.id)}>
                    <button type="submit">Acknowledge</button>
                  </form>
                  <form action={resolveAlertAction.bind(null, alert.id)}>
                    <button type="submit">Resolve</button>
                  </form>
                </>
              ) : null}
            </div>
          </section>
        ) : null}
        <section className="detail-grid">
          <article className="panel">
            <h2>Senior profile</h2>
            <dl className="definition-list">
              <div><dt>Name</dt><dd>{home.seniorName}</dd></div>
              <div><dt>Phone</dt><dd>{home.seniorPhone}</dd></div>
              <div><dt>Emergency contact</dt><dd>{home.emergencyContactName}</dd></div>
              <div><dt>Contact phone</dt><dd>{home.emergencyContactPhone}</dd></div>
              <div><dt>Medical details</dt><dd>{home.medicalDetails}</dd></div>
            </dl>
          </article>
          <article className="panel">
            <h2>Current situation</h2>
            <dl className="definition-list">
              <div><dt>Address</dt><dd>{formatHomeAddress(home)}</dd></div>
              <div><dt>Area</dt><dd>{room.type === "shower" ? "Shower" : "Room"}</dd></div>
              <div><dt>Time in status</dt><dd>{room.timeInStatus}</dd></div>
              <div><dt>Last device heartbeat</dt><dd>{room.lastSeen}</dd></div>
              <div><dt>Privacy mode</dt><dd>{isShower ? "Depth only, no camera" : "Still photos every 5 sec"}</dd></div>
            </dl>
          </article>
          <article className="panel wide">
            <h2>{isShower ? "Shower ToF summary" : "Room camera summary"}</h2>
            <div className="metric-grid">
              {isShower ? (
                <>
                  <Metric icon={<Droplets size={18} />} label="Changed zones" value={`${room.changedZoneCount ?? 0}`} />
                  <Metric icon={<Move3D size={18} />} label="Large blob" value={room.largeBlobDetected ? "Detected" : "No"} />
                  <Metric icon={<Ruler size={18} />} label="Floor distance" value={`${room.floorDistanceMm ?? 1700} mm`} />
                  <Metric icon={<Timer size={18} />} label="Baseline" value={room.baselineState ?? "Ready"} />
                </>
              ) : (
                <>
                  <Metric icon={<Camera size={18} />} label="Location" value={room.personLocation ?? "Unknown"} />
                  <Metric icon={<Move3D size={18} />} label="Posture" value={room.personPosture ?? "Unknown"} />
                  <Metric icon={<Timer size={18} />} label="Movement" value={room.movement ?? "Unknown"} />
                  <Metric icon={<AlertTriangle size={18} />} label="Blood" value={room.bloodDetected ? "Detected" : "No"} />
                </>
              )}
            </div>
          </article>
          <article className="panel full">
            <h2>Event timeline</h2>
            <ol className="timeline">
              {events.map((event) => (
                <li key={event.id}><strong>{event.eventTime}</strong><span>{event.reason}</span></li>
              ))}
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
