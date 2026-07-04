import { NextResponse, type NextRequest } from "next/server";
import { applyDemoInferenceResult } from "@/lib/demo-supabase";
import { isDemoFrameRate, type DemoInferenceInput } from "@/lib/demo-detection";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoWorkerSecret, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/supabase/env";

type ResultPayload = Partial<DemoInferenceInput>;

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin writes are not configured." }, { status: 503 });
  }

  if (!demoWorkerSecret) {
    return NextResponse.json({ error: "DEMO_WORKER_SECRET is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${demoWorkerSecret}`) {
    return NextResponse.json({ error: "Invalid worker secret." }, { status: 401 });
  }

  const payload = (await request.json()) as ResultPayload;
  const validationError = validateResultPayload(payload);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    const result = await applyDemoInferenceResult(createAdminClient(), payload as DemoInferenceInput);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo result could not be saved." }, { status: 500 });
  }
}

function validateResultPayload(payload: ResultPayload) {
  if (typeof payload.roomId !== "string" || !payload.roomId) return "roomId is required.";
  if (typeof payload.capturedAt !== "string" || !payload.capturedAt) return "capturedAt is required.";
  if (!isDemoFrameRate(payload.frameRate)) return "frameRate is invalid.";
  if (payload.confidence !== undefined && typeof payload.confidence !== "number") return "confidence must be a number.";
  return "";
}
