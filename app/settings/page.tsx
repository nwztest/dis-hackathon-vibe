import { AppShell } from "@/components/AppShell";
import { requireCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireCurrentProfile("/settings");

  return (
    <AppShell profile={profile ?? undefined}>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Settings</h1>
            <p>Static controls for home profiles, alert behavior, responder access, and privacy policy.</p>
          </div>
          <button type="button">Save changes</button>
        </div>
        <section className="settings-grid">
          <SettingsPanel title="Home profiles" rows={["Block and unit required", "Senior phone required", "Medical details visible on alerts"]} />
          <SettingsPanel title="Room camera rules" rows={["Still frame analysis every 5 sec", "Live demo watches lying posture", "Room zones require calibration", "Blood detection disabled in live demo"]} />
          <SettingsPanel title="Shower ToF rules" rows={["No camera in shower", "Ignore small shuffled toiletries", "Large low blob opens suspicious", "Do not update baseline while large blob is present"]} />
          <SettingsPanel title="Notifications" rows={["Danger alerts: enabled", "Suspicious alerts: enabled", "Offline devices: after 90 sec"]} />
          <SettingsPanel title="Responder roles" rows={["Caregiver: acknowledge", "Family contact: call senior", "Admin: thresholds and devices"]} />
          <SettingsPanel title="Future modules" rows={["Microphone not required for MVP", "Voice distress can be added later", "No live video by default"]} />
        </section>
      </main>
    </AppShell>
  );
}

function SettingsPanel({ title, rows }: { title: string; rows: string[] }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      <ul className="plain-list">
        {rows.map((row) => <li key={row}>{row}</li>)}
      </ul>
    </article>
  );
}
