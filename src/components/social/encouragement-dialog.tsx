"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EncouragementComment } from "@/lib/fasting";

type EncouragementDialogProps = {
  target: {
    userId: string;
    displayName: string | null;
    avatarUrl?: string | null;
    isCurrentUser: boolean;
    encouragementCount: number;
  };
};

const ENCOURAGEMENT_PRESETS = ["Keep going", "Strong work", "Nice consistency", "You got this"];
const MAX_ENCOURAGEMENT_LENGTH = 180;

function getInitials(value?: string | null) {
  if (!value) {
    return "FT";
  }

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function EncouragementDialog({ target }: EncouragementDialogProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<EncouragementComment[]>([]);
  const [commentCount, setCommentCount] = useState(target.encouragementCount);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const recipientName = target.isCurrentUser ? "you" : target.displayName ?? "this friend";
  const canSend = !target.isCurrentUser;

  async function loadComments() {
    setLoading(true);

    try {
      const response = await fetch(`/api/encouragements?recipientId=${target.userId}`);
      const payload = (await response.json()) as { comments?: EncouragementComment[]; message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Unable to load encouragements.");
      }

      setComments(payload.comments ?? []);
      setCommentCount(Math.max(commentCount, payload.comments?.length ?? 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load encouragements.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      await loadComments();
    }
  }

  async function handleSubmit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error("Write a short encouragement first.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/encouragements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: target.userId,
          body: trimmedMessage,
        }),
      });
      const payload = (await response.json()) as { comment?: EncouragementComment; message?: string };

      if (!response.ok || !payload.comment) {
        throw new Error(payload.message || "Unable to send encouragement.");
      }

      setComments((currentComments) => [payload.comment!, ...currentComments]);
      setCommentCount((currentCount) => currentCount + 1);
      setMessage("");
      toast.success("Encouragement sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send encouragement.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 px-3"
        onClick={() => void handleOpenChange(true)}
      >
        <MessageCircle className="size-3.5" />
        {commentCount > 0 ? `${commentCount} note${commentCount === 1 ? "" : "s"}` : "Encourage"}
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => void handleOpenChange(nextOpen)}>
        <DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Encourage {recipientName}</DialogTitle>
            <DialogDescription>
              Short notes from accepted friends stay attached to this leaderboard profile.
            </DialogDescription>
          </DialogHeader>

          {canSend ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {ENCOURAGEMENT_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => setMessage(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <Textarea
                value={message}
                maxLength={MAX_ENCOURAGEMENT_LENGTH}
                placeholder="Write something encouraging..."
                onChange={(event) => setMessage(event.target.value)}
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{message.length}/{MAX_ENCOURAGEMENT_LENGTH}</span>
                <Button onClick={handleSubmit} disabled={sending} size="sm" className="gap-2">
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
              Friends can leave encouragement on your row. You can read it here when it arrives.
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent notes</p>
            {loading ? (
              <div className="flex items-center gap-2 rounded-[1.25rem] border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading notes
              </div>
            ) : comments.length ? (
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {comments.map((comment) => (
                  <div key={comment.id} className="glass-soft flex gap-3 rounded-[1.25rem] px-3 py-3">
                    <Avatar size="sm">
                      <AvatarImage src={comment.author?.avatarUrl ?? undefined} alt={comment.author?.displayName ?? "Friend"} />
                      <AvatarFallback>{getInitials(comment.author?.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {comment.author?.displayName ?? "A friend"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
                No encouragement yet.
              </div>
            )}
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
