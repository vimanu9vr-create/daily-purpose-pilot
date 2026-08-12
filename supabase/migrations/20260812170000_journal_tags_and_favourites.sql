-- Tags and favourites on journal entries.
--
-- Two additive columns, both with defaults. Nothing existing changes meaning.
--
-- Gratitude deliberately does NOT get its own table. A gratitude entry is a
-- journal entry with a fixed prompt, and giving it separate storage would mean
-- it never appears when someone searches their own writing — which is exactly
-- the moment they'd most want to find it.

ALTER TABLE public.journals
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.journals
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Favourites are read as a filtered list often enough to be worth an index,
-- and it's partial so it costs almost nothing.
CREATE INDEX IF NOT EXISTS journals_favourites
  ON public.journals (user_id, entry_date DESC)
  WHERE is_favorite;

-- GIN, because tag lookups are containment queries (`tags @> '{money}'`) and a
-- btree can't answer those.
CREATE INDEX IF NOT EXISTS journals_tags
  ON public.journals USING GIN (tags);
