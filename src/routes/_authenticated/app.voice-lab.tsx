import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { supabase } from "@/integrations/supabase/client";
import { SILENT_WAV } from "@/lib/ambient-audio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/voice-lab")({
  head: () => ({ meta: [{ title: "Voice — ManifestAI" }] }),
  component: VoiceLab,
});

/**
 * A page for choosing the voice by ear, once, instead of by guesswork, five
 * times.
 *
 * Every voice change so far has gone: change a number, deploy, wait to be told
 * it's still wrong. That loop cannot converge, because the person changing the
 * number has never heard the output. This puts the same passage in several
 * voices and paces on one screen so the decision takes five minutes and is made
 * by the person whose app it is.
 *
 * Not linked from anywhere. It's a tool for settling a question, reachable at
 * /app/voice-lab, and it should be deleted once the question is settled.
 */

/**
 * The passage.
 *
 * Deliberately two sentences of real content rather than "testing one two
 * three". A voice that sounds fine reading a test phrase can still sound wrong
 * reading something intimate, and the second sentence is where pacing shows.
 */
const PASSAGE =
  "You wake before the alarm, and for a second you can't place why the day feels different. Then you remember: this isn't something you're chasing anymore.";

type Candidate = {
  id: string;
  /** What the person picking sees. Deliberately not the voice's name. */
  label: string;
  voice: string;
  speed: number;
  gapSeconds: number;
  /** Why this one is in the list, shown so the choice is informed. */
  note: string;
};

/**
 * The candidates.
 *
 * Two axes at once — which voice, and how fast. Testing them separately would
 * mean two rounds, and they interact: a warmer voice tolerates a quicker pace,
 * a brighter one needs slowing down.
 *
 * A is what's live now. It's included unlabelled so it competes on equal terms
 * rather than being defended.
 */
const CANDIDATES: Candidate[] = [
  { id: "a", label: "A", voice: "sarah", speed: 0.7, gapSeconds: 2.4, note: "Slow, wide gaps" },
  { id: "b", label: "B", voice: "sarah", speed: 0.85, gapSeconds: 1.6, note: "Moderate" },
  {
    id: "c",
    label: "C",
    voice: "sarah",
    speed: 1.0,
    gapSeconds: 2.8,
    note: "Natural pace, long silences",
  },
  { id: "d", label: "D", voice: "charlotte", speed: 0.8, gapSeconds: 2.4, note: "Different voice" },
  { id: "e", label: "E", voice: "matilda", speed: 0.8, gapSeconds: 2.4, note: "Different voice" },
  { id: "f", label: "F", voice: "laura", speed: 0.8, gapSeconds: 2.4, note: "Different voice" },
  {
    id: "g",
    label: "G",
    voice: "alice",
    speed: 0.75,
    gapSeconds: 2.8,
    note: "Different voice, slower",
  },
];

function VoiceLab() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.addEventListener("ended", () => setPlaying(null));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  async function play(candidate: Candidate) {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing === candidate.id) {
      audio.pause();
      setPlaying(null);
      return;
    }

    // Claim permission inside the tap, before any await — the same reason the
    // story player needed two taps until this morning.
    if (!audio.src) {
      audio.src = SILENT_WAV;
      void audio.play().catch(() => undefined);
    }

    const cached = urls[candidate.id];
    if (cached) {
      audio.src = cached;
      void audio.play().then(() => setPlaying(candidate.id));
      return;
    }

    setLoading(candidate.id);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("speak-line", {
        body: {
          text: PASSAGE,
          voice: candidate.voice,
          speed: candidate.speed,
          gapSeconds: candidate.gapSeconds,
        },
      });
      if (fnError) throw fnError;

      const url = (data as { audioUrl?: string } | null)?.audioUrl;
      if (!url) throw new Error("No audio came back.");

      setUrls((current) => ({ ...current, [candidate.id]: url }));
      audio.src = url;
      await audio.play();
      setPlaying(candidate.id);
    } catch {
      setError("That one didn't generate. Try it again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <PageTransition>
      <h1 className="font-display text-[28px] font-medium leading-none">Pick a voice</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Same two sentences, seven ways. Play them in order, with the sound you&rsquo;d actually use
        &mdash; phone speaker or headphones, whichever is real. Then tell me the letter.
      </p>

      <blockquote className="mt-5 rounded-[24px] border border-glass-border bg-card/40 p-5 font-display text-[15px] italic leading-relaxed">
        {PASSAGE}
      </blockquote>

      <div className="mt-6 space-y-2">
        {CANDIDATES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => void play(candidate)}
            disabled={loading !== null}
            className={cn(
              "flex w-full items-center gap-4 rounded-[22px] border p-4 text-left transition",
              playing === candidate.id
                ? "border-primary bg-primary/10"
                : "border-glass-border bg-card/40 hover:bg-card/60",
              loading !== null && loading !== candidate.id && "opacity-50",
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {loading === candidate.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : playing === candidate.id ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg">{candidate.label}</span>
              <span className="block text-[13px] text-muted-foreground">{candidate.note}</span>
            </span>
            {urls[candidate.id] && (
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Ready
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-[13px] text-muted-foreground">{error}</p>}

      <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
        First play of each takes a few seconds while it&rsquo;s generated. After that they&rsquo;re
        instant, so go back and compare the two or three you like properly &mdash; the first
        impression and the second rarely agree.
      </p>
    </PageTransition>
  );
}
