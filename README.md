# CareGuard Home Safety Dashboard

Next.js prototype for senior home fall detection in a Singapore HDB context.

Supabase backs the non-hardware app surfaces when env vars are configured. Without env vars, the app falls back to mock data so local builds and UI checks still work.

## Supabase

Project: `orange-pointer`

```text
NEXT_PUBLIC_SUPABASE_URL=https://tntaawhzconpxqfwnoce.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The initial remote migration creates homes, rooms, devices, alerts, room status events, audit events, profiles, RLS policies, and seed data. Hardware ingestion, MQTT, raw telemetry, and camera storage are intentionally deferred.

## Routes

- `/sign-in`
- `/dashboard`
- `/demo/camera`
- `/rooms/bedroom-123`
- `/alerts`
- `/devices`
- `/setup/select-room`
- `/setup/identify`
- `/setup/calibration`
- `/setup/complete`
- `/settings`

Stitch reference exports are stored in `stitch-reference/`.

## Laptop Camera Worker

The webcam demo keeps inference outside the Next.js app. Run the Python worker locally:

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Set `INFERENCE_WORKER_URL=http://localhost:8000` in the Next app. The worker supports `WORKER_MODE=mock` for quick demos and `WORKER_MODE=yolo` or `auto` for Ultralytics YOLO pose inference.

For a public demo, deploy the worker as a separate Railway service. This repo includes `railway.json` and `worker/Dockerfile`; set Railway's public service URL as `INFERENCE_WORKER_URL` in Vercel, and use the same `DEMO_WORKER_SECRET` in both services.
