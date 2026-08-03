import { Check, Loader2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { storeVoiceName, storedVoiceName } from "@/hooks/use-speech";
import {
  selectableVoices,
  speakSentences,
  storePace,
  storedPace,
  type Pace,
} from "@/lib/speech-engine";
import { cn } from "@/lib/utils";

const SAMPLE_SENTENCES = ["I am exactly where I need to be.", "There is no rush in this."];

const PACES: { id: Pace; label: string; hint: string }[] = [
  { id: "calm", label: "Calm", hint: "Slow, with space between lines" },
  { id: "gentle", label: "Gentle", hint: "A little quicker" },
  { id: "natural", label: "Natural", hint: "Closer to speaking pace" },
];

/**
 * Lets the user pick which voice reads their stories and affirmations.
 *
 * Voices differ enormously between devices — the default is often the worst
 * one available, so being able to choose matters more than it sounds.
 */
export function VoicePicker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [pace, setPace] = useState<Pace>("calm");

  useEffect(() => {
    let cancelled = false;
    setPace(storedPace());
    void selectableVoices().then((list) => {
      if (cancelled) return;
      setVoices(list);
      setSelected(storedVoiceName() ?? list[0]?.name ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function preview(voiceName: string | null, nextPace: Pace) {
    setPreviewing(voiceName ?? "");
    void speakSentences({
      sentences: SAMPLE_SENTENCES,
      voiceName,
      pace: nextPace,
      onDone: () => setPreviewing(null),
      onError: () => setPreviewing(null),
    });
  }

  function choose(name: string) {
    setSelected(name);
    storeVoiceName(name);
    preview(name, pace);
  }

  function choosePace(next: Pace) {
    setPace(next);
    storePace(next);
    preview(selected, next);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding voices…
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        This browser doesn't expose any voices. On Android, install a text-to-speech engine; on
        desktop, Chrome has the best selection.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="eyebrow pb-1 text-muted-foreground">Pace</p>
      <div className="flex gap-2 pb-4">
        {PACES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => choosePace(option.id)}
            aria-pressed={pace === option.id}
            className={cn(
              "flex-1 rounded-2xl px-3 py-2.5 text-left transition",
              pace === option.id ? "bg-primary text-primary-foreground" : "bg-accent/40",
            )}
          >
            <span className="block text-xs font-medium">{option.label}</span>
            <span
              className={cn(
                "mt-0.5 block text-[10px] leading-tight",
                pace === option.id ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {option.hint}
            </span>
          </button>
        ))}
      </div>

      <p className="eyebrow pb-1 text-muted-foreground">Voice</p>
      {voices.map((voice) => (
        <button
          key={voice.name}
          type="button"
          onClick={() => choose(voice.name)}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition",
            selected === voice.name ? "bg-primary text-primary-foreground" : "bg-accent/40",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{cleanName(voice.name)}</span>
            <span
              className={cn(
                "block text-[11px]",
                selected === voice.name ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {voice.lang}
              {voice.localService ? " · on device" : " · online"}
            </span>
          </span>
          {previewing === voice.name ? (
            <Volume2 className="h-4 w-4 shrink-0 animate-pulse" />
          ) : selected === voice.name ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : null}
        </button>
      ))}
      <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Tap one to hear it. Which voices exist depends on your device.
      </p>
    </div>
  );
}

/** "Microsoft Aria Online (Natural) - English (United States)" is unreadable. */
function cleanName(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/^(Microsoft|Google|Apple)\s+/i, "")
    .replace(/\s*-\s*English.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
