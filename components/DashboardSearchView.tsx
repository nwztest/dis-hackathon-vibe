"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DashboardHomeGroup } from "@/components/DashboardHomeGroup";
import { formatHomeAddress, type Room, type SeniorHome } from "@/lib/mock-data";

export function DashboardSearchView({
  homes,
  rooms,
}: {
  homes: SeniorHome[];
  rooms: Room[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredHomes = useMemo(() => {
    if (!normalizedQuery) return homes;

    return homes.filter((home) => {
      const homeRooms = rooms.filter((room) => room.homeId === home.id);
      const searchable = [
        home.seniorName,
        home.seniorPhone,
        home.emergencyContactName,
        home.emergencyContactPhone,
        home.medicalDetails,
        home.blockNumber,
        home.unitNumber,
        home.address,
        formatHomeAddress(home),
        ...homeRooms.flatMap((room) => [
          room.name,
          room.type,
          room.status,
          room.deviceId,
          room.deviceType,
          room.alertReason ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [homes, normalizedQuery, rooms]);

  return (
    <>
      <section className="dashboard-search-panel" aria-label="Search homes">
        <div className="search-row">
          <Search size={18} />
          <input
            aria-label="Search by senior name, address, block, unit, phone, or room"
            placeholder="Search name, address, block, unit, phone, or room"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span>{filteredHomes.length} of {homes.length} homes</span>
      </section>
      {filteredHomes.length > 0 ? (
        <section className="home-group-list">
          {filteredHomes.map((home) => (
            <DashboardHomeGroup
              home={home}
              homes={homes}
              rooms={rooms.filter((room) => room.homeId === home.id)}
              key={home.id}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No matching homes</h2>
          <p>Try a senior name, block number, unit number, address, phone number, or room name.</p>
        </section>
      )}
    </>
  );
}
