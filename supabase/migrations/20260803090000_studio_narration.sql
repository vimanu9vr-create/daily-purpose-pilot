-- Narration audio, generated once per story and reused forever. ElevenLabs
-- bills per character, so caching the URL is the whole cost strategy.
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS audio_voice TEXT;

-- Per-sentence start times in seconds, so the on-screen line stays in sync
-- with real audio the same way it does with speech synthesis.
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS audio_marks JSONB;

INSERT INTO storage.buckets (id, name, public)
VALUES ('narration', 'narration', true)
ON CONFLICT (id) DO NOTHING;

-- Public read is acceptable: paths are per-user UUIDs, unguessable, and the
-- content is the user's own narration. Writes only happen through the service
-- role inside the edge function.
DROP POLICY IF EXISTS "narration_public_read" ON storage.objects;
CREATE POLICY "narration_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'narration');
