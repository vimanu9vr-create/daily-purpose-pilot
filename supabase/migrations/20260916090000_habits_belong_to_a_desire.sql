-- Habits hang off a desire, the same way actions and programmes already do.
--
-- Until now a habit was free-floating: "Exercise", "Meditation", with nothing
-- saying WHY. That's the gap between a habit tracker and a manifestation app —
-- ticking a box means nothing unless it's visibly the thing that makes the
-- specific life you wrote down more likely.
--
-- Nullable on purpose. Habits created before this keep working, and a genuinely
-- general habit ("Water") shouldn't be forced to pretend it serves one goal.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a desire must not silently
-- destroy months of streak history. The habit survives, unattached, and the
-- person can re-point it or archive it themselves.

alter table public.habits
  add column if not exists desire_id uuid references public.desires(id) on delete set null;

create index if not exists habits_desire_id_idx
  on public.habits (desire_id)
  where desire_id is not null;

comment on column public.habits.desire_id is
  'The desire this habit serves. Null means it is not tied to one.';
