alter table public.rooms
  add column if not exists status_metadata jsonb not null default '{}'::jsonb;

update public.rooms r
set status_metadata = case
  when h.block_number = '123' and r.name = 'Bedroom' then '{"personLocation":"floor","personPosture":"lying","movement":"small","faceExpression":"negative","bloodDetected":false,"frameIntervalSeconds":5}'::jsonb
  when h.block_number = '123' and r.name = 'Living room' then '{"personLocation":"sofa","personPosture":"lying","movement":"small","faceExpression":"neutral","bloodDetected":false,"frameIntervalSeconds":5}'::jsonb
  when h.block_number = '123' and r.name = 'Shower' then '{"changedZoneCount":24,"largeBlobDetected":true,"floorDistanceMm":480,"baselineState":"Clutter-tolerant baseline active"}'::jsonb
  when h.block_number = '219' and r.name = 'Bedroom' then '{"personLocation":"bed","personPosture":"lying","movement":"small","faceExpression":"neutral","bloodDetected":false,"frameIntervalSeconds":5,"noMovementDuration":"18 min"}'::jsonb
  when h.block_number = '219' and r.name = 'Shower' then '{"changedZoneCount":3,"largeBlobDetected":false,"floorDistanceMm":1710,"baselineState":"Small moved toiletries ignored"}'::jsonb
  when h.block_number = '505' and r.name = 'Shower' then '{"baselineState":"Baseline refresh paused"}'::jsonb
  else r.status_metadata
end
from public.homes h
where r.home_id = h.id;
