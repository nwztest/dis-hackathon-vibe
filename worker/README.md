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

The worker uses pose keypoints to estimate posture and a simple lower-frame heuristic for floor location. Bed/sofa/chair classification needs room-zone calibration or a custom detector; until then the worker reports `unknown` for those surfaces unless using a demo scenario.

`numpy` is pinned to `1.26.x` because Ultralytics currently requires NumPy `<2.0` on macOS.
