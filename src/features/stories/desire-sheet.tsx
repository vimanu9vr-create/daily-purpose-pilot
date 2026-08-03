import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import {
  useCreateDesire,
  useDeleteDesire,
  useDesires,
  useGenerateStories,
  useUpdateDesire,
} from "./use-stories";

/**
 * "Edit desires" — Stella's reviewers complained that editing a desire didn't
 * change the stories they got. Here, saving an edit immediately regenerates.
 */
export function DesireSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: desires } = useDesires();
  const createDesire = useCreateDesire();
  const updateDesire = useUpdateDesire();
  const deleteDesire = useDeleteDesire();
  const generate = useGenerateStories();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const editing = desires?.find((d) => d.id === editingId);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
    }
  }, [editing]);

  function save() {
    if (!editingId || !title.trim()) return;
    updateDesire.mutate(
      { id: editingId, title, description },
      {
        onSuccess: () => {
          setEditingId(null);
          // The whole point: new words, new stories.
          generate.mutate({ perDesire: 3 });
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <p className="eyebrow">Edit desire</p>
          <SheetTitle className="font-display text-3xl font-medium">
            {editing ? "Refine your desire" : "Your desires"}
          </SheetTitle>
        </SheetHeader>

        {editing ? (
          <div className="mt-6 space-y-5 pb-6">
            <div>
              <label className="eyebrow text-muted-foreground" htmlFor="desire-title">
                Title
              </label>
              <Input
                id="desire-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 bg-accent/40"
              />
            </div>

            <div>
              <label className="eyebrow text-muted-foreground" htmlFor="desire-description">
                Description
              </label>
              <Textarea
                id="desire-description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does having this actually look like? The more specific, the less generic your stories."
                className="mt-2 resize-none bg-accent/40"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-full"
                onClick={save}
                disabled={!title.trim() || updateDesire.isPending || generate.isPending}
              >
                {updateDesire.isPending || generate.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Save changes
              </Button>
              <Button variant="ghost" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Saving rewrites your stories from the new wording.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2 pb-6">
            {(desires ?? []).map((desire) => (
              <div
                key={desire.id}
                className="group flex items-center gap-2 rounded-2xl bg-accent/40 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => setEditingId(desire.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium">{desire.title}</span>
                  {desire.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {desire.description}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => deleteDesire.mutate(desire.id)}
                  aria-label={`Remove ${desire.title}`}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTitle.trim()) {
                    createDesire.mutate(
                      { title: newTitle },
                      {
                        onSuccess: () => {
                          setNewTitle("");
                          generate.mutate({ perDesire: 3 });
                        },
                      },
                    );
                  }
                }}
                placeholder="Add another desire"
                className="bg-accent/40"
              />
              <Button
                size="icon"
                className="rounded-full"
                disabled={!newTitle.trim() || createDesire.isPending}
                onClick={() =>
                  createDesire.mutate(
                    { title: newTitle },
                    {
                      onSuccess: () => {
                        setNewTitle("");
                        generate.mutate({ perDesire: 3 });
                      },
                    },
                  )
                }
              >
                <Plus />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
