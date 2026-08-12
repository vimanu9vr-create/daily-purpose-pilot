import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Heart,
  Loader2,
  Mic,
  MicOff,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppPage } from "@/components/app/app-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  JOURNAL_PROMPTS,
  MOODS,
  promptForToday,
  useCreateEntry,
  useDeleteEntry,
  useJournalEntries,
  useJournalStats,
  useToggleJournalFavorite,
  useUpdateEntry,
  type JournalEntry,
} from "@/features/journal/use-journal";
import { collectTags, searchEntries } from "@/features/journal/search";
import { useDictation } from "@/hooks/use-dictation";
import { formatLongDate, monthKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/journal")({
  head: () => ({ meta: [{ title: "Journal — ManifestAI" }] }),
  component: Journal,
});

function Journal() {
  const { data: entries, isPending, error } = useJournalEntries();
  const stats = useJournalStats();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const toggleFavorite = useToggleJournalFavorite();

  const [promptIndex, setPromptIndex] = useState(() =>
    JOURNAL_PROMPTS.indexOf(promptForToday() as (typeof JOURNAL_PROMPTS)[number]),
  );
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  // Dictation appends to the draft rather than replacing it, so speaking
  // twice adds to what's there instead of wiping the first attempt.
  const dictation = useDictation((text) => setDraft((current) => `${current} ${text}`.trim()));

  const prompt = JOURNAL_PROMPTS[promptIndex] ?? JOURNAL_PROMPTS[0];

  const allTags = useMemo(() => collectTags(entries ?? []), [entries]);

  const visible = useMemo(() => {
    let rows = entries ?? [];
    if (favouritesOnly) rows = rows.filter((entry) => entry.is_favorite);
    if (tag) rows = rows.filter((entry) => entry.tags?.includes(tag));
    return searchEntries(rows, query);
  }, [entries, query, tag, favouritesOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of visible) {
      const key = monthKey(entry.entry_date);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return [...map.entries()];
  }, [visible]);

  const filtering = Boolean(query.trim() || tag || favouritesOnly);

  function save() {
    const content = draft.trim();
    if (!content) return;
    createEntry.mutate(
      { content, prompt, mood },
      {
        onSuccess: () => {
          setDraft("");
          setMood(null);
        },
      },
    );
  }

  return (
    <AppPage
      title="Journal"
      description="Guided prompts for reflection, gratitude and mood — three minutes is enough."
    >
      <section className="rounded-3xl glass-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Today's prompt
            </p>
            <h2 className="mt-1.5 font-display text-lg font-semibold leading-snug">{prompt}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Show a different prompt"
            onClick={() => setPromptIndex((i) => (i + 1) % JOURNAL_PROMPTS.length)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder="Write freely — nobody's grading this."
          className="mt-4 resize-none"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(mood === m.value ? null : m.value)}
                title={m.label}
                aria-label={`Mood: ${m.label}`}
                aria-pressed={mood === m.value}
                className={cn(
                  "h-10 w-10 rounded-2xl text-lg transition-all duration-200",
                  mood === m.value
                    ? "scale-110 surface-gradient shadow-glow"
                    : "opacity-50 hover:opacity-100",
                )}
              >
                {m.emoji}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden where the browser has no speech engine, rather than
                shown and silently failing. */}
            {dictation.supported && (
              <Button
                variant="glass"
                onClick={dictation.toggle}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? "Stop dictation" : "Dictate your entry"}
                className={cn(dictation.listening && "ring-1 ring-primary/50")}
              >
                {dictation.listening ? <MicOff /> : <Mic />}
              </Button>
            )}
            <Button variant="hero" onClick={save} disabled={!draft.trim() || createEntry.isPending}>
              {createEntry.isPending && <Loader2 className="animate-spin" />}
              Save entry
            </Button>
          </div>
        </div>
      </section>

      {stats.count > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {stats.count} {stats.count === 1 ? "entry" : "entries"}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          {stats.streak} day streak
        </p>
      )}

      {/* Search and filters. Only shown once there's enough written to need
          them — a search box over three entries is furniture. */}
      {(entries?.length ?? 0) > 3 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 rounded-full border border-glass-border bg-card/50 px-4 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your writing"
              aria-label="Search your journal"
              className="min-w-0 flex-1 bg-transparent py-1 text-[15px] placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 rounded-full p-1 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFavouritesOnly((on) => !on)}
              aria-pressed={favouritesOnly}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                favouritesOnly
                  ? "surface-gradient text-primary-foreground"
                  : "bg-primary/10 text-primary",
              )}
            >
              <Heart className={cn("h-3 w-3", favouritesOnly && "fill-current")} /> Saved
            </button>

            {allTags.slice(0, 8).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTag(tag === name ? null : name)}
                aria-pressed={tag === name}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  tag === name
                    ? "surface-gradient text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {filtering && visible.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing matches that. Try a single word — search looks for the stem, so
            &ldquo;worry&rdquo; finds &ldquo;worrying&rdquo;.
          </p>
        )}

        {isPending && (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        )}

        {error && (
          <div className="rounded-3xl glass-panel p-6 text-sm text-destructive">
            Couldn't load your entries. {error.message}
          </div>
        )}

        {entries && entries.length === 0 && (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border px-8 py-12 text-center">
            <BookOpen className="h-6 w-6 text-muted-foreground/60" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Entries you write will be collected here with their prompt and mood, so you can look
              back at how your thinking changed.
            </p>
          </div>
        )}

        {grouped.map(([month, monthEntries]) => (
          <section key={month} className="mb-8">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {month}
            </h3>
            <ul className="space-y-2.5">
              {monthEntries.map((entry) => {
                const moodMeta = MOODS.find((m) => m.value === entry.mood);
                const expanded = expandedId === entry.id;
                const editing = editingId === entry.id;

                return (
                  <li key={entry.id} className="group rounded-2xl glass-panel p-4">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 text-left"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      aria-expanded={expanded}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {moodMeta?.emoji ?? "📝"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatLongDate(entry.entry_date)}
                          </span>
                          {entry.prompt && (
                            <span className="truncate text-xs text-muted-foreground/60">
                              {entry.prompt}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "mt-1.5 block whitespace-pre-wrap text-sm leading-relaxed",
                            !expanded && "line-clamp-2",
                          )}
                        >
                          {entry.content}
                        </span>
                      </span>

                      {/* A favourite is "this writing was worth keeping",
                          which is a different thing from mood. People star the
                          entry where they finally worked something out, and
                          that is rarely the day they felt best. */}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={entry.is_favorite ? "Remove from saved" : "Save this entry"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite.mutate({ id: entry.id, favorite: !entry.is_favorite });
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.stopPropagation();
                          toggleFavorite.mutate({ id: entry.id, favorite: !entry.is_favorite });
                        }}
                        className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground/50 transition-colors hover:text-primary"
                      >
                        <Heart
                          className={cn(
                            "h-4 w-4",
                            entry.is_favorite && "fill-primary text-primary",
                          )}
                        />
                      </span>
                    </button>

                    {(entry.tags?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                        {entry.tags.map((name) => (
                          <span
                            key={name}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}

                    {expanded && (
                      <div className="mt-3 border-t border-border pt-3">
                        {editing ? (
                          <div className="space-y-2">
                            <Textarea
                              autoFocus
                              rows={5}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={updateEntry.isPending}
                                onClick={() =>
                                  updateEntry.mutate(
                                    { id: entry.id, content: editDraft },
                                    { onSuccess: () => setEditingId(null) },
                                  )
                                }
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(entry.id);
                                setEditDraft(entry.content);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteEntry.mutate(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </AppPage>
  );
}
