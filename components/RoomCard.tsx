import Link from "next/link";
import { Clock3, ShowerHead, Toilet, WifiOff, Wrench } from "lucide-react";
import type { Room } from "@/lib/mock-data";
import { StatusBadge } from "./Status";

export function RoomCard({ room }: { room: Room }) {
  const Icon = room.type === "shower" ? ShowerHead : Toilet;
  const supportIcon =
    room.status === "offline" ? <WifiOff size={18} /> : room.status === "maintenance" ? <Wrench size={18} /> : null;

  return (
    <Link className={`room-card ${room.status}`} href={`/rooms/${room.id}`}>
      <div className="room-card-top">
        <div>
          <h3>{room.name}</h3>
          <p>{room.floor} · {room.type}</p>
        </div>
        <Icon size={22} />
      </div>
      <div className="room-card-body">
        <StatusBadge status={room.status} />
        {room.alertReason ? <p>{room.alertReason}</p> : <p>{room.occupied ? "Normal movement detected." : "No occupancy detected."}</p>}
      </div>
      <div className="room-card-foot">
        <span><Clock3 size={14} /> {room.timeInStatus}</span>
        <span>{supportIcon} {room.lastSeen}</span>
      </div>
    </Link>
  );
}
