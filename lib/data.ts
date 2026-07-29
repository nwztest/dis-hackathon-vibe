import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/auth";
import { deviceStatusFromHeartbeat } from "@/lib/device-ingestion";
import {
  alerts as mockAlerts,
  devices as mockDevices,
  homeById,
  homes as mockHomes,
  roomById,
  rooms as mockRooms,
  statusCounts as mockStatusCounts,
  type AlertRecord,
  type DeviceType,
  type Room,
  type RoomStatus,
  type RoomType,
  type SeniorHome,
} from "./mock-data";

export type DeviceRecord = {
  id: string;
  roomId: string;
  deviceType?: DeviceType;
  firmware: string;
  status: string;
  heartbeat: string;
  signal: string;
  hardware: string;
  privacy: string;
  cameraProfile?: string;
  captureIntervalMs?: number;
  configuredAt?: string;
  lastSeenAt?: string;
};

export type RoomStatusEvent = {
  id: string;
  roomId: string;
  status: RoomStatus;
  reason: string;
  confidence?: number;
  eventTime: string;
};

export type UserProfileRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
};

type HomeRow = {
  id: string;
  senior_name: string;
  senior_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_details: string | null;
  block_number: string;
  unit_number: string;
  address: string | null;
};

type RoomRow = {
  id: string;
  home_id: string;
  name: string;
  type: RoomType;
  current_status: RoomStatus;
  occupied: boolean;
  time_in_status: string | null;
  status_metadata?: Record<string, unknown> | null;
};

type DeviceRow = {
  id: string;
  room_id: string;
  device_uid: string;
  device_type: DeviceType;
  status: string;
  firmware_version: string | null;
  last_seen_at: string | null;
  heartbeat_label: string | null;
  signal_label: string | null;
  hardware: string | null;
  privacy: string | null;
  camera_profile?: string | null;
  capture_interval_ms?: number | null;
  configured_at?: string | null;
};

type AlertRow = {
  id: string;
  home_id: string;
  room_id: string;
  severity: "suspicious" | "danger";
  status: "open" | "acknowledged" | "resolved";
  opened_at: string;
  reason: string | null;
  confidence: number | null;
  duration: string | null;
  evidence: string | null;
  acknowledged_by: string | null;
};

type EventRow = {
  id: number;
  room_id: string;
  status: RoomStatus;
  reason: string | null;
  confidence: number | null;
  event_time: string;
};

type UserProfileRow = {
  id: string;
  name: string | null;
  email?: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

export async function getDashboardData() {
  if (!hasSupabaseEnv()) {
    return {
      homes: mockHomes,
      rooms: mockRooms,
      alerts: mockAlerts,
      counts: mockStatusCounts(),
    };
  }

  const [homes, rooms, alerts] = await Promise.all([getHomes(), getRooms(), getAlerts()]);
  return {
    homes,
    rooms,
    alerts,
    counts: countStatuses(rooms),
  };
}

export async function getHomes(): Promise<SeniorHome[]> {
  if (!hasSupabaseEnv()) return mockHomes;
  const supabase = await createClient();
  const { data, error } = await supabase.from("homes").select("*").order("senior_name");
  if (error) throw error;
  return ((data ?? []) as HomeRow[]).map(mapHome);
}

export async function getRooms(): Promise<Room[]> {
  if (!hasSupabaseEnv()) return mockRooms;
  const supabase = await createClient();
  const [{ data: rooms, error: roomError }, { data: devices, error: deviceError }, { data: alerts, error: alertError }] =
    await Promise.all([
      supabase.from("rooms").select("*").order("created_at"),
      supabase.from("devices").select("*"),
      supabase.from("alerts").select("*").eq("status", "open"),
    ]);
  if (roomError) throw roomError;
  if (deviceError) throw deviceError;
  if (alertError) throw alertError;

  const deviceByRoom = new Map(((devices ?? []) as DeviceRow[]).map((device) => [device.room_id, device]));
  const alertByRoom = new Map(((alerts ?? []) as AlertRow[]).map((alert) => [alert.room_id, alert]));

  return ((rooms ?? []) as RoomRow[]).map((room) => mapRoom(room, deviceByRoom.get(room.id), alertByRoom.get(room.id)));
}

export async function getAlerts(): Promise<AlertRecord[]> {
  if (!hasSupabaseEnv()) return mockAlerts;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AlertRow[])
    .map(mapAlert)
    .sort((a, b) => alertStatusRank(a.status) - alertStatusRank(b.status));
}

