import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  ShowerHead,
  SlidersHorizontal,
  UserRound,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";

export type RoomStatus =
  | "unoccupied"
  | "occupied"
  | "suspicious"
  | "danger"
  | "offline"
  | "maintenance";

export type RoomType = "room" | "shower";
export type DeviceType = "room_camera" | "tof_shower" | "future_microphone";

export type SeniorHome = {
  id: string;
  seniorName: string;
  seniorPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalDetails: string;
  blockNumber: string;
  unitNumber: string;
  address: string;
};

export type Room = {
  id: string;
  homeId: string;
  name: string;
  type: RoomType;
  status: RoomStatus;
  occupied: boolean;
  timeInStatus: string;
  lastSeen: string;
  deviceId: string;
  deviceType: DeviceType;
  alertReason?: string;
  confidence?: number;
  personLocation?: "bed" | "sofa" | "chair" | "floor" | "unknown";
  personPosture?: "standing" | "sitting" | "lying" | "unknown";
  movement?: "none" | "small" | "active" | "unknown";
  faceExpression?: "neutral" | "negative" | "unknown";
  bloodDetected?: boolean;
  frameIntervalSeconds?: number;
  changedZoneCount?: number;
  largeBlobDetected?: boolean;
  floorDistanceMm?: number;
  baselineState?: string;
  noMovementDuration?: string;
};

export type AlertStatus = "open" | "acknowledged" | "resolved";

export type AlertRecord = {
  id: string;
  homeId: string;
  roomId: string;
  severity: "suspicious" | "danger";
  status: AlertStatus;
  openedAt: string;
  reason: string;
  confidence: number;
  duration: string;
  evidence: string;
  acknowledgedBy?: string;
};

export const homes: SeniorHome[] = [
  {
    id: "home-123-08-456",
    seniorName: "Tan Ah Kow",
    seniorPhone: "+65 9123 4567",
    emergencyContactName: "Tan Mei Ling",
    emergencyContactPhone: "+65 9876 5432",
    medicalDetails: "Diabetes, fall risk, mild hypertension",
    blockNumber: "123",
    unitNumber: "08-456",
    address: "Jurong West Street 41",
  },
  {
    id: "home-219-04-118",
    seniorName: "Mdm Siti Aminah",
    seniorPhone: "+65 9111 2408",
    emergencyContactName: "Nur Hidayah",
    emergencyContactPhone: "+65 9666 1204",
    medicalDetails: "Post-surgery mobility support, uses walking frame",
    blockNumber: "219",
    unitNumber: "04-118",
    address: "Tampines Street 24",
  },
  {
    id: "home-505-12-302",
    seniorName: "Lim Bee Choo",
    seniorPhone: "+65 9222 7788",
    emergencyContactName: "Lim Wei Han",
    emergencyContactPhone: "+65 9333 8877",
    medicalDetails: "History of fainting, lives alone",
    blockNumber: "505",
    unitNumber: "12-302",
    address: "Ang Mo Kio Avenue 8",
  },
];

export const rooms: Room[] = [
  {
    id: "bedroom-123",
    homeId: "home-123-08-456",
    name: "Bedroom",
    type: "room",
    status: "danger",
    occupied: true,
    timeInStatus: "1 min",
    lastSeen: "5 sec ago",
    deviceId: "CAM-BED-123",
    deviceType: "room_camera",
    alertReason: "Person lying on floor for more than 1 minute.",
    confidence: 92,
    personLocation: "floor",
    personPosture: "lying",
    movement: "small",
    faceExpression: "negative",
    bloodDetected: false,
    frameIntervalSeconds: 5,
  },
  {
    id: "living-123",
    homeId: "home-123-08-456",
    name: "Living room",
    type: "room",
    status: "occupied",
    occupied: true,
    timeInStatus: "34 min",
    lastSeen: "4 sec ago",
    deviceId: "CAM-LIV-123",
    deviceType: "room_camera",
    personLocation: "sofa",
    personPosture: "lying",
    movement: "small",
    faceExpression: "neutral",
    bloodDetected: false,
    frameIntervalSeconds: 5,
  },
  {
    id: "shower-123",
    homeId: "home-123-08-456",
    name: "Shower",
    type: "shower",
    status: "suspicious",
    occupied: true,
    timeInStatus: "42 sec",
    lastSeen: "7 sec ago",
    deviceId: "TOF-SHW-123",
    deviceType: "tof_shower",
    alertReason: "Large low blob detected; waiting for stability threshold.",
    confidence: 71,
    changedZoneCount: 24,
    largeBlobDetected: true,
    floorDistanceMm: 480,
    baselineState: "Clutter-tolerant baseline active",
  },
  {
    id: "bedroom-219",
    homeId: "home-219-04-118",
    name: "Bedroom",
    type: "room",
    status: "occupied",
    occupied: true,
    timeInStatus: "8 hr 20 min",
    lastSeen: "5 sec ago",
    deviceId: "CAM-BED-219",
    deviceType: "room_camera",
    personLocation: "bed",
    personPosture: "lying",
    movement: "small",
    faceExpression: "neutral",
    bloodDetected: false,
    frameIntervalSeconds: 5,
    noMovementDuration: "18 min",
  },
  {
    id: "shower-219",
    homeId: "home-219-04-118",
    name: "Shower",
    type: "shower",
    status: "unoccupied",
    occupied: false,
    timeInStatus: "16 min",
    lastSeen: "11 sec ago",
    deviceId: "TOF-SHW-219",
    deviceType: "tof_shower",
    changedZoneCount: 3,
    largeBlobDetected: false,
    floorDistanceMm: 1710,
    baselineState: "Small moved toiletries ignored",
  },
  {
    id: "living-505",
    homeId: "home-505-12-302",
    name: "Living room",
    type: "room",
    status: "offline",
    occupied: false,
    timeInStatus: "9 min",
    lastSeen: "9 min ago",
    deviceId: "CAM-LIV-505",
    deviceType: "room_camera",
  },
  {
    id: "shower-505",
    homeId: "home-505-12-302",
    name: "Shower",
    type: "shower",
    status: "maintenance",
    occupied: false,
    timeInStatus: "24 min",
    lastSeen: "1 min ago",
    deviceId: "TOF-SHW-505",
    deviceType: "tof_shower",
    baselineState: "Baseline refresh paused",
  },
];

