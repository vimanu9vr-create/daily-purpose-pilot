import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import { trail } from "@/lib/telemetry";

export type VisionBoard = {
  id: string;
  title: string;
  category: string | null;
  cover_url: string | null;
  created_at: string;
};

export type VisionItem = {
  id: string;
  board_id: string;
  kind: string;
  body: string | null;
  image_url: string | null;
  position: number;
};

export const visionKeys = {
  boards: ["vision", "boards"] as const,
  items: (boardId: string) => ["vision", "items", boardId] as const,
};

/** Board categories, matching the desire categories so one can seed the other. */
export const BOARD_CATEGORIES = [
  { id: "love", label: "Love", emoji: "❤️" },
  { id: "career", label: "Career", emoji: "💼" },
  { id: "wealth", label: "Money", emoji: "💰" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "home", label: "Lifestyle", emoji: "✨" },
  { id: "calm", label: "Growth", emoji: "🌱" },
] as const;

export function useVisionBoards() {
  const userId = useUserId();

  return useQuery({
    queryKey: visionKeys.boards,
    enabled: Boolean(userId),
    queryFn: async (): Promise<VisionBoard[]> => {
      const { data, error } = await supabase
        .from("vision_boards")
        .select("id,title,category,cover_url,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VisionBoard[];
    },
  });
}

export function useVisionItems(boardId: string | null) {
  const userId = useUserId();

  return useQuery({
    queryKey: visionKeys.items(boardId ?? "none"),
    enabled: Boolean(userId && boardId),
    queryFn: async (): Promise<VisionItem[]> => {
      const { data, error } = await supabase
        .from("vision_items")
        .select("id,board_id,kind,body,image_url,position")
        .eq("board_id", boardId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisionItem[];
    },
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ title, category }: { title: string; category: string | null }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("vision_boards")
        .insert({ user_id: userId, title: title.trim(), category })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: visionKeys.boards }),
    onError: () => toast.error("Couldn't create that board."),
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vision_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: visionKeys.boards }),
  });
}

export function useAddItem() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({
      boardId,
      kind,
      body,
      imageUrl,
    }: {
      boardId: string;
      kind: "image" | "text" | "affirmation" | "goal";
      body?: string | null;
      imageUrl?: string | null;
    }) => {
      if (!userId) throw new Error("Not signed in");

      const { data: last } = await supabase
        .from("vision_items")
        .select("position")
        .eq("board_id", boardId)
        .order("position", { ascending: false })
        .limit(1);

      const { error } = await supabase.from("vision_items").insert({
        user_id: userId,
        board_id: boardId,
        kind,
        body: body ?? null,
        image_url: imageUrl ?? null,
        position: (last?.[0]?.position ?? -1) + 1,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: visionKeys.items(variables.boardId) });
    },
    onError: () => toast.error("Couldn't add that."),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; boardId: string }) => {
      const { error } = await supabase.from("vision_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: visionKeys.items(variables.boardId) });
    },
  });
}

/**
 * Uploads a photo from the device.
 *
 * The path always begins with the user's id, because the storage policy only
 * permits writes inside a folder named after `auth.uid()`. That's what stops
 * one person from writing into another's folder, and it's enforced by the
 * database rather than by this function being careful.
 *
 * Images are capped at 8MB. Phone photos are routinely larger than that, and
 * a board of twelve full-resolution photos is a slow screen and a storage bill.
 */
export function useUploadVisionImage() {
  const userId = useUserId();
  const addItem = useAddItem();

  return useMutation({
    mutationFn: async ({ boardId, file }: { boardId: string; file: File }) => {
      if (!userId) throw new Error("Not signed in");
      if (!file.type.startsWith("image/")) throw new Error("That isn't an image.");
      if (file.size > 8 * 1024 * 1024) throw new Error("That image is too large — 8MB maximum.");

      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${boardId}/${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from("vision")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("vision").getPublicUrl(path);

      await addItem.mutateAsync({ boardId, kind: "image", imageUrl: publicUrl });
      trail("vision", "image-uploaded");
      return publicUrl;
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't upload that image."),
  });
}
