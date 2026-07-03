create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'caregiver' check (role in ('admin', 'caregiver', 'family')),
  phone text,
  created_at timestamptz not null default now()
);

create table public.homes (
  id uuid primary key default gen_random_uuid(),
  senior_name text not null,
  senior_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_details text,
  block_number text not null,
  unit_number text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  name text not null,
  type text not null check (type in ('room', 'shower')),
  current_status text not null default 'offline' check (current_status in ('unoccupied', 'occupied', 'suspicious', 'danger', 'offline', 'maintenance')),
  occupied boolean not null default false,
  last_status_at timestamptz not null default now(),
  time_in_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  device_uid text not null unique,
  device_type text not null check (device_type in ('room_camera', 'tof_shower', 'future_microphone')),
  status text not null default 'unassigned' check (status in ('online', 'offline', 'maintenance', 'unassigned')),
  firmware_version text,
  last_seen_at timestamptz,
  heartbeat_label text,
  signal_label text,
  hardware text,
  privacy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  severity text not null check (severity in ('suspicious', 'danger')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  reason text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 100)),
  duration text,
  evidence text,
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_status_events (
  id bigint generated always as identity primary key,
  home_id uuid not null references public.homes(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  status text not null check (status in ('unoccupied', 'occupied', 'suspicious', 'danger', 'offline', 'maintenance')),
  reason text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 100)),
  event_time timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.dashboard_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  home_id uuid references public.homes(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  alert_id uuid references public.alerts(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_homes_updated_at before update on public.homes
  for each row execute function public.set_updated_at();
create trigger set_rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger set_devices_updated_at before update on public.devices
  for each row execute function public.set_updated_at();
create trigger set_alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    coalesce(new.raw_app_meta_data ->> 'role', 'caregiver'),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.homes enable row level security;
alter table public.rooms enable row level security;
alter table public.devices enable row level security;
alter table public.alerts enable row level security;
alter table public.room_status_events enable row level security;
alter table public.dashboard_audit_events enable row level security;

grant usage on schema public to authenticated;
grant select on public.profiles, public.homes, public.rooms, public.devices, public.alerts, public.room_status_events to authenticated;
grant insert, update on public.homes, public.rooms, public.devices, public.alerts, public.room_status_events, public.dashboard_audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "profiles select own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "operational tables readable by authenticated users"
  on public.homes for select
  to authenticated
  using (true);

create policy "rooms readable by authenticated users"
  on public.rooms for select
  to authenticated
  using (true);

create policy "devices readable by authenticated users"
  on public.devices for select
  to authenticated
  using (true);

create policy "alerts readable by authenticated users"
  on public.alerts for select
  to authenticated
  using (true);

create policy "room events readable by authenticated users"
  on public.room_status_events for select
  to authenticated
  using (true);

create policy "admins insert homes"
  on public.homes for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins update homes"
  on public.homes for update
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins insert rooms"
  on public.rooms for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins update rooms"
  on public.rooms for update
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins insert devices"
  on public.devices for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins update devices"
  on public.devices for update
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins insert room events"
  on public.room_status_events for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "admins and caregivers update alerts"
  on public.alerts for update
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin', 'caregiver')))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin', 'caregiver')));

create policy "admins insert alerts"
  on public.alerts for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy "authenticated users insert own audit events"
  on public.dashboard_audit_events for insert
  to authenticated
  with check (actor_id = (select auth.uid()));

insert into public.homes (id, senior_name, senior_phone, emergency_contact_name, emergency_contact_phone, medical_details, block_number, unit_number, address) values
  ('00000000-0000-4000-8000-000000000123', 'Tan Ah Kow', '+65 9123 4567', 'Tan Mei Ling', '+65 9876 5432', 'Diabetes, fall risk, mild hypertension', '123', '08-456', 'Jurong West Street 41'),
  ('00000000-0000-4000-8000-000000000219', 'Mdm Siti Aminah', '+65 9111 2408', 'Nur Hidayah', '+65 9666 1204', 'Post-surgery mobility support, uses walking frame', '219', '04-118', 'Tampines Street 24'),
  ('00000000-0000-4000-8000-000000000505', 'Lim Bee Choo', '+65 9222 7788', 'Lim Wei Han', '+65 9333 8877', 'History of fainting, lives alone', '505', '12-302', 'Ang Mo Kio Avenue 8');

insert into public.rooms (id, home_id, name, type, current_status, occupied, last_status_at, time_in_status) values
  ('10000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000123', 'Bedroom', 'room', 'danger', true, '2026-07-02 08:43:00+08', '1 min'),
  ('10000000-0001-4000-8000-000000000123', '00000000-0000-4000-8000-000000000123', 'Living room', 'room', 'occupied', true, '2026-07-02 08:44:00+08', '34 min'),
  ('10000000-0002-4000-8000-000000000123', '00000000-0000-4000-8000-000000000123', 'Shower', 'shower', 'suspicious', true, '2026-07-02 08:45:00+08', '42 sec'),
  ('10000000-0000-4000-8000-000000000219', '00000000-0000-4000-8000-000000000219', 'Bedroom', 'room', 'occupied', true, '2026-07-02 08:20:00+08', '8 hr 20 min'),
  ('10000000-0001-4000-8000-000000000219', '00000000-0000-4000-8000-000000000219', 'Shower', 'shower', 'unoccupied', false, '2026-07-02 08:28:00+08', '16 min'),
  ('10000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000505', 'Living room', 'room', 'offline', false, '2026-07-02 08:35:00+08', '9 min'),
  ('10000000-0001-4000-8000-000000000505', '00000000-0000-4000-8000-000000000505', 'Shower', 'shower', 'maintenance', false, '2026-07-02 08:20:00+08', '24 min');

