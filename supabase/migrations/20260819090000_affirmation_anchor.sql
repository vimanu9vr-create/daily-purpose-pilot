-- Affirmations were only ever tagged with a category, never linked to the
-- dream they were written from. So "the affirmations for my defender car" was
-- not a question the database could answer, even though ai-affirmations was
-- already being told which desire to write about and was writing six lines
-- specifically for it. The link was computed and then thrown away.
alter table public.affirmations
  add column if not exists desire_id uuid references public.desires(id) on delete cascade;

-- The one line that matters most for a desire.
--
-- Six good affirmations is a list, and a list is something you scroll past.
-- One line that is clearly THE line is something you can carry around all day,
-- and it is what someone means when they ask for a powerful affirmation for a
-- particular dream. The other five stay — they're the variation that stops it
-- going stale — but exactly one is the anchor.
alter table public.affirmations
  add column if not exists is_anchor boolean not null default false;

create index if not exists idx_affirmations_desire on public.affirmations(desire_id);

-- At most one anchor per desire, enforced by the database rather than by
-- whichever code path happens to write last. A partial unique index is the
-- right tool: it constrains only the rows where is_anchor is true.
create unique index if not exists idx_affirmations_one_anchor_per_desire
  on public.affirmations(desire_id)
  where is_anchor;
