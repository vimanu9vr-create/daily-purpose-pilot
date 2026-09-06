-- PHASE C — security hardening and schema fixes for beta_applications
--
-- Run this AFTER beta_applications.sql. It is safe to re-run.
--
-- Three things it fixes, in order of how badly they'd have bitten:
--
--   1. The unique index was on `email`, but the address that actually
--      identifies a tester is `play_email` — that's the one Google matches.
--      Two people could apply with the same Google account and different
--      contact addresses, and you'd invite the same account twice while
--      believing you had two testers. On a 20-place list that is a real
--      hole in the count.
--
--   2. The `beta_pipeline` view could leak the whole table. Views execute
--      with the privileges of their OWNER, not the caller — so a view over
--      an RLS-protected table is a way *around* that RLS if anyone can
--      select from it. No grant was issued, but Supabase projects often
--      carry blanket default grants on the public schema, and "probably not
--      granted" is not a security posture. This revokes explicitly.
--
--   3. Nothing stopped one browser submitting a thousand rows. The page has
--      a honeypot and a time gate, and both live in JavaScript, which means
--      neither exists as far as a script is concerned.

-- ---------------------------------------------------------------------
-- 1. Identify testers by the account Google will actually match on
-- ---------------------------------------------------------------------
create unique index if not exists beta_applications_play_email_key
  on public.beta_applications (lower(play_email));

-- ---------------------------------------------------------------------
-- 2. Make sure the view cannot be read by anonymous visitors
-- ---------------------------------------------------------------------
revoke all on public.beta_pipeline from anon, authenticated;

-- And confirm the table itself only ever allows insert.
revoke select, update, delete on public.beta_applications from anon, authenticated;
grant insert on public.beta_applications to anon, authenticated;

-- Belt and braces: an explicit deny-by-absence check. If either of these
-- returns true, stop and fix it before running ads.
--
--   select has_table_privilege('anon','public.beta_applications','select');  -- want false
--   select has_table_privilege('anon','public.beta_pipeline','select');      -- want false

-- ---------------------------------------------------------------------
-- 3. Rate limit, in the database rather than in the browser
-- ---------------------------------------------------------------------
-- Client-side protections stop humans making mistakes. They do not stop a
-- script, because a script never loads the page. This trigger is the only
-- limit that actually applies to the request itself.
--
-- Twenty applications an hour, globally. You are recruiting twenty people
-- in total, so a legitimate hour will never come close — and a burst above
-- it is, by definition, not your audience.

create or replace function public.beta_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
  from public.beta_applications
  where created_at > now() - interval '1 hour';

  if recent >= 20 then
    raise exception 'rate_limited'
      using hint = 'Too many applications in the last hour.';
  end if;

  return new;
end;
$$;

drop trigger if exists beta_rate_limit_trigger on public.beta_applications;
create trigger beta_rate_limit_trigger
  before insert on public.beta_applications
  for each row execute function public.beta_rate_limit();

-- ---------------------------------------------------------------------
-- 4. Normalise on the way in, so duplicates can't sneak past on casing
-- ---------------------------------------------------------------------
create or replace function public.beta_normalise()
returns trigger
language plpgsql
as $$
begin
  new.email      := lower(btrim(new.email));
  new.play_email := lower(btrim(new.play_email));
  new.name       := btrim(new.name);
  new.goal       := btrim(new.goal);
  return new;
end;
$$;

drop trigger if exists beta_normalise_trigger on public.beta_applications;
create trigger beta_normalise_trigger
  before insert on public.beta_applications
  for each row execute function public.beta_normalise();

-- ---------------------------------------------------------------------
-- 5. The working views you'll actually use each morning
-- ---------------------------------------------------------------------
create or replace view public.beta_pipeline as
select
  created_at at time zone 'Asia/Kolkata' as applied_at,
  name, play_email, email, android, goal, tried, status,
  source, campaign, ad,
  case
    when android = 'no'                        then 'iPhone — launch list only'
    when length(btrim(goal)) < 12              then 'Thin goal — ask them to sharpen it'
    when tried = 'yes-stopped'                 then 'PRIORITY — exact target'
    else 'Looks qualified'
  end as first_read
from public.beta_applications
order by created_at desc;

-- Where the funnel is leaking, in one row.
create or replace view public.beta_funnel as
select
  count(*)                                                          as applications,
  count(*) filter (where android <> 'no')                           as android_eligible,
  count(*) filter (where status = 'qualified')                      as qualified,
  count(*) filter (where status = 'invited')                        as invited,
  count(*) filter (where status in ('opted_in','installed','active','completed')) as opted_in,
  count(*) filter (where status in ('installed','active','completed'))            as installed,
  count(*) filter (where still_opted_in is true)                    as still_in_at_14,
  count(*) filter (where day14_feedback)                            as final_feedback
from public.beta_applications;

-- Which ad produced TESTERS, not clicks. The only attribution that matters.
create or replace view public.beta_by_ad as
select
  coalesce(nullif(campaign,''),'(none)') as campaign,
  coalesce(nullif(ad,''),'(none)')       as ad,
  count(*)                                                                        as leads,
  count(*) filter (where android <> 'no')                                         as android_leads,
  count(*) filter (where status in ('opted_in','installed','active','completed')) as testers,
  count(*) filter (where still_opted_in is true)                                  as retained
from public.beta_applications
group by 1,2
order by retained desc, testers desc, leads desc;

revoke all on public.beta_pipeline, public.beta_funnel, public.beta_by_ad from anon, authenticated;
