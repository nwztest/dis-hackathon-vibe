import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { facilities } from "@/lib/mock-data";

export default function FacilitiesPage() {
  return (
    <main className="linear-page">
      <section className="linear-header">
        <h1>CareGuard</h1>
        <p>Select a facility to monitor toilets and showers.</p>
      </section>
      <div className="search-row">
        <Search size={18} />
        <input placeholder="Search facilities by name or address" />
      </div>
      <section className="facility-grid">
        {facilities.map((facility) => (
          <article className="facility-card" key={facility.id}>
            <div className="facility-card-top">
              <div>
                <h2>{facility.name}</h2>
                <p>{facility.address}</p>
              </div>
              <Building2 size={24} />
            </div>
            <dl className="two-stat-grid">
              <div>
                <dt>Active rooms</dt>
                <dd>{facility.activeRooms}</dd>
              </div>
              <div>
                <dt>Open alerts</dt>
                <dd>{facility.openAlerts}</dd>
              </div>
            </dl>
            <Link className="primary-button full" href="/dashboard">Continue to dashboard</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
