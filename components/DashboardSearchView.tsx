"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DashboardHomeGroup } from "@/components/DashboardHomeGroup";
import { DashboardStatusFilter, type DashboardStatusFilterKey } from "@/components/DashboardStatusFilter";
import { formatHomeAddress, type Room, type RoomStatus, type SeniorHome } from "@/lib/mock-data";

export function DashboardSearchView({
  canManageHomes,
  counts,
  homes,
  rooms,
}: {
  canManageHomes?: boolean;
  counts: Record<RoomStatus, number>;
  homes: SeniorHome[];
  rooms: Room[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilterKey>("all");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredHomeGroups = useMemo(() => {
    return homes.flatMap((home) => {
      const homeRooms = rooms.filter((room) => room.homeId === home.id);
      const statusFilteredRooms = statusFilter === "all" ? homeRooms : homeRooms.filter((room) => room.status === statusFilter);
      if (statusFilteredRooms.length === 0) return [];

      if (!normalizedQuery) return [{ home, rooms: statusFilteredRooms }];

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
        ...statusFilteredRooms.flatMap((room) => [
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

      return searchable.includes(normalizedQuery) ? [{ home, rooms: statusFilteredRooms }] : [];
    });
  }, [homes, normalizedQuery, rooms, statusFilter]);

  return (
    <>
      <DashboardStatusFilter
        activeFilter={statusFilter}
        counts={counts}
        onFilterChange={setStatusFilter}
        total={rooms.length}
      />
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
        <span>{filteredHomeGroups.length} of {homes.length} homes</span>
      </section>
      {filteredHomeGroups.length > 0 ? (
        <section className="home-group-list">
          {filteredHomeGroups.map(({ home, rooms: filteredRooms }) => (
            <DashboardHomeGroup
              canManageHomes={canManageHomes}
              home={home}
              homes={homes}
              rooms={filteredRooms}
              key={home.id}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No matching homes</h2>
          <p>Try another search term or status filter.</p>
        </section>
      )}
    </>
  );
}
