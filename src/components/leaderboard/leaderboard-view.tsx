"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Crown, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EncouragementComment, LeaderboardData, LeaderboardEntry, formatCompactDuration } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type LeaderboardViewProps = {
  initialData: LeaderboardData;
  providers: {
    google: boolean;
    github: boolean;
  };
  signedIn: boolean;
};

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

const ENCOURAGEMENT_PRESETS = ["Keep going", "Strong work", "Nice consistency", "You got this"];
const MAX_ENCOURAGEMENT_LENGTH = 180;

function EncouragementDialog({ entry }: { entry: LeaderboardEntry }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<EncouragementComment[]>([]);
  const [commentCount, setCommentCount] = useState(entry.encouragementCount);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const recipientName = entry.isCurrentUser ? "you" : entry.displayName ?? "this friend";
  const canSend = !entry.isCurrentUser;

  async function loadComments() {
    setLoading(true);

    try {
      const response = await fetch(`/api/encouragements?recipientId=${entry.userId}`);
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
          recipientId: entry.userId,
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

function renderRows(entries: LeaderboardEntry[], statLabel: string, showEncouragements: boolean) {
  if (!entries.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-14 text-center text-sm text-muted-foreground">
        No rankings yet for this view.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const visibleStage = entry.currentStage ?? entry.lastCompletedStage;
        const statusLabel = entry.currentStage ? "Live now" : entry.lastCompletedStage ? "Last fast" : "Not fasting now";
        const supportingStat = entry.lastCompletedStage
          ? `${entry.supportingStat} • last ${formatCompactDuration(entry.lastCompletedStage.elapsedMinutes)} ${formatDistanceToNow(new Date(entry.lastCompletedStage.endedAt), { addSuffix: true })}`
          : entry.supportingStat;

        return (
          <div
            key={entry.userId}
            className={cn(
              "glass-soft flex flex-col gap-4 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
              entry.isCurrentUser
                ? "border-primary/40 bg-primary/10 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]"
                : ""
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-sm font-semibold text-foreground">
                {entry.rank <= 3 ? <Crown className="size-4 text-gold" /> : `#${entry.rank}`}
              </div>
              <Avatar size="sm">
                <AvatarImage src={entry.avatarUrl ?? undefined} alt={entry.displayName ?? "User"} />
                <AvatarFallback>{getInitials(entry.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{entry.displayName ?? "FastTrack user"}</p>
                <p className="text-xs text-muted-foreground">
                  Level {entry.level} • {supportingStat}
                </p>
                <div
                  className={cn(
                    "mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]",
                    visibleStage ? "bg-white/[0.04]" : "border-border/60 bg-background/40 text-muted-foreground"
                  )}
                  style={
                    visibleStage
                      ? {
                          borderColor: `${visibleStage.color}55`,
                          color: visibleStage.color,
                        }
                      : undefined
                  }
                >
                  {visibleStage ? `${statusLabel}: ${visibleStage.label}` : statusLabel}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] pt-3 sm:border-t-0 sm:pt-0">
              {showEncouragements ? <EncouragementDialog entry={entry} /> : null}
              <div className="text-right">
                <p className="font-[family:var(--font-heading)] text-3xl font-bold text-foreground">{entry.stat}</p>
                <p className="text-xs text-muted-foreground">{statLabel}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LeaderboardView({ initialData, providers, signedIn }: LeaderboardViewProps) {
  return (
    <div className="grid gap-6">
      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>
                Rankings are based on consistency, completed windows, and steady habits rather than extreme fasting.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Friends first
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!signedIn ? (
            <EmptyState
              eyebrow="Signed out"
              title="Compare consistency with your circle."
              description="FastTrack uses friend-focused rankings that reward completed windows and steady habits instead of extreme fasting."
              actions={
                <>
                  <SignInDialog
                    buttonClassName="w-full sm:w-auto"
                    buttonLabel="Sign in to save your progress"
                    providers={providers}
                    size="lg"
                  />
                  <Link href="/friends" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                    Build your circle
                  </Link>
                </>
              }
              preview={
                <div className="space-y-3">
                  {[
                    "Weekly: completed planned windows.",
                    "Monthly: completed planned windows.",
                    "All time: steady consistency over time.",
                  ].map((item) => (
                    <div key={item} className="glass-soft rounded-[1.4rem] px-4 py-4 text-sm text-muted-foreground">
                      Preview: {item}
                    </div>
                  ))}
                </div>
              }
            />
          ) : (
            <Tabs defaultValue="weekly" className="gap-5">
              <TabsList>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="all-time">All Time</TabsTrigger>
              </TabsList>
              <TabsContent value="weekly">
                {renderRows(initialData.weekly, "planned windows", initialData.encouragementsEnabled)}
              </TabsContent>
              <TabsContent value="monthly">
                {renderRows(initialData.monthly, "planned windows", initialData.encouragementsEnabled)}
              </TabsContent>
              <TabsContent value="all-time">
                {renderRows(initialData.allTime, "steady sessions", initialData.encouragementsEnabled)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