insert into public.devices (id, room_id, device_uid, device_type, status, firmware_version, last_seen_at, heartbeat_label, signal_label, hardware, privacy) values
  ('20000000-0000-4000-8000-000000000123', '10000000-0000-4000-8000-000000000123', 'CAM-BED-123', 'room_camera', 'online', '0.2.0', '2026-07-02 08:43:55+08', '5 sec ago', '-61 dBm', 'Room camera, still frame every 5 sec', 'Event snapshots only'),
  ('20000000-0001-4000-8000-000000000123', '10000000-0001-4000-8000-000000000123', 'CAM-LIV-123', 'room_camera', 'online', '0.2.0', '2026-07-02 08:43:56+08', '4 sec ago', '-63 dBm', 'Room camera, still frame every 5 sec', 'No live video'),
  ('20000000-0002-4000-8000-000000000123', '10000000-0002-4000-8000-000000000123', 'TOF-SHW-123', 'tof_shower', 'online', '0.1.1', '2026-07-02 08:43:53+08', '7 sec ago', '-67 dBm', 'ESP32 + VL53L5X ToF', 'No camera in shower'),
  ('20000000-0000-4000-8000-000000000219', '10000000-0000-4000-8000-000000000219', 'CAM-BED-219', 'room_camera', 'online', '0.2.0', '2026-07-02 08:43:55+08', '5 sec ago', '-58 dBm', 'Room camera, still frame every 5 sec', 'Event snapshots only'),
  ('20000000-0001-4000-8000-000000000219', '10000000-0001-4000-8000-000000000219', 'TOF-SHW-219', 'tof_shower', 'online', '0.1.1', '2026-07-02 08:43:49+08', '11 sec ago', '-65 dBm', 'ESP32 + VL53L5X ToF', 'Clutter-tolerant depth only'),
  ('20000000-0000-4000-8000-000000000505', '10000000-0000-4000-8000-000000000505', 'CAM-LIV-505', 'room_camera', 'offline', '0.2.0', '2026-07-02 08:35:00+08', '9 min ago', 'No heartbeat', 'Room camera, still frame every 5 sec', 'No live video'),
  ('20000000-0001-4000-8000-000000000505', '10000000-0001-4000-8000-000000000505', 'TOF-SHW-505', 'tof_shower', 'maintenance', '0.1.1', '2026-07-02 08:43:00+08', '1 min ago', '-59 dBm', 'ESP32 + VL53L5X ToF', 'No camera in shower');

insert into public.alerts (id, home_id, room_id, device_id, severity, status, reason, confidence, duration, evidence, opened_at) values
  ('30000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000123', '10000000-0000-4000-8000-000000000123', '20000000-0000-4000-8000-000000000123', 'danger', 'open', 'lying_on_floor_more_than_60_seconds', 92, '1 min', 'Bedroom camera classified lying posture on floor across 12 still frames.', '2026-07-02 08:42:00+08'),
  ('30000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000123', '10000000-0002-4000-8000-000000000123', '20000000-0002-4000-8000-000000000123', 'suspicious', 'open', 'large_low_blob_in_shower', 71, '42 sec', 'VL53L5X depth map shows a large low blob; small clutter changes are ignored.', '2026-07-02 08:45:00+08'),
  ('30000000-0000-4000-8000-000000000998', '00000000-0000-4000-8000-000000000219', '10000000-0000-4000-8000-000000000219', '20000000-0000-4000-8000-000000000219', 'suspicious', 'resolved', 'no_movement_on_bed_sofa_chair_watch', 64, '18 min', 'Lying on bed is normal; long no-movement watch did not cross 12 hours.', '2026-07-02 07:55:00+08');

insert into public.room_status_events (home_id, room_id, device_id, status, reason, confidence, event_time, metadata) values
  ('00000000-0000-4000-8000-000000000123', '10000000-0000-4000-8000-000000000123', '20000000-0000-4000-8000-000000000123', 'danger', 'Danger alert opened after the 1-minute floor threshold.', 92, '2026-07-02 08:43:00+08', '{"frameIntervalSeconds":5}'::jsonb),
  ('00000000-0000-4000-8000-000000000123', '10000000-0000-4000-8000-000000000123', '20000000-0000-4000-8000-000000000123', 'danger', 'Floor posture persisted across the next 5-second analysis frame.', 91, '2026-07-02 08:42:30+08', '{"personLocation":"floor","personPosture":"lying"}'::jsonb),
  ('00000000-0000-4000-8000-000000000123', '10000000-0002-4000-8000-000000000123', '20000000-0002-4000-8000-000000000123', 'suspicious', 'Large low blob detected; small shuffled toiletries ignored.', 71, '2026-07-02 08:45:00+08', '{"largeBlobDetected":true,"changedZoneCount":24}'::jsonb),
  ('00000000-0000-4000-8000-000000000123', '10000000-0002-4000-8000-000000000123', '20000000-0002-4000-8000-000000000123', 'suspicious', 'Baseline refresh is blocked while a large blob is present.', 68, '2026-07-02 08:44:30+08', '{"baselineState":"Clutter-tolerant baseline active"}'::jsonb),
  ('00000000-0000-4000-8000-000000000219', '10000000-0000-4000-8000-000000000219', '20000000-0000-4000-8000-000000000219', 'occupied', 'Lying on bed is occupied; no danger threshold crossed.', 64, '2026-07-02 07:55:00+08', '{"noMovementDuration":"18 min"}'::jsonb);