export async function getDevices(): Promise<DeviceRecord[]> {
  if (!hasSupabaseEnv()) return mockDevices;
  const supabase = await createClient();
  const { data, error } = await supabase.from("devices").select("*").order("device_uid");
  if (error) throw error;
  return ((data ?? []) as DeviceRow[]).map(mapDevice);
}

export async function getUserProfiles(): Promise<UserProfileRecord[]> {
  if (!hasSupabaseEnv()) {
    return [
      {
        id: "prototype-user",
        name: "Prototype admin",
        email: "mock-data@careguard.local",
        phone: "",
        role: "admin",
        createdAt: "Prototype",
      },
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, phone, role, created_at")
    .order("created_at", { ascending: false });

  if (isMissingColumnError(error, "email")) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, name, phone, role, created_at")
      .order("created_at", { ascending: false });

    if (fallbackError) throw fallbackError;
    return ((fallbackData ?? []) as UserProfileRow[]).map((profile) => mapUserProfile(profile, "Migration needed"));
  }

  if (error) throw error;
  return ((data ?? []) as UserProfileRow[]).map((profile) => mapUserProfile(profile));
}

function mapUserProfile(profile: UserProfileRow, fallbackEmail = "No email"): UserProfileRecord {
  return {
    id: profile.id,
    name: profile.name || "Unnamed user",
    email: profile.email || fallbackEmail,
    phone: profile.phone || "",
    role: profile.role,
    createdAt: formatDateTime(profile.created_at),
  };
}

function isMissingColumnError(error: SupabaseError | null, columnName: string) {
  return Boolean(error?.code === "42703" && error.message?.includes(columnName));
}

export async function getRoomDetail(roomId: string) {
  if (!hasSupabaseEnv()) {
    const room = roomById(roomId);
    return {
      room,
      home: homeById(room.homeId),
      device: mockDevices.find((device) => device.roomId === room.id),
      alert: mockAlerts.find((alert) => alert.roomId === room.id && alert.status === "open"),
      events: mockTimeline(room),
    };
  }

  const supabase = await createClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError) throw roomError;

  const roomRow = room as RoomRow;
  const [{ data: home, error: homeError }, { data: device }, { data: alert }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase.from("homes").select("*").eq("id", roomRow.home_id).single(),
      supabase.from("devices").select("*").eq("room_id", roomRow.id).maybeSingle(),
      supabase.from("alerts").select("*").eq("room_id", roomRow.id).eq("status", "open").maybeSingle(),
      supabase.from("room_status_events").select("*").eq("room_id", roomRow.id).order("event_time", { ascending: false }).limit(8),
    ]);
  if (homeError) throw homeError;
  if (eventsError) throw eventsError;

  const mappedDevice = device ? mapDevice(device as DeviceRow) : undefined;
  const mappedAlert = alert ? mapAlert(alert as AlertRow) : undefined;

  return {
    room: mapRoom(roomRow, device as DeviceRow | null, alert as AlertRow | null),
    home: mapHome(home as HomeRow),
    device: mappedDevice,
    alert: mappedAlert,
    events: ((events ?? []) as EventRow[]).map(mapEvent),
  };
}

