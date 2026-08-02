import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AiMessage = Database["public"]["Tables"]["ai_messages"]["Row"];

export type CoachMessage = { role: "user" | "assistant"; content: string };

export const coachKeys = {
  chats: ["ai-chats"] as const,
  messages: (chatId: string) => ["ai-messages", chatId] as const,
};

export const COACH_STARTERS = [
  "I'm losing motivation — help me restart.",
  "What should I focus on this week?",
  "I keep missing my habits. What's going wrong?",
  "Help me break my goal into a first step.",
] as const;

export function useChats() {
  const userId = useUserId();
  return useQuery({
    queryKey: coachKeys.chats,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_chats")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: coachKeys.messages(chatId ?? "none"),
    enabled: Boolean(chatId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("chat_id", chatId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      const { error } = await supabase.from("ai_chats").delete().eq("id", chatId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: coachKeys.chats }),
    onError: (error: Error) => toast.error(error.message || "Couldn't delete that conversation"),
  });
}

type SendState = {
  /** Text streaming in right now, before it's persisted. */
  streaming: string;
  isStreaming: boolean;
};

/**
 * Sends a message to the coach edge function and streams the reply.
 * Persists both sides to `ai_messages` once the stream completes.
 */
export function useCoachStream(chatId: string | null, onChatCreated: (id: string) => void) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SendState>({ streaming: "", isStreaming: false });
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState({ streaming: "", isStreaming: false });
  }, []);

  const send = useCallback(
    async (content: string, history: CoachMessage[]) => {
      if (!userId) return;

      setState({ streaming: "", isStreaming: true });
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Create the conversation lazily, so an abandoned draft doesn't leave a shell.
        let activeChatId = chatId;
        if (!activeChatId) {
          const { data, error } = await supabase
            .from("ai_chats")
            .insert({ user_id: userId, title: content.slice(0, 60) })
            .select()
            .single();
          if (error) throw error;
          activeChatId = data.id;
          onChatCreated(data.id);
          void queryClient.invalidateQueries({ queryKey: coachKeys.chats });
        }

        const { error: userMsgError } = await supabase.from("ai_messages").insert({
          chat_id: activeChatId,
          user_id: userId,
          role: "user",
          content,
        });
        if (userMsgError) throw userMsgError;
        void queryClient.invalidateQueries({ queryKey: coachKeys.messages(activeChatId) });

        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Your session expired. Sign in again.");

        const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
        const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", content }] }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          throw new Error(detail?.message ?? "The coach is unavailable right now.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantText += delta;
                setState({ streaming: assistantText, isStreaming: true });
              }
            } catch {
              // Partial JSON across chunk boundaries — the buffer picks it up next pass.
            }
          }
        }

        if (assistantText.trim()) {
          const { error: assistantError } = await supabase.from("ai_messages").insert({
            chat_id: activeChatId,
            user_id: userId,
            role: "assistant",
            content: assistantText,
          });
          if (assistantError) throw assistantError;
          void queryClient.invalidateQueries({ queryKey: coachKeys.messages(activeChatId) });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error((error as Error).message || "The coach is unavailable right now.");
        }
      } finally {
        setState({ streaming: "", isStreaming: false });
        abortRef.current = null;
      }
    },
    [chatId, onChatCreated, queryClient, userId],
  );

  return { ...state, send, stop };
}
