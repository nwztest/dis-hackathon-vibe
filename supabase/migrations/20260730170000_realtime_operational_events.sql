do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_status_events'
  ) then
    alter publication supabase_realtime add table public.room_status_events;
  end if;
end
$$;
