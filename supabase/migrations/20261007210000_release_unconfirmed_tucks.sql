-- GIFT-026 change (Josh, 2026-10-07, answers Q-022): don't assume a
-- "bought" tuck was given. Only the owner checking a gift off as received
-- removes it from their list; leftover tucks for a Gathering — planning or
-- bought — are released 30 days after it ends.

create or replace function public.gift_nook_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gathering record;
  member uuid;
  days_left int;
begin
  -- "Gathering coming up": 7 days before, and the day before.
  for gathering in
    select id, burrow_id, title, ends_at from public.gatherings
    where ends_at > now() and ends_at < now() + interval '8 days'
  loop
    days_left := floor(extract(epoch from (gathering.ends_at - now())) / 86400);
    if days_left in (7, 1) then
      for member in select profile_id from public.burrow_members where burrow_id = gathering.burrow_id loop
        perform public.notify(
          member,
          'gathering_soon',
          gathering.title || case when days_left = 1 then ' is tomorrow' else ' is in a week' end,
          null,
          jsonb_build_object('gathering_id', gathering.id, 'burrow_id', gathering.burrow_id)
        );
      end loop;
    end if;
  end loop;

  -- 30 days after a Gathering ends, any tuck made for it that the owner
  -- didn't confirm as received is released — "bought" included. Until then
  -- a bought tuck keeps showing as Bought to other givers. Only the owner
  -- checking it off (mark_received) takes a gift off their list.
  update public.claims c set released_at = now()
  from public.gatherings g
  where c.gathering_id = g.id and g.ends_at < now() - interval '30 days'
    and c.released_at is null and c.status in ('planning', 'bought');

  -- Removed gifts nobody has tucked any more.
  delete from public.gifts g
  where g.removed_at is not null
    and not exists (
      select 1 from public.claims c
      where c.gift_id = g.id and c.released_at is null and c.status <> 'given'
    );

  -- Archive at the end date; delete 90 days later (Q-014).
  update public.gatherings set archived_at = ends_at
  where archived_at is null and ends_at < now();
  delete from public.gatherings where ends_at < now() - interval '90 days';

  delete from public.notifications
  where read_at is not null and created_at < now() - interval '60 days';
  delete from public.profile_handoffs where expires_at < now() - interval '30 days';
  delete from public.knocks where expires_at < now() - interval '30 days';
end;
$$;
