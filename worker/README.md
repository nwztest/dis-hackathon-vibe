# CareGuard Demo Inference Worker

FastAPI worker for the laptop-camera demo. The Next.js app sends compressed still frames to `POST /infer-frame`; this worker returns normalized room-camera facts that the app can turn into room status, events, and alerts.

YOLO runs here, not in Vercel.

## Local Setup

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The worker loads env vars from the repo root `.env` and then `worker/.env`, with `worker/.env` taking priority.

Then set the Next app env:

```env
INFERENCE_WORKER_URL=http://localhost:8000
DEMO_WORKER_SECRET=replace_with_shared_worker_secret
```

If `DEMO_WORKER_SECRET` is set in the worker environment, requests must include:

```text
Authorization: Bearer replace_with_shared_worker_secret
```

The Next app already sends this header when its own `DEMO_WORKER_SECRET` is configured.

## Railway Deploy

This repo includes `railway.json` and `worker/Dockerfile` so Railway deploys only the FastAPI worker from the `worker` directory.

1. Create a Railway project from the GitHub repo.
2. In the Railway service settings, generate a public domain.
3. Set these Railway service variables:

```env
WORKER_MODE=auto
YOLO_MODEL=yolov8n-pose.pt
SHOW_YOLO_BOXES=false
ENABLE_BLOOD_DETECTION=false
DEMO_WORKER_SECRET=replace_with_shared_worker_secret
```

Use `SHOW_YOLO_BOXES=true` only when you need debug frames, because annotated images make responses larger.

4. Set these Vercel env vars on the Next.js app:

```env
INFERENCE_WORKER_URL=https://your-railway-domain.up.railway.app
DEMO_WORKER_SECRET=replace_with_shared_worker_secret
```

5. Check the deployed worker:

```bash
curl https://your-railway-domain.up.railway.app/health
```

## Modes

- `WORKER_MODE=auto` default: use YOLO if available, otherwise mock.
- `WORKER_MODE=yolo`: require Ultralytics YOLO.
- `WORKER_MODE=mock`: skip YOLO and return a scenario result.

Useful demo scenarios:

```env
DEMO_SCENARIO=floor_suspicious
DEMO_SCENARIO=floor_danger
DEMO_SCENARIO=bed_occupied
DEMO_SCENARIO=blood
DEMO_SCENARIO=empty
```

## YOLO Notes

Default model:

```env
YOLO_MODEL=yolov8n-pose.pt
```

The worker uses pose keypoints to estimate posture. Live YOLO mode reports room location as `unknown`; floor, bed, sofa, and chair labels need room-zone calibration or a custom detector. Mock scenarios can still return those locations for controlled demos.

Set this when you want the worker response to include a debug image with YOLO boxes/keypoints:

```env
SHOW_YOLO_BOXES=true
```

Leave it `false` for normal demos because annotated images make responses larger.

Live blood detection is disabled by default because the simple color heuristic is too noisy for public demos:

```env
ENABLE_BLOOD_DETECTION=false
```

Use `DEMO_SCENARIO=blood` for a controlled blood-alert demo. Only set `ENABLE_BLOOD_DETECTION=true` when deliberately testing the experimental red-region heuristic.

`numpy` is pinned to `1.26.x` because Ultralytics currently requires NumPy `<2.0` on macOS.
