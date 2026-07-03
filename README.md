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
- `/rooms/bedroom-123`
- `/alerts`
- `/devices`
- `/setup/select-room`
- `/setup/identify`
- `/setup/calibration`
- `/setup/complete`
- `/settings`

Stitch reference exports are stored in `stitch-reference/`.
