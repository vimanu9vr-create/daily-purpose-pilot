import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Loader2, Plus, Sparkles, Type, X } from "lucide-react";
import { useRef, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { useDesires } from "@/features/stories/use-stories";
import { cn } from "@/lib/utils";

import { suggestBoardItems } from "@/features/vision/suggest-board";
import {
  BOARD_CATEGORIES,
  useAddItem,
  useCreateBoard,
  useDeleteBoard,
  useDeleteItem,
  useUploadVisionImage,
  useVisionBoards,
  useVisionItems,
} from "@/features/vision/use-vision";

export const Route = createFileRoute("/_authenticated/app/vision")({
  head: () => ({ meta: [{ title: "Vision — ManifestAI" }] }),
  component: Vision,
});

/**
 * Vision boards.
 *
 * The blank-canvas problem is why this feature usually goes unused in other
 * apps: "create a board" then an empty grid is a request for homework. So a
 * new board arrives already populated — imagery and two lines drawn from what
 * the person already told us they want — and they edit rather than start.
 *
 * Everything generated is removable. A board you can't change is a mood board
 * someone else made.
 */
function Vision() {
  const { data: boards, isPending } = useVisionBoards();
  const { data: desires } = useDesires();
  const createBoard = useCreateBoard();
  const addItem = useAddItem();

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function create(category: (typeof BOARD_CATEGORIES)[number]) {
    const boardId = await createBoard.mutateAsync({
      title: category.label,
      category: category.id,
    });

    // Fill it immediately. An empty board is the reason nobody comes back.
    const items = suggestBoardItems({
      title: category.label,
      category: category.id,
      desires: (desires ?? []).map((desire) => desire.title),
    });

    for (const item of items) {
      await addItem.mutateAsync({
        boardId,
        kind: item.kind,
        body: item.kind === "text" ? item.body : null,
        imageUrl: item.kind === "image" ? item.imageUrl : null,
      });
    }

    setCreating(false);
    setOpenId(boardId);
  }

  if (isPending) {
    return (
      <PageTransition>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  const open = boards?.find((board) => board.id === openId) ?? null;
  if (open) {
    return <BoardDetail boardId={open.id} title={open.title} onBack={() => setOpenId(null)} />;
  }

  return (
    <PageTransition>
      <h1 className="font-display text-[28px] font-medium leading-none">Vision</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Somewhere to put what you want where you&rsquo;ll actually see it.
      </p>

      {(boards?.length ?? 0) === 0 && !creating && (
        <section className="mt-8 rounded-3xl glass-panel px-7 py-12 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-4 font-display text-2xl">Start a board</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Pick an area and it arrives with imagery and a couple of lines already in it. Change
            anything you don&rsquo;t like.
          </p>
          <Button variant="hero" className="mt-6 rounded-full" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New board
          </Button>
        </section>
      )}

      {creating && (
        <section className="mt-6 grid grid-cols-2 gap-3">
          {BOARD_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              disabled={createBoard.isPending || addItem.isPending}
              onClick={() => void create(category)}
              className="rounded-3xl border border-glass-border bg-card/50 px-4 py-6 text-center transition active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-2xl">{category.emoji}</span>
              <span className="mt-2 block text-sm font-medium">{category.label}</span>
            </button>
          ))}
        </section>
      )}

      {(boards?.length ?? 0) > 0 && (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3">
            {boards!.map((board) => (
              <BoardTile key={board.id} board={board} onOpen={() => setOpenId(board.id)} />
            ))}
          </div>

          {!creating && (
            <Button
              variant="glass"
              className="mt-5 w-full rounded-full"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" /> New board
            </Button>
          )}
        </>
      )}
    </PageTransition>
  );
}

function BoardTile({
  board,
  onOpen,
}: {
  board: { id: string; title: string; category: string | null };
  onOpen: () => void;
}) {
  const { data: items } = useVisionItems(board.id);
  const cover = items?.find((item) => item.kind === "image")?.image_url ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-muted shadow-card"
    >
      {cover && (
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute inset-x-4 bottom-4 text-left">
        <span className="block font-display text-lg text-white">{board.title}</span>
        <span className="block text-xs text-white/70">{items?.length ?? 0} pieces</span>
      </span>
    </button>
  );
}

function BoardDetail({
  boardId,
  title,
  onBack,
}: {
  boardId: string;
  title: string;
  onBack: () => void;
}) {
  const { data: items } = useVisionItems(boardId);
  const addItem = useAddItem();
  const deleteItem = useDeleteItem();
  const deleteBoard = useDeleteBoard();
  const upload = useUploadVisionImage();

  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);

  return (
    <PageTransition>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Boards
        </button>
        <button
          type="button"
          onClick={() => {
            deleteBoard.mutate(boardId);
            onBack();
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          Delete board
        </button>
      </div>

      <h1 className="mt-4 font-display text-[28px] font-medium leading-none">{title}</h1>

      <div className="mt-6 columns-2 gap-3 [column-fill:_balance]">
        {(items ?? []).map((item) => (
          <div key={item.id} className="group relative mb-3 break-inside-avoid">
            {item.kind === "image" && item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                loading="lazy"
                className="w-full rounded-[22px] object-cover"
              />
            ) : (
              <p className="rounded-[22px] border border-glass-border bg-card/60 p-4 text-[15px] italic leading-relaxed">
                {item.body}
              </p>
            )}
            <button
              type="button"
              onClick={() => deleteItem.mutate({ id: item.id, boardId })}
              aria-label="Remove"
              className="absolute right-2 top-2 rounded-full bg-black/45 p-1.5 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {writing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            addItem.mutate({ boardId, kind: "text", body: draft.trim() });
            setDraft("");
            setWriting(false);
          }}
          className="mt-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            placeholder="Write a line for this board"
            className="w-full rounded-full border border-glass-border bg-card/50 px-5 py-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </form>
      )}

      <div className="mt-5 flex gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate({ boardId, file });
            event.target.value = "";
          }}
        />
        <Button
          variant="glass"
          className="flex-1 rounded-full"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          Photo
        </Button>
        <Button
          variant="glass"
          className={cn("flex-1 rounded-full", writing && "ring-1 ring-primary/40")}
          onClick={() => setWriting((w) => !w)}
        >
          <Type className="h-4 w-4" /> Words
        </Button>
      </div>
    </PageTransition>
  );
}
