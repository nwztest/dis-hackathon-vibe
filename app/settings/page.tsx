import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Settings</h1>
            <p>Static controls for facility defaults, alert behavior, staff access, and privacy policy.</p>
          </div>
          <button type="button">Save changes</button>
        </div>
        <section className="settings-grid">
          <SettingsPanel title="Facility profile" rows={["One Care @ Jurong Spring", "Floors 1-2", "Toilets and showers only"]} />
          <SettingsPanel title="Detection thresholds" rows={["Impact threshold: 2.5g", "Orientation change: 45 deg", "Stillness: 5 sec", "Floor distance: 700 mm"]} />
          <SettingsPanel title="Notifications" rows={["Danger alerts: enabled", "Suspicious alerts: enabled", "Offline devices: after 90 sec"]} />
          <SettingsPanel title="Staff roles" rows={["Caregiver: acknowledge", "Nurse: resolve", "Admin: thresholds and devices"]} />
          <SettingsPanel title="Privacy" rows={["No camera feed", "No resident identity on room screens", "Telemetry retained as mock data only"]} />
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
