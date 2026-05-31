"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Crown, Share2, Target, Trophy, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChallengeDetail, CHALLENGE_TYPE_LABELS, CHALLENGE_TYPE_ICONS } from "@/lib/fasting";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ChallengeDetailViewProps = {
  challenge: ChallengeDetail;
  signedIn: boolean;
};

function getInitials(value?: string | null) {
  if (!value) return "?";
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDaysRemaining(endsAt: string) {
  const now = Date.now();
  const end = Date.parse(endsAt);
  const diff = Math.ceil((end - now) / 86400000);
  if (diff <= 0) return "Ended";
  if (diff === 1) return "1 day left";
  return `${diff} days left`;
}

function getUnit(challengeType: ChallengeDetail["challengeType"]) {
  if (challengeType === "total_hours") return "hours";
  if (challengeType === "daily_fast") return "fasts";
  if (challengeType === "streak_days") return "days";
  return "milestones";
}

export function ChallengeDetailView({ challenge, signedIn }: ChallengeDetailViewProps) {
  const router = useRouter();
  const hasEnded = challenge.endsAt <= new Date().toISOString();
  const leader = challenge.participants[0] ?? null;

  async function handleJoin() {
    try {
      const response = await fetch(`/api/challenges/${challenge.id}/join`, { method: "POST" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Unable to join.");
      }
      toast.success("Joined challenge!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  async function handleLeave() {
    try {
      const response = await fetch(`/api/challenges/${challenge.id}/join`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Unable to leave.");
      }
      toast.success("Left challenge.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Challenge link copied.");
    } catch {
      toast.error("Unable to copy link.");
    }
  }

  return (
    <div className="grid gap-6">
      <Link
        href="/challenges"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit gap-2 text-muted-foreground")}
      >
        <ArrowLeft className="size-4" />
        Back to challenges
      </Link>

      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-xl shadow-[0_10px_26px_rgba(139,92,246,0.16)]">
                  {CHALLENGE_TYPE_ICONS[challenge.challengeType]}
                </span>
                <div>
                  <CardTitle>{challenge.title}</CardTitle>
                  <CardDescription>
                    {CHALLENGE_TYPE_LABELS[challenge.challengeType]} challenge
                    {challenge.creator.displayName && ` · Created by ${challenge.creator.displayName}`}
                  </CardDescription>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn(
              challenge.endsAt > new Date().toISOString()
                ? "border-green-500/30 text-green-400"
                : "border-muted-foreground/30 text-muted-foreground"
            )}>
              {getDaysRemaining(challenge.endsAt)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {challenge.description && (
            <p className="mb-4 text-sm text-muted-foreground">{challenge.description}</p>
          )}

          {leader && (
            <div className="mb-4 rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
              <span className="font-semibold">{leader.displayName ?? "FastTrack user"}</span> is leading at{" "}
              <span className="font-semibold">{leader.progress} / {challenge.targetValue}</span> {getUnit(challenge.challengeType)}.
            </div>
          )}

          <div className="glass-soft mb-4 grid grid-cols-3 gap-3 rounded-[1.5rem] p-4">
            <div className="text-center">
              <Target className="mx-auto mb-1 size-4 text-primary" />
              <p className="text-lg font-bold text-foreground">{challenge.targetValue}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
            </div>
            <div className="text-center">
              <Users className="mx-auto mb-1 size-4 text-primary" />
              <p className="text-lg font-bold text-foreground">{challenge.participantCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Joined</p>
            </div>
            <div className="text-center">
              <Clock className="mx-auto mb-1 size-4 text-primary" />
              <p className="text-lg font-bold text-foreground">{challenge.durationDays}d</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</p>
            </div>
          </div>

          {signedIn ? (
            <div className="flex flex-wrap gap-2">
              {challenge.isParticipant ? (
                <Button variant="secondary" onClick={handleLeave} className="gap-2">
                  <UserMinus className="size-4" />
                  Leave Challenge
                </Button>
              ) : (
                <Button onClick={handleJoin} disabled={hasEnded} className="gap-2">
                  <UserPlus className="size-4" />
                  {hasEnded ? "Challenge Ended" : "Join Challenge"}
                </Button>
              )}
              <Button variant="outline" onClick={handleCopyLink} className="gap-2">
                <Share2 className="size-4" />
                Copy Link
              </Button>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
              Sign in to join this challenge and appear on the leaderboard.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "50ms" }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary shadow-[0_8px_20px_rgba(139,92,246,0.16)]">
              <Trophy className="size-4" />
            </div>
            <div>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>
                Ranked by progress toward the {challenge.targetValue} {getUnit(challenge.challengeType)} target.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {challenge.participants.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-14 text-center text-sm text-muted-foreground">
              No one has joined this challenge yet.
            </div>
          ) : (
            <div className="space-y-3">
              {challenge.participants.map((participant, index) => {
                const pct = challenge.targetValue > 0
                  ? Math.min(100, Math.round((participant.progress / challenge.targetValue) * 100))
                  : 0;

                return (
                  <div
                    key={participant.userId}
                    className="glass-soft flex flex-col gap-3 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-sm font-semibold text-foreground",
                        index === 0 && "bg-amber-300/10 text-amber-300"
                      )}>
                        {index === 0 ? (
                          <Crown className="size-4" />
                        ) : index === 1 ? (
                          <span className="text-muted-foreground">#2</span>
                        ) : index === 2 ? (
                          <span className="text-amber-700">#3</span>
                        ) : (
                          <span className="text-muted-foreground">#{index + 1}</span>
                        )}
                      </div>
                      <Avatar size="sm">
                        <AvatarImage src={participant.avatarUrl ?? undefined} alt={participant.displayName ?? "User"} />
                        <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{participant.displayName ?? "FastTrack user"}</p>
                          {participant.completed && (
                            <Badge variant="outline" className="border-green-500/30 text-green-400">
                              <CheckCircle2 className="size-3" />
                              Complete
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {participant.progress} / {challenge.targetValue} {getUnit(challenge.challengeType)}
                        </p>
                      </div>
                    </div>
                    <div className="w-full text-left sm:w-auto sm:text-right">
                      <p className="font-[family:var(--font-heading)] text-2xl font-bold text-foreground">
                        {pct}%
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08] sm:w-20">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            participant.completed
                              ? "bg-green-500"
                              : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
