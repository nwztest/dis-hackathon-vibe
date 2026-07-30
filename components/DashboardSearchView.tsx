"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DashboardHomeGroup } from "@/components/DashboardHomeGroup";
import { DashboardStatusFilter, type DashboardStatusFilterKey } from "@/components/DashboardStatusFilter";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { formatHomeAddress, type Room, type RoomStatus, type SeniorHome } from "@/lib/mock-data";

const dashboardRefreshIntervalMs = 5_000;

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilterKey>("all");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!hasSupabaseEnv()) return;

    const refreshDashboard = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    // A prefetched dashboard response can predate the latest camera result.
    refreshDashboard();
    const intervalId = window.setInterval(refreshDashboard, dashboardRefreshIntervalMs);
    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", refreshDashboard);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshDashboard);
      document.removeEventListener("visibilitychange", refreshDashboard);
    };
  }, [router]);

  const filteredHomeGroups = useMemo(() => {
    return homes.flatMap((home) => {
      const homeRooms = rooms.filter((room) => room.homeId === home.id);
      const statusFilteredRooms = statusFilter === "all" ? homeRooms : homeRooms.filter((room) => room.status === statusFilter);
      if (statusFilter !== "all" && statusFilteredRooms.length === 0) return [];

      if (!normalizedQuery) return [{ home, roomCount: homeRooms.length, rooms: statusFilteredRooms }];

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

      return searchable.includes(normalizedQuery)
        ? [{ home, roomCount: homeRooms.length, rooms: statusFilteredRooms }]
        : [];
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
          {filteredHomeGroups.map(({ home, roomCount, rooms: filteredRooms }) => (
            <DashboardHomeGroup
              canManageHomes={canManageHomes}
              home={home}
              homes={homes}
              roomCount={roomCount}
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
