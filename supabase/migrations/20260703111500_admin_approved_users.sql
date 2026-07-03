alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  alter column role set default 'unapproved';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'caregiver', 'family', 'unapproved'));

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    coalesce(new.raw_app_meta_data ->> 'role', 'unapproved'),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

grant select on public.profiles to authenticated;
grant update (role) on public.profiles to authenticated;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own or admin"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

create policy "admins update managed user roles"
  on public.profiles for update
  to authenticated
  using (
    (select public.current_user_role()) = 'admin'
    and id <> (select auth.uid())
    and role <> 'admin'
  )
  with check (
    (select public.current_user_role()) = 'admin'
    and id <> (select auth.uid())
    and role in ('unapproved', 'caregiver')
  );

drop policy if exists "operational tables readable by authenticated users" on public.homes;
create policy "operational tables readable by approved users"
  on public.homes for select
  to authenticated
  using ((select public.current_user_role()) in ('admin', 'caregiver'));

drop policy if exists "rooms readable by authenticated users" on public.rooms;
create policy "rooms readable by approved users"
  on public.rooms for select
  to authenticated
  using ((select public.current_user_role()) in ('admin', 'caregiver'));

drop policy if exists "devices readable by authenticated users" on public.devices;
create policy "devices readable by approved users"
  on public.devices for select
  to authenticated
  using ((select public.current_user_role()) in ('admin', 'caregiver'));

drop policy if exists "alerts readable by authenticated users" on public.alerts;
create policy "alerts readable by approved users"
  on public.alerts for select
  to authenticated
  using ((select public.current_user_role()) in ('admin', 'caregiver'));

drop policy if exists "room events readable by authenticated users" on public.room_status_events;
create policy "room events readable by approved users"
  on public.room_status_events for select
  to authenticated
  using ((select public.current_user_role()) in ('admin', 'caregiver'));

drop policy if exists "admins insert homes" on public.homes;
create policy "admins insert homes"
  on public.homes for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins update homes" on public.homes;
create policy "admins update homes"
  on public.homes for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins insert rooms" on public.rooms;
create policy "admins insert rooms"
  on public.rooms for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins update rooms" on public.rooms;
create policy "admins update rooms"
  on public.rooms for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins insert devices" on public.devices;
create policy "admins insert devices"
  on public.devices for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins update devices" on public.devices;
create policy "admins update devices"
  on public.devices for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins insert room events" on public.room_status_events;
create policy "admins insert room events"
  on public.room_status_events for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins and caregivers update alerts" on public.alerts;
create policy "admins and caregivers update alerts"
  on public.alerts for update
  to authenticated
  using ((select public.current_user_role()) in ('admin', 'caregiver'))
  with check ((select public.current_user_role()) in ('admin', 'caregiver'));

drop policy if exists "admins insert alerts" on public.alerts;
create policy "admins insert alerts"
  on public.alerts for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "authenticated users insert own audit events" on public.dashboard_audit_events;
create policy "approved users insert own audit events"
  on public.dashboard_audit_events for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and (select public.current_user_role()) in ('admin', 'caregiver')
  );