export const alerts: AlertRecord[] = [
  {
    id: "alert-1001",
    homeId: "home-123-08-456",
    roomId: "bedroom-123",
    severity: "danger",
    status: "open",
    openedAt: "08:42",
    reason: "lying_on_floor_more_than_60_seconds",
    confidence: 92,
    duration: "1 min",
    evidence: "Bedroom camera classified lying posture on floor across 12 still frames.",
  },
  {
    id: "alert-1002",
    homeId: "home-123-08-456",
    roomId: "shower-123",
    severity: "suspicious",
    status: "open",
    openedAt: "08:45",
    reason: "large_low_blob_in_shower",
    confidence: 71,
    duration: "42 sec",
    evidence: "VL53L5X depth map shows a large low blob; small clutter changes are ignored.",
  },
  {
    id: "alert-0998",
    homeId: "home-219-04-118",
    roomId: "bedroom-219",
    severity: "suspicious",
    status: "resolved",
    openedAt: "07:55",
    reason: "no_movement_on_bed_sofa_chair_watch",
    confidence: 64,
    duration: "18 min",
    evidence: "Lying on bed is normal; long no-movement watch did not cross 12 hours.",
    acknowledgedBy: "Caregiver Lee",
  },
];

export const devices = [
  {
    id: "CAM-BED-123",
    roomId: "bedroom-123",
    firmware: "0.2.0",
    status: "online",
    heartbeat: "5 sec ago",
    signal: "-61 dBm",
    hardware: "Room camera, still frame every 5 sec",
    privacy: "Event snapshots only",
  },
  {
    id: "CAM-LIV-123",
    roomId: "living-123",
    firmware: "0.2.0",
    status: "online",
    heartbeat: "4 sec ago",
    signal: "-63 dBm",
    hardware: "Room camera, still frame every 5 sec",
    privacy: "No live video",
  },
  {
    id: "TOF-SHW-123",
    roomId: "shower-123",
    firmware: "0.1.1",
    status: "online",
    heartbeat: "7 sec ago",
    signal: "-67 dBm",
    hardware: "ESP32 + VL53L5X ToF",
    privacy: "No camera in shower",
  },
  {
    id: "CAM-BED-219",
    roomId: "bedroom-219",
    firmware: "0.2.0",
    status: "online",
    heartbeat: "5 sec ago",
    signal: "-58 dBm",
    hardware: "Room camera, still frame every 5 sec",
    privacy: "Event snapshots only",
  },
  {
    id: "TOF-SHW-219",
    roomId: "shower-219",
    firmware: "0.1.1",
    status: "online",
    heartbeat: "11 sec ago",
    signal: "-65 dBm",
    hardware: "ESP32 + VL53L5X ToF",
    privacy: "Clutter-tolerant depth only",
  },
  {
    id: "CAM-LIV-505",
    roomId: "living-505",
    firmware: "0.2.0",
    status: "offline",
    heartbeat: "9 min ago",
    signal: "No heartbeat",
    hardware: "Room camera, still frame every 5 sec",
    privacy: "No live video",
  },
  {
    id: "TOF-SHW-505",
    roomId: "shower-505",
    firmware: "0.1.1",
    status: "maintenance",
    heartbeat: "1 min ago",
    signal: "-59 dBm",
    hardware: "ESP32 + VL53L5X ToF",
    privacy: "No camera in shower",
  },
];

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/devices", label: "Devices", icon: Wifi },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const setupSteps = [
  { href: "/setup/select-room", label: "Select area" },
  { href: "/setup/identify", label: "Pair node" },
  { href: "/setup/calibration", label: "Calibrate" },
  { href: "/setup/complete", label: "Verify" },
];

export const iconMap = {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Home,
  LogOut,
  ShieldCheck,
  ShowerHead,
  SlidersHorizontal,
  UserRound,
  WifiOff,
  Wrench,
};

export function homeById(homeId: string) {
  return homes.find((home) => home.id === homeId) ?? homes[0];
}

export function roomById(roomId: string) {
  return rooms.find((room) => room.id === roomId) ?? rooms[0];
}

export function roomLabel(roomId: string) {
  const room = roomById(roomId);
  const home = homeById(room.homeId);
  return `${home.seniorName} · ${room.name}`;
}

export function homeAddress(homeId: string) {
  const home = homeById(homeId);
  return `Blk ${home.blockNumber}, #${home.unitNumber}`;
}

export function statusCounts() {
  return rooms.reduce<Record<RoomStatus, number>>(
    (counts, room) => {
      counts[room.status] += 1;
      return counts;
    },
    {
      unoccupied: 0,
      occupied: 0,
      suspicious: 0,
      danger: 0,
      offline: 0,
      maintenance: 0,
    },
  );
}
