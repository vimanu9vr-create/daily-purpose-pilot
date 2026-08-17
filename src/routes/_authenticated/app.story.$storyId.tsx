import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  Heart,
  Loader2,
  Music,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { coverImage, themeFor } from "@/features/stories/imagery";
import {
  storyKeys,
  useRecordStoryDuration,
  useStory,
  useToggleStoryFavorite,
} from "@/features/stories/use-stories";
import { supabase } from "@/integrations/supabase/client";
import { formatClock, useNarration } from "@/hooks/use-narration";
import { useSessionBed } from "@/hooks/use-session-bed";
import { useStudioNarration } from "@/hooks/use-studio-narration";
import {
  ambientPad,
  frequencyFromTitle,
  toneGenerator,
  unlockAudioSession,
} from "@/lib/ambient-audio";
import { haptic, share as nativeShare } from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/story/$storyId")({
  head: () => ({ meta: [{ title: "Listening — ManifestAI" }] }),
  component: StoryPlayer,
});

function StoryPlayer() {
  const { storyId } = Route.useParams();
  const navigate = useNavigate();
  const { data: story, isPending } = useStory(storyId);
  const queryClient = useQueryClient();
  const toggleFavorite = useToggleStoryFavorite();

  const [showFullStory, setShowFullStory] = useState(false);
  // Background sound is on by default now — it is part of how this is meant
  // to sound, not an extra.
  const [music, setMusic] = useState(true);

  const browser = useNarration(story?.body ?? "");
  const studio = useStudioNarration(
    story?.id,
    story?.body ?? "",
    story?.audio_url ?? null,
    (story?.audio_marks as number[] | null) ?? null,
    browser.sentences,
  );

  // Sarah, always. The browser voice is no longer a fallback — it was the
  // thing that made the app feel cheap, and it kept winning the race on first
  // play: generating Sarah takes a few seconds, and the old code started
  // speech synthesis in the meantime. So you got the robot the first time and
  // Sarah the second, once the audio was cached.
  //
  // Now the first press waits. If Sarah genuinely can't be produced we say so
  // rather than substituting a worse voice.
  const narration = studio.available ? studio : browser;

  // A "528 Hz" track with no 528 Hz tone is just text. Play the real thing.
  const toneHz = story?.kind === "frequency" ? frequencyFromTitle(story.title) : null;

  // Sleep, meditation and frequency sessions are timed experiences rather than
  // a piece of speech, so their clock and their sound run for the advertised
  // length instead of stopping when the voice does.
  /**
   * Affirmation tracks count as sessions now.
   *
   * They were excluded because an "affirmation" used to be a single sentence.
   * They're ten-minute tracks built from a repeating set, so they need the
   * timed bed and the returning voice like every other session — otherwise a
   * 10 MIN label would end after one pass, which is the exact bug we spent
   * today fixing on the sleep tracks.
   */
  const isSession = story ? story.kind !== "story" : false;
  const bed = useSessionBed({
    kind: (story?.kind as "sleep") ?? "story",
    totalSeconds: story?.duration_seconds ?? 0,
    toneHz,
    speaking: narration.isPlaying,
    enabled: isSession,
  });

  // Stories don't have a fixed length, so their pad simply follows the voice.
  // This is why narration sounded bare: the pad existed but was behind a
  // toggle almost nobody found, so speech played over silence.
  useEffect(() => {
    if (isSession || !music) return;
    // Raised from 0.09. At that level the pad was technically playing and
    // effectively inaudible on a phone speaker, so narration still landed on
    // silence — which is most of why it read as a voice reading text rather
    // than a voice in a room. Still well under the speech; it should be felt
    // rather than noticed.
    if (narration.isPlaying) ambientPad().start(0.16);
    else ambientPad().stop();
  }, [narration.isPlaying, isSession, music]);

  // Once the audio tells us its real length, stop guessing. Sessions are
  // excluded: a sleep track is deliberately longer than its narration, so its
  // stated duration is the truth and the audio length isn't.
  const recordDuration = useRecordStoryDuration();
  useEffect(() => {
    if (isSession || !story) return;
    const actual = studio.totalSeconds;
    if (!actual || !Number.isFinite(actual)) return;
    // Only write when it's meaningfully different, so playing a story twice
    // doesn't produce a pointless update every time.
    if (Math.abs(actual - story.duration_seconds) < 3) return;
    recordDuration.mutate({ storyId: story.id, seconds: actual });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.totalSeconds, story?.id, isSession]);

  /**
   * Bring the voice back through a long session.
   *
   * This is the "18 minutes plays for 2" complaint. The bed genuinely ran for
   * the full eighteen minutes, but the narration is about three minutes long —
   * so after three minutes there was nothing but a quiet pad, which is
   * indistinguishable from the track having stopped.
   *
   * Real guided sleep audio doesn't talk continuously either; it returns
   * every couple of minutes with long silences between. So that's what this
   * does: once the voice finishes, wait, then play it again, as long as
   * there's enough time left to be worth starting. The silence is intentional
   * and the returning voice is what tells you it's still running.
   */
  const RETURN_AFTER_SECONDS = 75;
  useEffect(() => {
    if (!isSession || !bed.isRunning || !studio.available) return;
    if (narration.isPlaying) return;

    const remainingSeconds = bed.totalSeconds - bed.elapsedSeconds;
    // Don't start a pass that would be cut off by the end of the session.
    if (remainingSeconds < RETURN_AFTER_SECONDS + 60) return;

    const id = window.setTimeout(() => narration.play(0), RETURN_AFTER_SECONDS * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSession, bed.isRunning, narration.isPlaying, studio.available]);

  /**
   * Give this story its own artwork, the first time anyone opens it.
   *
   * Generated on open rather than on creation. Forty-two stories are written
   * every refresh and most are never played, so generating a picture for all
   * of them would cost more per day than the subscription costs per month.
   * Opening one is the signal that it's worth four cents.
   *
   * Fire-and-forget: the stock photo is already on screen and stays there if
   * this fails or is slow. It arrives on the next visit instead.
   */
  useEffect(() => {
    if (!story) return;
    const stock = !story.image_url || story.image_url.includes("unsplash.com");
    if (!stock) return;

    void supabase.functions
      .invoke("generate-cover", { body: { storyId: story.id } })
      .then(() => queryClient.invalidateQueries({ queryKey: storyKeys.story(story.id) }))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  /**
   * Start rendering the narration while they're still looking at the cover.
   *
   * This is what replaces the old split. Opening a track and pressing play are
   * a few seconds apart, and those are seconds the audio can spend being made
   * — which buys the same head start as splitting did, without ever leaving a
   * gap in the middle of a track.
   */
  useEffect(() => {
    if (!story?.body) return;
    void studio.prepare("sarah");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Stop whichever engine isn't in use, so they can't overlap.
  useEffect(() => {
    if (studio.available) browser.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.available]);

  // Always fade the pad out when leaving the player.
  useEffect(() => {
    return () => {
      ambientPad().stop();
      toneGenerator().stop();
    };
  }, []);

  // Synchronous on purpose. Awaiting anything before creating the AudioContext
  // moves it off the gesture tick, and iOS then produces silence.
  function toggleMusic() {
    const pad = ambientPad();
    if (music) {
      pad.stop();
      setMusic(false);
    } else {
      pad.start(0.14);
      setMusic(true);
    }
  }

  if (isPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <p className="text-sm text-muted-foreground">That story is no longer here.</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/app" })}
          className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground"
        >
          Back home
        </button>
      </div>
    );
  }

  const image = story.image_url ?? coverImage(story.id, themeFor(story.category));

  // Sessions report their own clock; stories report the voice's.
  const elapsed = isSession ? bed.elapsedSeconds : narration.elapsedSeconds;
  const total = isSession ? bed.totalSeconds : narration.totalSeconds;
  const remaining = total - elapsed;
  const progress = total ? (elapsed / total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />

      <div className="relative flex h-full flex-col px-6 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              narration.stop();
              ambientPad().stop();
              toneGenerator().stop();
              navigate({ to: "/app" });
            }}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-display text-lg italic text-white/90">ManifestAI</span>
          <button
            type="button"
            onClick={toggleMusic}
            aria-label={music ? "Turn background music off" : "Turn background music on"}
            aria-pressed={music}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition",
              music ? "bg-white text-primary" : "bg-white/15 text-white hover:bg-white/25",
            )}
          >
            <Music className="h-4 w-4" />
          </button>
        </header>

        {/* The line being spoken */}
        <div className="flex flex-1 items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={narration.currentIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="font-display text-[26px] leading-[1.35] text-white drop-shadow md:text-[32px]"
            >
              {narration.currentSentence || story.hook || story.title}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullStory(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-[13px] text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <BookOpen className="h-3.5 w-3.5" /> Read the full story
            </button>

            {!studio.available && (
              <button
                type="button"
                onClick={() => {
                  browser.stop();
                  void studio.generate("sarah");
                }}
                disabled={studio.isGenerating}
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-[13px] text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-60"
              >
                {studio.isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {studio.isGenerating ? "Recording…" : "Studio voice"}
              </button>
            )}
          </div>

          {studio.error && <p className="text-[11px] text-white/60">{studio.error}</p>}

          {/* Device voices vary enormously and the default is often the worst
              one installed, so make the picker reachable from here. */}
          {!studio.available && !toneHz && browser.isSupported && (
            <button
              type="button"
              onClick={() => {
                narration.stop();
                navigate({ to: "/app/profile" });
              }}
              className="text-[11px] text-white/50 underline underline-offset-2"
            >
              Voice sound wrong? Change it in You → Voice
            </button>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="min-w-0 flex-1 truncate text-sm text-white/60">{story.title}</p>
            <button
              type="button"
              onClick={narration.toggleLoop}
              aria-label={narration.looping ? "Stop repeating" : "Repeat this story"}
              aria-pressed={narration.looping}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full backdrop-blur-sm transition",
                narration.looping ? "bg-white text-primary" : "bg-white/15 text-white",
              )}
            >
              <Repeat className="h-4 w-4" />
            </button>
          </div>

          {/* Scrubber */}
          <div>
            <div
              className="relative h-1 w-full cursor-pointer rounded-full bg-white/25"
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={browser.sentences.length - 1}
              aria-valuenow={narration.currentIndex}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") narration.skip(10);
                if (e.key === "ArrowLeft") narration.skip(-10);
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                // Real audio can seek anywhere; speech synthesis only per sentence.
                if (isSession) bed.seekToRatio(ratio);
                else if (studio.available) studio.seekToRatio(ratio);
                else browser.seekToSentence(Math.round(ratio * (browser.sentences.length - 1)));
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
              <span
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-white/60">
              <span>{formatClock(elapsed)}</span>
              <span>-{formatClock(remaining)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                toggleFavorite.mutate({ id: story.id, isFavorite: !story.is_favorite })
              }
              aria-label={story.is_favorite ? "Remove from saved" : "Save this story"}
              className="flex h-11 w-11 items-center justify-center text-white/85 transition hover:text-white"
            >
              <Heart className={cn("h-6 w-6", story.is_favorite && "fill-current text-ember")} />
            </button>

            <button
              type="button"
              onClick={() => narration.skip(-10)}
              aria-label="Back ten seconds"
              className="flex h-11 w-11 items-center justify-center text-white/85 transition hover:text-white"
            >
              <RotateCcw className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={() => {
                void haptic("medium");

                // A timed session: the bed runs for the advertised length and
                // the voice sits on top of it. Previously a frequency track
                // played a tone with no narration, and a sleep track played
                // forty seconds of speech and then nothing — while the label
                // promised eighteen minutes.
                if (isSession) {
                  if (bed.isRunning) {
                    bed.pause();
                    narration.stop();
                  } else {
                    bed.start();
                    if (!studio.available) {
                      // Synchronously, inside the tap, before any await.
                      studio.unlock();
                      if (!studio.isGenerating) void studio.generate("sarah", true);
                    } else {
                      studio.toggle();
                    }
                  }
                  return;
                }

                // Sarah is the product; the browser voice is a fallback for
                // when she can't be had. She used to be hidden behind a second
                // "Studio voice" button, so pressing play gave you the robotic
                // voice and most people would never find her. Now the first
                // play generates her, and only for a story you actually chose
                // to listen to — so the per-character bill still tracks real
                // listening rather than browsing.
                if (!studio.available) {
                  if (studio.isGenerating) return;
                  unlockAudioSession();
                  // Claims permission for the narration elements specifically.
                  // unlockAudioSession() only unlocks the ambient bed's own
                  // element, and on iOS that permission does not carry across.
                  studio.unlock();
                  ambientPad().start(0.09);
                  void studio.generate("sarah", true);
                  return;
                }

                studio.toggle();
              }}
              disabled={studio.isGenerating}
              aria-label={(isSession ? bed.isRunning : narration.isPlaying) ? "Pause" : "Play"}
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-primary shadow-xl transition hover:scale-105 disabled:opacity-50"
            >
              {(isSession ? bed.isRunning : narration.isPlaying) ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="ml-1 h-7 w-7 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => narration.skip(10)}
              aria-label="Forward ten seconds"
              className="flex h-11 w-11 items-center justify-center text-white/85 transition hover:text-white"
            >
              <RotateCw className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={async () => {
                await haptic("light");
                const text = `${story.hook ?? story.title}\n\n${story.body}`;
                const shared = await nativeShare({ title: story.title, text });
                if (!shared) toast.error("Couldn't share that.");
              }}
              aria-label="Share"
              className="flex h-11 w-11 items-center justify-center text-white/85 transition hover:text-white"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>

          {!studio.available && !browser.isSupported && (
            <p className="text-center text-[11px] text-white/50">
              This browser can't read aloud. Tap "Read the full story" instead.
            </p>
          )}
        </div>
      </div>

      {/* Full text */}
      <AnimatePresence>
        {showFullStory && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="absolute inset-0 z-10 overflow-y-auto bg-background px-6 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]"
          >
            <div className="mx-auto max-w-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Full story</p>
                  <h2 className="mt-1.5 font-display text-3xl">{story.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullStory(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-7 space-y-5">
                {browser.sentences.map((sentence: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      narration.seekToSentence(i);
                      setShowFullStory(false);
                      if (!narration.isPlaying) narration.play(i);
                    }}
                    className={cn(
                      "block w-full text-left font-display text-[19px] leading-[1.6] transition-colors",
                      i === narration.currentIndex
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {sentence}
                  </button>
                ))}
              </div>

              <p className="mt-10 text-center text-xs leading-relaxed text-muted-foreground">
                Tap any line to start listening from there.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
