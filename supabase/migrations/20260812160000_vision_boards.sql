-- Vision boards.
--
-- Two tables and one storage bucket. Nothing existing is altered.
--
-- Items are deliberately one table with a `kind` rather than separate tables
-- per type. A board is a spatial arrangement of mixed things — a photo next to
-- a sentence next to a goal — and joining four tables to lay out one screen
-- would be work for no benefit.

CREATE TABLE IF NOT EXISTS public.vision_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Matches the categories used by desires and goals, so a board can be
  -- generated from what someone already told us they want.
  category TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_boards_by_user
  ON public.vision_boards (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_boards TO authenticated;
GRANT ALL ON public.vision_boards TO service_role;
ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vision_boards_own" ON public.vision_boards;
CREATE POLICY "vision_boards_own" ON public.vision_boards FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.vision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.vision_boards(id) ON DELETE CASCADE,
  -- 'image' | 'text' | 'affirmation' | 'goal'
  kind TEXT NOT NULL DEFAULT 'text',
  -- The sentence, for text and affirmations. Null for images.
  body TEXT,
  -- Public URL, for images.
  image_url TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_items_by_board
  ON public.vision_items (board_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_items TO authenticated;
GRANT ALL ON public.vision_items TO service_role;
ALTER TABLE public.vision_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vision_items_own" ON public.vision_items;
CREATE POLICY "vision_items_own" ON public.vision_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage for uploaded photos.
--
-- Public, like the narration bucket, because the URLs are unguessable UUIDs
-- and signing every image in a grid would make the board slow to open. Writes
-- are still restricted to the owning user by the policies below — a person can
-- only ever write inside a folder named after their own id.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision', 'vision', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "vision_read" ON storage.objects;
CREATE POLICY "vision_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'vision');

DROP POLICY IF EXISTS "vision_write_own" ON storage.objects;
CREATE POLICY "vision_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vision' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "vision_delete_own" ON storage.objects;
CREATE POLICY "vision_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vision' AND (storage.foldername(name))[1] = auth.uid()::text);