export function countStatuses(rooms: Room[]) {
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

function mapHome(row: HomeRow): SeniorHome {
  return {
    id: row.id,
    seniorName: row.senior_name,
    seniorPhone: row.senior_phone ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    medicalDetails: row.medical_details ?? "",
    blockNumber: row.block_number,
    unitNumber: row.unit_number,
    address: row.address ?? "",
  };
}

function mapRoom(row: RoomRow, device?: DeviceRow | null, alert?: AlertRow | null): Room {
  const metadata = row.status_metadata ?? {};
  const deviceStatus = device
    ? deviceStatusFromHeartbeat(device.status, device.last_seen_at)
    : "offline";
  const hasActiveSafetyStatus =
    Boolean(alert) && (row.current_status === "danger" || row.current_status === "suspicious");
  const status: RoomStatus =
    deviceStatus === "maintenance"
      ? "maintenance"
      : (deviceStatus === "offline" || deviceStatus === "unassigned") && !hasActiveSafetyStatus
        ? "offline"
        : row.current_status;

  return {
    id: row.id,
    homeId: row.home_id,
    name: row.name,
    type: row.type,
    status,
    occupied: status === "offline" || status === "maintenance" ? false : row.occupied,
    timeInStatus: row.time_in_status ?? "Just now",
    lastSeen: heartbeatFromTimestamp(device?.last_seen_at ?? null, device?.heartbeat_label ?? null),
    deviceId: device?.device_uid ?? "Unassigned",
    deviceType: device?.device_type ?? (row.type === "shower" ? "tof_shower" : "room_camera"),
    alertReason: alert?.evidence ?? alert?.reason ?? undefined,
    confidence: alert?.confidence ?? undefined,
    personLocation: stringMetadata(metadata, "personLocation") as Room["personLocation"],
    personPosture: stringMetadata(metadata, "personPosture") as Room["personPosture"],
    movement: stringMetadata(metadata, "movement") as Room["movement"],
    faceExpression: stringMetadata(metadata, "faceExpression") as Room["faceExpression"],
    bloodDetected: booleanMetadata(metadata, "bloodDetected"),
    frameIntervalSeconds: numberMetadata(metadata, "frameIntervalSeconds"),
    changedZoneCount: numberMetadata(metadata, "changedZoneCount"),
    largeBlobDetected: booleanMetadata(metadata, "largeBlobDetected"),
    floorDistanceMm: numberMetadata(metadata, "floorDistanceMm"),
    baselineState: stringMetadata(metadata, "baselineState"),
    noMovementDuration: stringMetadata(metadata, "noMovementDuration"),
  };
}

function mapAlert(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    homeId: row.home_id,
    roomId: row.room_id,
    severity: row.severity,
    status: row.status,
    openedAt: formatTime(row.opened_at),
    reason: row.reason ?? "",
    confidence: Number(row.confidence ?? 0),
    duration: row.duration ?? "",
    evidence: row.evidence ?? "",
    acknowledgedBy: row.acknowledged_by ?? undefined,
  };
}

function alertStatusRank(status: AlertRecord["status"]) {
  if (status === "open") return 0;
  if (status === "acknowledged") return 1;
  return 2;
}

function mapDevice(row: DeviceRow): DeviceRecord {
  return {
    id: row.device_uid,
    roomId: row.room_id,
    deviceType: row.device_type,
    firmware: row.firmware_version ?? "",
    status: deviceStatusFromHeartbeat(row.status, row.last_seen_at),
    heartbeat: heartbeatFromTimestamp(row.last_seen_at, row.heartbeat_label),
    signal: row.signal_label ?? "",
    hardware: row.hardware ?? "",
    privacy: row.privacy ?? "",
    cameraProfile: row.camera_profile ?? undefined,
    captureIntervalMs: row.capture_interval_ms ?? undefined,
    configuredAt: row.configured_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
  };
}

function heartbeatFromTimestamp(value: string | null, fallback: string | null) {
  if (!value) return fallback ?? "No heartbeat";
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(elapsedSeconds)) return fallback ?? "No heartbeat";
  if (elapsedSeconds < 5) return "Just now";
  if (elapsedSeconds < 60) return `${elapsedSeconds} sec ago`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function mapEvent(row: EventRow): RoomStatusEvent {
  return {
    id: String(row.id),
    roomId: row.room_id,
    status: row.status,
    reason: row.reason ?? "",
    confidence: row.confidence ?? undefined,
    eventTime: formatTime(row.event_time),
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  }).format(new Date(value));
}

function stringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function numberMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" ? value : undefined;
}

function booleanMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "boolean" ? value : undefined;
}

function mockTimeline(room: Room): RoomStatusEvent[] {
  if (room.type === "shower") {
    return [
      { id: "1", roomId: room.id, status: room.status, reason: "Depth map compared against clutter-tolerant empty-shower baseline.", eventTime: "08:42" },
      { id: "2", roomId: room.id, status: room.status, reason: "Small shuffled toiletries ignored; large low blob remained visible.", eventTime: "08:43" },
      { id: "3", roomId: room.id, status: room.status, reason: "Status held at suspicious until the duration threshold is crossed.", eventTime: "08:43" },
      { id: "4", roomId: room.id, status: room.status, reason: "Baseline refresh is blocked while a large blob is present.", eventTime: "08:44" },
    ];
  }

  return [
    { id: "1", roomId: room.id, status: room.status, reason: "Still photo classified a person lying on the floor.", eventTime: "08:42" },
    { id: "2", roomId: room.id, status: room.status, reason: "Floor posture persisted across the next 5-second analysis frame.", eventTime: "08:42" },
    { id: "3", roomId: room.id, status: room.status, reason: "Danger alert opened after the 1-minute floor threshold.", eventTime: "08:43" },
    { id: "4", roomId: room.id, status: room.status, reason: "No microphone signal is required for this alert.", eventTime: "08:43" },
  ];
}
