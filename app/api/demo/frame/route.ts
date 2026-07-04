import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { applyDemoInferenceResult } from "@/lib/demo-supabase";
import { isDemoFrameRate, type DemoFrameRate, type DemoInferenceInput } from "@/lib/demo-detection";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoWorkerSecret, hasSupabaseAdminEnv, hasSupabaseEnv, inferenceWorkerUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type FramePayload = {
  roomId?: unknown;
  capturedAt?: unknown;
  frameRate?: unknown;
  imageBase64?: unknown;
};

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "caregiver") {
    return NextResponse.json({ error: "Approval required." }, { status: 403 });
  }

  if (!inferenceWorkerUrl) {
    return NextResponse.json({ error: "INFERENCE_WORKER_URL is not configured." }, { status: 503 });
  }

  const payload = (await request.json()) as FramePayload;
  const validationError = validateFramePayload(payload);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const frameRate = payload.frameRate as DemoFrameRate;

  let workerResponse: Response;
  try {
    workerResponse = await fetch(`${inferenceWorkerUrl.replace(/\/$/, "")}/infer-frame`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(demoWorkerSecret ? { authorization: `Bearer ${demoWorkerSecret}` } : {}),
      },
      body: JSON.stringify({
        roomId: payload.roomId,
        capturedAt: payload.capturedAt,
        frameRate,
        imageBase64: payload.imageBase64,
        callbackUrl: new URL("/api/demo/result", request.url).toString(),
      }),
    });
  } catch {
    return NextResponse.json({ error: "Inference worker is unreachable." }, { status: 502 });
  }

  if (!workerResponse.ok) {
    return NextResponse.json({ error: `Inference worker returned ${workerResponse.status}.` }, { status: 502 });
  }

  const inference = (await workerResponse.json()) as Partial<DemoInferenceInput>;
  const input: DemoInferenceInput = {
    ...inference,
    roomId: String(payload.roomId),
    capturedAt: String(payload.capturedAt),
    frameRate,
  };

  const supabase = hasSupabaseAdminEnv() ? createAdminClient() : await createClient();
  try {
    const result = await applyDemoInferenceResult(supabase, input);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo result could not be saved." }, { status: 500 });
  }
}

function validateFramePayload(payload: FramePayload) {
  if (typeof payload.roomId !== "string" || !payload.roomId) return "roomId is required.";
  if (typeof payload.capturedAt !== "string" || !payload.capturedAt) return "capturedAt is required.";
  if (!isDemoFrameRate(payload.frameRate)) return "frameRate is invalid.";
  if (typeof payload.imageBase64 !== "string" || !payload.imageBase64) return "imageBase64 is required.";
  if (payload.imageBase64.length > 4_000_000) return "imageBase64 is too large.";
  return "";
}
