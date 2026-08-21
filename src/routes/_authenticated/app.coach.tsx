import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, MessageCircleHeart, Plus, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppPage } from "@/components/app/app-page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  COACH_STARTERS,
  useChatMessages,
  useChats,
  useCoachStream,
  useDeleteChat,
  type CoachMessage,
} from "@/features/coach/use-coach";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/coach")({
  head: () => ({ meta: [{ title: "Coach — ManifestAI" }] }),
  component: Coach,
});

function Coach() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useChats();
  const { data: messages } = useChatMessages(chatId);
  const deleteChat = useDeleteChat();
  const { streaming, isStreaming, send, stop } = useCoachStream(chatId, setChatId);

  const history = useMemo<CoachMessage[]>(
    () =>
      (messages ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    [messages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  function submit(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    setInput("");
    void send(content, history);
  }

  const isEmpty = history.length === 0 && !isStreaming;

  return (
    <AppPage
      title="Coach"
      description="A short daily conversation that turns intention into a concrete next action."
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        {chats && chats.length > 0 && (
          <aside className="lg:w-56 lg:shrink-0">
            <Button
              variant="glass"
              size="sm"
              className="w-full justify-start"
              onClick={() => setChatId(null)}
            >
              <Plus /> New conversation
            </Button>
            <ul className="mt-2 space-y-0.5">
              {chats.map((chat) => (
                <li key={chat.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setChatId(chat.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-xs transition-colors",
                      chatId === chat.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50",
                    )}
                  >
                    {chat.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteChat.mutate(chat.id);
                      if (chatId === chat.id) setChatId(null);
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete conversation: ${chat.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col rounded-3xl glass-panel">
          <div ref={scrollRef} className="max-h-[55vh] min-h-[320px] flex-1 overflow-y-auto p-6">
            {isEmpty ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl surface-gradient shadow-glow">
                  <MessageCircleHeart className="h-6 w-6 text-primary-foreground" />
                </span>
                <h2 className="mt-6 font-display text-xl font-semibold">What's on your mind?</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Your coach has read what you said you want to manifest, along with your habits and
                  recent journal entries, and ends every reply with one specific next action.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {COACH_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => submit(starter)}
                      className="rounded-2xl border border-border px-3.5 py-2 text-xs transition-colors hover:bg-accent/50"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-5">
                {history.map((message, index) => (
                  <li
                    key={index}
                    className={cn("flex gap-3", message.role === "user" && "justify-end")}
                  >
                    {message.role === "assistant" && (
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl surface-gradient">
                        <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        message.role === "user"
                          ? "surface-gradient text-primary-foreground"
                          : "bg-accent/50",
                      )}
                    >
                      {message.content}
                    </div>
                  </li>
                ))}

                {isStreaming && (
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl surface-gradient">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary-foreground" />
                    </span>
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent/50 px-4 py-2.5 text-sm leading-relaxed">
                      {streaming || <span className="text-muted-foreground">Thinking…</span>}
                    </div>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="border-t border-glass-border p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask your coach anything…"
                className="max-h-32 min-h-10 resize-none"
              />
              {isStreaming ? (
                <Button variant="glass" size="icon" onClick={stop} aria-label="Stop generating">
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  size="icon"
                  onClick={() => submit()}
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">
              Coaching is supportive guidance — not therapy, medical or financial advice.
            </p>
          </div>
        </section>
      </div>
    </AppPage>
  );
}
