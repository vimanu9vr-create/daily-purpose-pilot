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
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { coverImage, themeFor } from "@/features/stories/imagery";
import { useStory, useToggleStoryFavorite } from "@/features/stories/use-stories";
import { formatClock, useNarration } from "@/hooks/use-narration";
import { useStudioNarration } from "@/hooks/use-studio-narration";
import { ambientPad } from "@/lib/ambient-audio";
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
  const toggleFavorite = useToggleStoryFavorite();

  const [showFullStory, setShowFullStory] = useState(false);
  const [music, setMusic] = useState(false);

  const browser = useNarration(story?.body ?? "");
  const studio = useStudioNarration(
    story?.id,
    story?.body ?? "",
    story?.audio_url ?? null,
    (story?.audio_marks as number[] | null) ?? null,
    browser.sentences,
  );

  // Real narration when it exists, browser speech otherwise. Same surface,
  // so nothing below needs to know which one is running.
  const narration = studio.available ? studio : browser;

  // Stop whichever engine isn't in use, so they can't overlap.
  useEffect(() => {
    if (studio.available) browser.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.available]);

  // Always fade the pad out when leaving the player.
  useEffect(() => {
    return () => {
      void ambientPad().stop();
    };
  }, []);

  async function toggleMusic() {
    const pad = ambientPad();
    if (music) {
      await pad.stop();
      setMusic(false);
    } else {
      // Browsers only allow audio to start from a user gesture — this is one.
      await pad.start(0.14);
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
  const remaining = narration.totalSeconds - narration.elapsedSeconds;
  const progress = narration.totalSeconds
    ? (narration.elapsedSeconds / narration.totalSeconds) * 100
    : 0;

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
              void ambientPad().stop();
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
            onClick={() => void toggleMusic()}
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
                if (studio.available) studio.seekToRatio(ratio);
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
              <span>{formatClock(narration.elapsedSeconds)}</span>
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
                narration.toggle();
              }}
              disabled={!studio.available && !browser.isSupported}
              aria-label={narration.isPlaying ? "Pause" : "Play"}
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-primary shadow-xl transition hover:scale-105 disabled:opacity-50"
            >
              {narration.isPlaying ? (
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
