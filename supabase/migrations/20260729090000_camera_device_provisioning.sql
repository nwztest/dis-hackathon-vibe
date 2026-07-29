alter table public.devices
  add column if not exists camera_profile text,
  add column if not exists capture_interval_ms integer not null default 500
    check (capture_interval_ms between 500 and 60000),
  add column if not exists configured_at timestamptz,
  add column if not exists last_frame_at timestamptz;

create table public.device_credentials (
  device_id uuid primary key references public.devices(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

alter table public.device_credentials enable row level security;

revoke all on table public.device_credentials from anon, authenticated;

comment on table public.device_credentials is
  'Service-role-only device secrets. Plaintext tokens are never stored.';
comment on column public.devices.camera_profile is
  'Isolated firmware pin-map profile, for example esp32s3_cam_common.';
comment on column public.devices.last_frame_at is
  'Server timestamp of the most recently accepted inference frame.';

update public.devices
set camera_profile = 'esp32s3_cam_common',
    capture_interval_ms = 500
where device_type = 'room_camera'
  and camera_profile is null;
