import Link from "next/link";
import { Camera, Phone, ShowerHead, WifiOff, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/Status";
import { AddRoomButton } from "@/components/DashboardModals";
import { formatHomeAddress, type Room, type RoomStatus, type SeniorHome } from "@/lib/mock-data";

const statusRank: Record<RoomStatus, number> = {
  danger: 5,
  suspicious: 4,
  offline: 3,
  maintenance: 2,
  occupied: 1,
  unoccupied: 0,
};

export function DashboardHomeGroup({
  home,
  homes,
  rooms,
}: {
  home: SeniorHome;
  homes: SeniorHome[];
  rooms: Room[];
}) {
  const openAlertRooms = rooms.filter((room) => room.status === "danger" || room.status === "suspicious");
  const firstAlertRoom = openAlertRooms[0];
  const worstStatus = rooms.reduce<RoomStatus>(
    (current, room) => (statusRank[room.status] > statusRank[current] ? room.status : current),
    "unoccupied",
  );

  return (
    <section className={`home-group ${worstStatus}`}>
      <div className="home-group-head">
        <div>
          <h2>{home.seniorName}</h2>
          <p>{formatHomeAddress(home)} · {home.address}</p>
        </div>
        <div className="home-group-status">
          <StatusBadge status={worstStatus} />
          <span>{openAlertRooms.length} open alerts</span>
        </div>
      </div>
      <div className="home-group-meta">
        <span>{home.seniorPhone}</span>
        <span>{home.medicalDetails}</span>
      </div>
      <div className="home-group-actions">
        <button type="button"><Phone size={16} /> Call</button>
        <AddRoomButton homes={homes} defaultHomeId={home.id} variant="secondary" />
        {firstAlertRoom ? (
          <Link className="secondary-button" href={`/rooms/${firstAlertRoom.id}`}>Open first alert</Link>
        ) : (
          <span className="quiet-action">No open alert</span>
        )}
      </div>
      <div className="nested-room-list">
        {rooms.map((room) => (
          <NestedRoomRow room={room} key={room.id} />
        ))}
      </div>
    </section>
  );
}

function NestedRoomRow({ room }: { room: Room }) {
  const Icon = room.type === "shower" ? ShowerHead : Camera;
  const supportIcon =
    room.status === "offline" ? <WifiOff size={16} /> : room.status === "maintenance" ? <Wrench size={16} /> : null;
  const evidence =
    room.alertReason ??
    (room.type === "shower"
      ? room.occupied
        ? "Large body-like blob watch active."
        : "No large blob detected."
      : room.occupied
        ? `${room.personPosture ?? "Person"} on ${room.personLocation ?? "room area"}.`
        : "No person detected.");

  return (
    <article className={`nested-room-row ${room.status}`}>
      <div className="nested-room-main">
        <Icon size={18} />
        <div>
          <h3>{room.name}</h3>
          <span>{room.deviceType === "tof_shower" ? "Shower ToF" : "Room camera"}</span>
        </div>
      </div>
      <StatusBadge status={room.status} />
      <p>{evidence}</p>
      <div className="nested-room-meta">
        <span>{room.timeInStatus}</span>
        <span>{supportIcon} {room.lastSeen}</span>
      </div>
      <Link className="text-link" href={`/rooms/${room.id}`}>Open</Link>
    </article>
  );
}
