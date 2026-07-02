import Link from "next/link";
import { Camera, Clock3, ShowerHead, WifiOff, Wrench } from "lucide-react";
import { homeAddress, homeById, type Room } from "@/lib/mock-data";
import { StatusBadge } from "./Status";

export function RoomCard({ room }: { room: Room }) {
  const home = homeById(room.homeId);
  const Icon = room.type === "shower" ? ShowerHead : Camera;
  const supportIcon =
    room.status === "offline" ? <WifiOff size={18} /> : room.status === "maintenance" ? <Wrench size={18} /> : null;
  const normalText =
    room.type === "shower"
      ? room.occupied
        ? "Large body-like blob watch active."
        : "No large blob detected."
      : room.occupied
        ? `${room.personPosture ?? "Person"} on ${room.personLocation ?? "room area"}.`
        : "No person detected.";

  return (
    <Link className={`room-card ${room.status}`} href={`/rooms/${room.id}`}>
      <div className="room-card-top">
        <div>
          <h3>{room.name}</h3>
          <p>{home.seniorName} · {homeAddress(room.homeId)}</p>
        </div>
        <Icon size={22} />
      </div>
      <div className="room-card-body">
        <StatusBadge status={room.status} />
        {room.alertReason ? <p>{room.alertReason}</p> : <p>{normalText}</p>}
      </div>
      <div className="room-card-foot">
        <span><Clock3 size={14} /> {room.timeInStatus}</span>
        <span>{supportIcon} {room.lastSeen}</span>
      </div>
    </Link>
  );
}
