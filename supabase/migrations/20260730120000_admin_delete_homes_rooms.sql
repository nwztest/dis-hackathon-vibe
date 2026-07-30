grant delete on public.homes, public.rooms to authenticated;

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
