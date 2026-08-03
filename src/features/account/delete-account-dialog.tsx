import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useDeleteAccount } from "./use-delete-account";

/**
 * Deliberately requires typing DELETE rather than a single tap.
 *
 * This is genuinely irreversible, and Apple requires the destination be
 * account deletion rather than a "contact us" dead end — so the friction
 * should be honest friction, not a hidden path.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const deleteAccount = useDeleteAccount();

  const canDelete = confirmation.trim().toUpperCase() === "DELETE";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setConfirmation("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <DialogTitle className="font-display text-2xl">Delete your account</DialogTitle>
          <DialogDescription className="leading-relaxed">
            This permanently removes your desires, stories, affirmations, journal entries, habits,
            saved audio and your profile. It cannot be undone, and nothing is kept in a backup you
            could ask us to restore.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <label htmlFor="confirm-delete" className="eyebrow text-muted-foreground">
            Type DELETE to confirm
          </label>
          <Input
            id="confirm-delete"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="mt-2"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={deleteAccount.isPending}
          >
            Keep my account
          </Button>
          <Button
            variant="destructive"
            className="flex-1 rounded-full"
            disabled={!canDelete || deleteAccount.isPending}
            onClick={() => deleteAccount.mutate()}
          >
            {deleteAccount.isPending && <Loader2 className="animate-spin" />}
            Delete forever
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
