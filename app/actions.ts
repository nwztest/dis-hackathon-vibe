"use server";

import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export type ActionState = {
  ok: boolean;
  message: string;
};

export async function createHomeAction(formData: FormData): Promise<ActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Supabase env is not configured. This would create the home in the database." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("homes").insert({
    senior_name: requiredString(formData, "seniorName"),
    senior_phone: optionalString(formData, "seniorPhone"),
    emergency_contact_name: optionalString(formData, "emergencyContactName"),
    emergency_contact_phone: optionalString(formData, "emergencyContactPhone"),
    medical_details: optionalString(formData, "medicalDetails"),
    block_number: requiredString(formData, "blockNumber"),
    unit_number: requiredString(formData, "unitNumber"),
    address: optionalString(formData, "address"),
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true, message: "Home created in Supabase." };
}

export async function createRoomAction(formData: FormData): Promise<ActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Supabase env is not configured. This would create the room in the database." };
  }

  const supabase = await createClient();
  const roomType = requiredString(formData, "roomType");
  const deviceType = requiredString(formData, "deviceType");
  const roomName = requiredString(formData, "roomName");

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      home_id: requiredString(formData, "homeId"),
      name: roomName,
      type: roomType,
      current_status: "offline",
      occupied: false,
      time_in_status: "Just now",
      last_status_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (roomError) return { ok: false, message: roomError.message };

  const uidPrefix = deviceType === "tof_shower" ? "TOF" : "CAM";
  const { error: deviceError } = await supabase.from("devices").insert({
    room_id: room.id,
    device_uid: `${uidPrefix}-${roomName.replace(/[^a-z0-9]/gi, "").toUpperCase()}-${Date.now().toString().slice(-5)}`,
    device_type: deviceType,
    status: "unassigned",
    firmware_version: "0.1.0",
    heartbeat_label: "Not connected",
    signal_label: "No signal",
    hardware: deviceType === "tof_shower" ? "ESP32 + VL53L5X ToF" : "Room camera, still frame every 5 sec",
    privacy: deviceType === "tof_shower" ? "No camera in shower" : "No live video",
  });

  if (deviceError) return { ok: false, message: deviceError.message };

  revalidatePath("/dashboard");
  revalidatePath("/devices");
  revalidatePath("/setup/select-room");
  return { ok: true, message: "Room created in Supabase." };
}

export async function acknowledgeAlertAction(alertId: string): Promise<void> {
  await updateAlert(alertId, "acknowledged");
}

export async function resolveAlertAction(alertId: string): Promise<void> {
  await updateAlert(alertId, "resolved");
}

export async function updateUserRoleAction(profileId: string, role: "unapproved" | "caregiver"): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const currentProfile = await requireAdminProfile("/users");
  if (!currentProfile) return;
  if (currentProfile.id === profileId) return;

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .single();

  if (targetError) throw new Error(targetError.message);
  if (target?.role === "admin") return;

  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/users");
}

async function updateAlert(alertId: string, status: "acknowledged" | "resolved"): Promise<ActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: `Supabase env is not configured. This would mark the alert ${status}.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const payload =
    status === "acknowledged"
      ? { status, acknowledged_at: now, acknowledged_by: user?.id ?? null }
      : { status, resolved_at: now, resolved_by: user?.id ?? null };

  const { data, error } = await supabase.from("alerts").update(payload).eq("id", alertId).select("room_id").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  if (data?.room_id) revalidatePath(`/rooms/${data.room_id}`);
  return { ok: true, message: `Alert marked ${status}.` };
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
