import Link from "next/link";
import { Home, Search } from "lucide-react";
import { homeAddress, homes, rooms } from "@/lib/mock-data";

export default function HomesPage() {
  return (
    <main className="linear-page">
      <section className="linear-header">
        <h1>CareGuard</h1>
        <p>Select a senior home to monitor rooms and showers.</p>
      </section>
      <div className="search-row">
        <Search size={18} />
        <input placeholder="Search by senior name, block, unit, or phone" />
      </div>
      <section className="home-grid">
        {homes.map((home) => {
          const homeRooms = rooms.filter((room) => room.homeId === home.id);
          const openAlerts = homeRooms.filter((room) => room.status === "danger" || room.status === "suspicious").length;
          return (
            <article className="home-card" key={home.id}>
              <div className="home-card-top">
                <div>
                  <h2>{home.seniorName}</h2>
                  <p>{homeAddress(home.id)} · {home.address}</p>
                </div>
                <Home size={24} />
              </div>
              <dl className="two-stat-grid">
                <div>
                  <dt>Phone</dt>
                  <dd>{home.seniorPhone}</dd>
                </div>
                <div>
                  <dt>Open alerts</dt>
                  <dd>{openAlerts}</dd>
                </div>
              </dl>
              <p>{home.medicalDetails}</p>
              <Link className="primary-button full" href="/dashboard">Continue to dashboard</Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
