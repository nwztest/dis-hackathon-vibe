import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Gauge,
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

export type RoomType = "toilet" | "shower";

export type Room = {
  id: string;
  name: string;
  type: RoomType;
  floor: string;
  status: RoomStatus;
  occupied: boolean;
  timeInStatus: string;
  lastSeen: string;
  deviceId: string;
  alertReason?: string;
  confidence?: number;
  accelPeakG?: number;
  angleChangeDeg?: number;
  floorDistanceMm?: number;
  stillnessSeconds?: number;
};

export type AlertStatus = "open" | "acknowledged" | "resolved";

export type AlertRecord = {
  id: string;
  roomId: string;
  severity: "suspicious" | "danger";
  status: AlertStatus;
  openedAt: string;
  reason: string;
  confidence: number;
  stillnessSeconds: number;
  floorDistanceMm: number;
  angleChangeDeg: number;
  accelPeakG: number;
  acknowledgedBy?: string;
};

export const facilities = [
  {
    id: "onecare",
    name: "One Care @ Jurong Spring",
    address: "123 Elm St, Springfield",
    activeRooms: 18,
    openAlerts: 2,
  },
  {
    id: "pinecrest",
    name: "Pinecrest Memory Care",
    address: "456 Pine Ave, Boulder",
    activeRooms: 12,
    openAlerts: 0,
  },
  {
    id: "maple",
    name: "Maple Grove Estates",
    address: "789 Maple Blvd, Austin",
    activeRooms: 24,
    openAlerts: 1,
  },
];

export const rooms: Room[] = [
  {
    id: "toilet-01",
    name: "Toilet 01",
    type: "toilet",
    floor: "Floor 1",
    status: "unoccupied",
    occupied: false,
    timeInStatus: "12 min",
    lastSeen: "14 sec ago",
    deviceId: "ESP32-T01",
  },
  {
    id: "shower-01",
    name: "Shower 01",
    type: "shower",
    floor: "Floor 1",
    status: "danger",
    occupied: true,
    timeInStatus: "2 min",
    lastSeen: "5 sec ago",
    deviceId: "ESP32-S01",
    alertReason: "Impact, orientation change, stillness, and near-floor distance confirmed.",
    confidence: 91,
    accelPeakG: 3.4,
    angleChangeDeg: 72,
    floorDistanceMm: 420,
    stillnessSeconds: 8,
  },
  {
    id: "toilet-02",
    name: "Toilet 02",
    type: "toilet",
    floor: "Floor 1",
    status: "occupied",
    occupied: true,
    timeInStatus: "5 min",
    lastSeen: "11 sec ago",
    deviceId: "ESP32-T02",
  },
  {
    id: "shower-02",
    name: "Shower 02",
    type: "shower",
    floor: "Floor 1",
    status: "suspicious",
    occupied: true,
    timeInStatus: "38 sec",
    lastSeen: "8 sec ago",
    deviceId: "ESP32-S02",
    alertReason: "Possible fall pattern detected; confirmation delay is still running.",
    confidence: 68,
    accelPeakG: 2.8,
    angleChangeDeg: 51,
    floorDistanceMm: 610,
    stillnessSeconds: 3,
  },
  {
    id: "toilet-03",
    name: "Toilet 03",
    type: "toilet",
    floor: "Floor 2",
    status: "offline",
    occupied: false,
    timeInStatus: "7 min",
    lastSeen: "9 min ago",
    deviceId: "ESP32-T03",
  },
  {
    id: "shower-03",
    name: "Shower 03",
    type: "shower",
    floor: "Floor 2",
    status: "maintenance",
    occupied: false,
    timeInStatus: "22 min",
    lastSeen: "1 min ago",
    deviceId: "ESP32-S03",
  },
];

export const alerts: AlertRecord[] = [
  {
    id: "alert-1001",
    roomId: "shower-01",
    severity: "danger",
    status: "open",
    openedAt: "08:42",
    reason: "Impact + orientation change + stillness + near-floor reading",
    confidence: 91,
    stillnessSeconds: 8,
    floorDistanceMm: 420,
    angleChangeDeg: 72,
    accelPeakG: 3.4,
  },
  {
    id: "alert-1002",
    roomId: "shower-02",
    severity: "suspicious",
    status: "open",
    openedAt: "08:45",
    reason: "Impact and orientation change detected; confirmation pending",
    confidence: 68,
    stillnessSeconds: 3,
    floorDistanceMm: 610,
    angleChangeDeg: 51,
    accelPeakG: 2.8,
  },
  {
    id: "alert-0998",
    roomId: "toilet-02",
    severity: "suspicious",
    status: "resolved",
    openedAt: "07:55",
    reason: "Long occupancy with low motion",
    confidence: 61,
    stillnessSeconds: 4,
    floorDistanceMm: 780,
    angleChangeDeg: 22,
    accelPeakG: 1.4,
    acknowledgedBy: "Nurse Tan",
  },
];

export const devices = [
  {
    id: "ESP32-T01",
    roomId: "toilet-01",
    firmware: "0.1.0",
    status: "online",
    heartbeat: "14 sec ago",
    signal: "-63 dBm",
    hardware: "ESP32 + BNO085 + VL53L5X",
  },
  {
    id: "ESP32-S01",
    roomId: "shower-01",
    firmware: "0.1.0",
    status: "online",
    heartbeat: "5 sec ago",
    signal: "-61 dBm",
    hardware: "ESP32 + BNO085 + VL53L5X",
  },
  {
    id: "ESP32-S02",
    roomId: "shower-02",
    firmware: "0.1.0",
    status: "online",
    heartbeat: "8 sec ago",
    signal: "-67 dBm",
    hardware: "ESP32 + BNO085 + VL53L5X",
  },
  {
    id: "ESP32-T02",
    roomId: "toilet-02",
    firmware: "0.1.0",
    status: "online",
    heartbeat: "11 sec ago",
    signal: "-65 dBm",
    hardware: "ESP32 + BNO085 + VL53L5X",
  },
  {
    id: "ESP32-T03",
    roomId: "toilet-03",
    firmware: "0.1.0",
    status: "offline",
    heartbeat: "9 min ago",
    signal: "No heartbeat",
    hardware: "ESP32 + BNO085 + VL53L5X",
  },
  {
    id: "ESP32-S03",
    roomId: "shower-03",
    firmware: "0.1.0",
    status: "maintenance",
    heartbeat: "1 min ago",
    signal: "-58 dBm",
    hardware: "ESP32 + BNO085 + VL53L5X",
  },
];

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/devices", label: "Devices", icon: Wifi },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const setupSteps = [
  { href: "/setup/select-room", label: "Select target" },
  { href: "/setup/identify", label: "Pair node" },
  { href: "/setup/calibration", label: "Calibrate sensors" },
  { href: "/setup/complete", label: "Verify" },
];

export const iconMap = {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LogOut,
  ShieldCheck,
  ShowerHead,
  SlidersHorizontal,
  UserRound,
  WifiOff,
  Wrench,
};

export function roomById(roomId: string) {
  return rooms.find((room) => room.id === roomId) ?? rooms[0];
}

export function roomLabel(roomId: string) {
  return roomById(roomId).name;
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
