import { revalidatePath } from "next/cache";
import {
  evaluateRoomCameraInference,
  previousRuleState,
  type DemoInferenceInput,
  type DemoRuleDecision,
  type DemoRuleState,
} from "@/lib/demo-detection";
import type { RoomStatus } from "@/lib/mock-data";

type SupabaseClientLike = {
  from: (table: string) => any;
};

type RoomRow = {
  id: string;
  home_id: string;
  type: "room" | "shower";
  current_status: RoomStatus;
  status_metadata: Record<string, unknown> | null;
};

type DeviceRow = {
  id: string;
};

export type DemoApplyResult = DemoRuleDecision & {
  roomId: string;
  alertId?: string;
};

export async function applyDemoInferenceResult(
  supabase: SupabaseClientLike,
  input: DemoInferenceInput,
): Promise<DemoApplyResult> {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, home_id, type, current_status, status_metadata")
    .eq("id", input.roomId)
    .single();

  if (roomError) throw new Error(roomError.message);
  const roomRow = room as RoomRow;
  if (roomRow.type !== "room") throw new Error("Demo camera inference can only update room camera areas.");

  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("room_id", input.roomId)
    .eq("device_type", "room_camera")
    .maybeSingle();

  const previous = previousRuleState(roomRow.status_metadata);
  previous.currentStatus = previous.currentStatus ?? roomRow.current_status;
  const decision = evaluateRoomCameraInference(input, previous);
  const capturedAt = normalizedDate(input.capturedAt);
  const metadata = {
    ...(roomRow.status_metadata ?? {}),
    ...decision.metadata,
  };
  const timeInStatus = formatDuration(metadata.statusStartedAt, capturedAt);

  const { error: updateError } = await supabase
    .from("rooms")
    .update({
      current_status: decision.status,
      occupied: decision.occupied,
      last_status_at: capturedAt.toISOString(),
      time_in_status: timeInStatus,
      status_metadata: metadata,
    })
    .eq("id", input.roomId);

  if (updateError) throw new Error(updateError.message);

  const previousReason = stringValue(roomRow.status_metadata, "alertReason");
  const shouldWriteEvent = roomRow.current_status !== decision.status || previousReason !== decision.reason;

  if (shouldWriteEvent) {
    const { error: eventError } = await supabase.from("room_status_events").insert({
      home_id: roomRow.home_id,
      room_id: input.roomId,
      device_id: (device as DeviceRow | null)?.id ?? null,
      status: decision.status,
      reason: decision.evidence,
      confidence: input.confidence ?? null,
      event_time: capturedAt.toISOString(),
      metadata,
    });

    if (eventError) throw new Error(eventError.message);
  }

  let alertId: string | undefined;

  if (decision.severity) {
    const { data: existingAlert, error: existingAlertError } = await supabase
      .from("alerts")
      .select("id")
      .eq("room_id", input.roomId)
      .eq("status", "open")
      .eq("reason", decision.reason)
      .maybeSingle();

    if (existingAlertError) throw new Error(existingAlertError.message);

    if (existingAlert?.id) {
      alertId = existingAlert.id;
    } else {
      const { data: insertedAlert, error: alertError } = await supabase
        .from("alerts")
        .insert({
          home_id: roomRow.home_id,
          room_id: input.roomId,
          device_id: (device as DeviceRow | null)?.id ?? null,
          severity: decision.severity,
          status: "open",
          reason: decision.reason,
          confidence: input.confidence ?? null,
          duration: timeInStatus,
          evidence: decision.evidence,
          opened_at: capturedAt.toISOString(),
        })
        .select("id")
        .single();

      if (alertError) throw new Error(alertError.message);
      alertId = insertedAlert?.id;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath(`/rooms/${input.roomId}`);

  return {
    ...decision,
    roomId: input.roomId,
    alertId,
  };
}

function normalizedDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function formatDuration(startValue: unknown, end: Date) {
  const start = typeof startValue === "string" ? new Date(startValue) : end;
  const elapsedSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  if (elapsedSeconds < 60) return `${elapsedSeconds} sec`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes > 0 ? `${hours} hr ${remainderMinutes} min` : `${hours} hr`;
}

function stringValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}
