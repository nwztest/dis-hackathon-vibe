# CareGuard Home Safety Dashboard

Next.js prototype for senior home fall detection in a Singapore HDB context.

Supabase backs the non-hardware app surfaces when env vars are configured. Without env vars, the app falls back to mock data so local builds and UI checks still work.

## Supabase

Project: `orange-pointer`

```text
NEXT_PUBLIC_SUPABASE_URL=https://tntaawhzconpxqfwnoce.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The migrations create homes, rooms, devices, alerts, room status events, audit events, profiles, RLS
policies, and a service-only `device_credentials` table. Camera images are transient and are never
stored by the application.

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

## ESP32-S3 camera

The binary hardware endpoint is `POST /api/devices/frame`. It accepts a raw JPEG up to 1 MB with
`Authorization: Bearer <device-token>` and `X-Device-Id: <device-uid>`. The server derives the room,
capture timestamp, and 2 FPS cadence from the authenticated device record.

The PlatformIO project and Web Serial protocol are documented in
`firmware/esp32s3-camera/README.md`. Apply all Supabase migrations and configure
`SUPABASE_SECRET_KEY`, `INFERENCE_WORKER_URL`, and `DEMO_WORKER_SECRET` before provisioning.

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

This is a test commit, I am testing this right now.
