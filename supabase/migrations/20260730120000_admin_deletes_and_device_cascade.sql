drop policy if exists "admins delete homes" on public.homes;
create policy "admins delete homes"
  on public.homes for delete
  to authenticated
  using ((select public.current_user_role()) = 'admin');

drop policy if exists "admins delete rooms" on public.rooms;
create policy "admins delete rooms"
  on public.rooms for delete
  to authenticated
  using ((select public.current_user_role()) = 'admin');

drop policy if exists "admins delete devices" on public.devices;
create policy "admins delete devices"
  on public.devices for delete
  to authenticated
  using ((select public.current_user_role()) = 'admin');

-- Keep room deletion authoritative: attached devices are removed by the
-- database, and their service-only credentials cascade from devices.
alter table public.devices
  drop constraint if exists devices_room_id_fkey;

alter table public.devices
  add constraint devices_room_id_fkey
  foreign key (room_id)
  references public.rooms(id)
  on delete cascade;
