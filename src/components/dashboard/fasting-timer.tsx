"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Flag,
  Flame,
  PauseCircle,
  Share2,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { TimerRing } from "@/components/dashboard/timer-ring";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BadgeDefinition,
  DashboardData,
  EMPTY_DASHBOARD_DATA,
  FASTING_PRESETS,
  FASTING_STAGES,
  FastCompletionGamification,
  FastingStage,
  buildFeedEventCopy,
  calculateStats,
  formatCompactDuration,
  formatDuration,
  formatStageHour,
  getElapsedMinutes,
  getProgressPercent,
  getStageForMinutes,
  getStageIndexForMinutes,
} from "@/lib/fasting";
import { getCurrentStage } from "@/lib/fasting-stages";
import { cn } from "@/lib/utils";

type FastingTimerProps = {
  initialData: DashboardData;
  userId?: string | null;
};

type PendingAction = "complete" | "cancel" | null;

type CompletionSummary = {
  durationMinutes: number;
  stage: FastingStage;
  currentStreak: number;
  totalFasts: number;
  xpGained: number;
  badges: BadgeDefinition[];
};

type LevelUpSummary = {
  previousLevel: number;
  newLevel: number;
};

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };

    return payload.message || "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

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

function getStageCardState(index: number, currentIndex: number, active: boolean) {
  if (!active) {
    return "future";
  }

  if (index === currentIndex) {
    return "current";
  }

  if (index < currentIndex) {
    return "completed";
  }

  return "future";
}

export function FastingTimer({ initialData, userId }: FastingTimerProps) {
  const [dashboardData, setDashboardData] = useState(initialData);
  const [selectedPreset, setSelectedPreset] = useState<(typeof FASTING_PRESETS)[number]["label"]>("16:8");
  const [customHours, setCustomHours] = useState("14");
  const [now, setNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [levelUpSummary, setLevelUpSummary] = useState<LevelUpSummary | null>(null);
  const [isMutatingFast, setIsMutatingFast] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const milestoneInFlightRef = useRef(false);

  useEffect(() => {
    setDashboardData(initialData ?? EMPTY_DASHBOARD_DATA);
  }, [initialData]);

  useEffect(() => {
    if (!dashboardData.activeSession) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [dashboardData.activeSession]);

  const plannedMinutes =
    selectedPreset === "Custom"
      ? Math.max(12, Number(customHours || "14")) * 60
      : FASTING_PRESETS.find((preset) => preset.label === selectedPreset)?.minutes ?? 16 * 60;
  const activeSession = dashboardData.activeSession;
  const elapsedMinutes = getElapsedMinutes(activeSession, now);
  const elapsedHours = elapsedMinutes / 60;
  const progress = getProgressPercent(activeSession, now);
  const currentStageIndex = getStageIndexForMinutes(elapsedMinutes);
  const currentStage = getCurrentStage(elapsedHours);
  const stats = calculateStats(dashboardData.sessions, dashboardData.profile);
  const completedCount = dashboardData.sessions.filter((session) => session.status === "completed").length;

  const refreshDashboard = useCallback(async (silent = false) => {
    if (!userId) {
      return undefined;
    }

    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch("/api/dashboard", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const nextDashboard = (await response.json()) as DashboardData;
      setDashboardData(nextDashboard);
      return nextDashboard;
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Dashboard refresh failed.");
      }
    } finally {
      if (!silent) {
        setIsRefreshing(false);
      }
    }

    return undefined;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const poller = window.setInterval(() => {
      void refreshDashboard(true);
    }, 60000);

    return () => window.clearInterval(poller);
  }, [refreshDashboard, userId]);

  useEffect(() => {
    if (!activeSession || currentStageIndex === 0) {
      return;
    }

    if (currentStageIndex <= dashboardData.milestoneStageReached || milestoneInFlightRef.current) {
      return;
    }

    milestoneInFlightRef.current = true;

    void (async () => {
      try {
        const response = await fetch(`/api/fasts/${activeSession.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "milestone",
            stageIndex: currentStageIndex,
          }),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        setDashboardData((current) => ({
          ...current,
          milestoneStageReached: currentStageIndex,
          activeSession: current.activeSession
            ? {
                ...current.activeSession,
                stageReached: currentStageIndex,
              }
            : null,
        }));
        setActiveMilestoneIndex(currentStageIndex);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Milestone sync failed.");
      } finally {
        milestoneInFlightRef.current = false;
      }
    })();
  }, [activeSession, currentStageIndex, dashboardData.milestoneStageReached]);

  async function startFast() {
    if (!userId) {
      toast.error("Sign in to sync a fast across devices.");
      return;
    }

    if (activeSession) {
      toast.error("Finish the current fast before starting another.");
      return;
    }

    setIsMutatingFast(true);

    try {
      const response = await fetch("/api/fasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plannedMinutes,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as { session: DashboardData["activeSession"] };
      setSessionNotes("");
      setNow(Date.now());
      setDashboardData((current) => ({
        ...current,
        activeSession: payload.session,
        milestoneStageReached: 0,
      }));
      await refreshDashboard(true);
      toast.success("Fast started. Supabase is tracking it live.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start fast.");
    } finally {
      setIsMutatingFast(false);
    }
  }

  async function resolveSession(action: Exclude<PendingAction, null>) {
    if (!activeSession) {
      return;
    }

    setIsMutatingFast(true);

    try {
      const response = await fetch(`/api/fasts/${activeSession.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          notes: sessionNotes,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as {
        session: DashboardData["sessions"][number];
        gamification?: FastCompletionGamification;
      };
      const finishedSession = payload.session;

      setPendingAction(null);
      setSessionNotes("");
      setActiveMilestoneIndex(null);

      const nextDashboard = await refreshDashboard();

      if (action === "complete" && finishedSession) {
        const stage = getStageForMinutes((finishedSession.durationMinutes ?? 0) * 1);
        setCompletionSummary({
          durationMinutes: finishedSession.durationMinutes ?? 0,
          stage,
          currentStreak: nextDashboard?.profile?.currentStreak ?? stats.currentStreak,
          totalFasts: nextDashboard?.profile?.totalFasts ?? stats.totalFasts + 1,
          xpGained: payload.gamification?.xpGained ?? 0,
          badges: payload.gamification?.newlyEarnedBadges ?? [],
        });

        if (payload.gamification?.leveledUp) {
          setLevelUpSummary({
            previousLevel: payload.gamification.previousLevel,
            newLevel: payload.gamification.newLevel,
          });
        }
        toast.success("Fast completed and synced.");
      } else {
        toast.success("Fast cancelled.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update this fast.");
    } finally {
      setIsMutatingFast(false);
    }
  }

  async function sendFriendRequest() {
    if (!inviteEmail.trim()) {
      toast.error("Enter an email to invite a friend.");
      return;
    }

    setIsInviting(true);

    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setInviteEmail("");
      await refreshDashboard();
      toast.success("Friend request sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send friend request.");
    } finally {
      setIsInviting(false);
    }
  }

  async function respondToRequest(friendshipId: string, action: "accepted" | "rejected") {
    setFriendActionId(friendshipId);

    try {
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await refreshDashboard();
      toast.success(action === "accepted" ? "Friend request accepted." : "Friend request declined.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update friend request.");
    } finally {
      setFriendActionId(null);
    }
  }

  async function shareCompletion() {
    if (!completionSummary) {
      return;
    }

    const shareText = `🔥 I just completed ${formatCompactDuration(completionSummary.durationMinutes)} on FastTrack! Reached: ${completionSummary.stage.label} ${completionSummary.stage.emoji} fasttrack-alpha.vercel.app`;

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Result copied to clipboard.");
    } catch {
      toast.error("Clipboard share is unavailable on this device.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
      <Card className="overflow-hidden border border-border/80 bg-card/90 shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="mb-3 bg-primary/15 text-primary hover:bg-primary/20">Live Timer</Badge>
              <CardTitle className="font-[family:var(--font-heading)] text-2xl">Stay inside the window</CardTitle>
              <CardDescription>
                Start a fast, track each stage, and log the result when you finish.
              </CardDescription>
            </div>
            <div className="rounded-full border border-border/80 bg-background/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Synced • Supabase-backed
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-center justify-center gap-6">
            <TimerRing
              label={activeSession ? currentStage.label : "Ready"}
              plannedMinutes={activeSession?.plannedMinutes ?? plannedMinutes}
              progress={activeSession ? progress : 0}
            />
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Elapsed</p>
              <p className="mt-3 font-[family:var(--font-mono)] text-4xl font-semibold sm:text-5xl">
                {formatDuration(elapsedMinutes)}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {activeSession
                  ? `${currentStage.emoji} ${currentStage.label} at ${elapsedHours.toFixed(1)}h`
                  : "Choose a plan and start when you are ready."}
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <label className="text-sm font-medium text-foreground">Planned duration</label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Select value={selectedPreset} onValueChange={(value) => setSelectedPreset(value as typeof selectedPreset)}>
                  <SelectTrigger className="h-11 w-full rounded-2xl border-border/80 bg-card">
                    <SelectValue placeholder="Select a fasting window" />
                  </SelectTrigger>
                  <SelectContent>
                    {FASTING_PRESETS.map((preset) => (
                      <SelectItem key={preset.label} value={preset.label}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  className={cn(
                    "h-11 rounded-2xl border border-border/80 bg-card px-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30",
                    selectedPreset !== "Custom" && "opacity-50"
                  )}
                  disabled={selectedPreset !== "Custom"}
                  inputMode="numeric"
                  max={48}
                  min={12}
                  onChange={(event) => setCustomHours(event.target.value)}
                  value={customHours}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Goal: <span className="text-foreground">{formatCompactDuration(plannedMinutes)}</span>
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-foreground">Session note</label>
                <span className="text-xs text-muted-foreground">Saved at finish</span>
              </div>
              <Textarea
                className="min-h-24 rounded-2xl border-border/80 bg-card"
                onChange={(event) => setSessionNotes(event.target.value)}
                placeholder="Energy, cravings, or what helped today..."
                value={sessionNotes}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Button className="h-11 rounded-2xl" disabled={isMutatingFast} onClick={startFast}>
                Start
              </Button>
              <Button
                className="h-11 rounded-2xl"
                disabled={!activeSession || isMutatingFast}
                onClick={() => setPendingAction("complete")}
                variant="secondary"
              >
                End
              </Button>
              <Button
                className="h-11 rounded-2xl"
                disabled={!activeSession || isMutatingFast}
                onClick={() => setPendingAction("cancel")}
                variant="destructive"
              >
                Cancel
              </Button>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Fasting stages</p>
                  <p className="text-sm text-muted-foreground">Real milestone science mapped across the clock.</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-accent"
                  style={{ borderColor: currentStage.color, color: currentStage.color }}
                >
                  {currentStage.emoji} {currentStage.label}
                </Badge>
              </div>
              <Progress value={activeSession ? progress : 0}>
                <ProgressLabel>Goal progress</ProgressLabel>
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                  {activeSession ? `${progress}%` : "0%"}
                </span>
              </Progress>
              <div className="mt-4 grid gap-3">
                {FASTING_STAGES.map((stage, index) => {
                  const state = getStageCardState(index, currentStageIndex, Boolean(activeSession));
                  const isCurrent = state === "current";
                  const isCompleted = state === "completed";

                  return (
                    <div
                      key={stage.hour}
                      className={cn(
                        "rounded-2xl border px-4 py-3 transition-all",
                        state === "future" && "border-border/60 bg-card/60 text-muted-foreground opacity-45",
                        isCompleted && "border-border/70 bg-background/55 text-muted-foreground opacity-70",
                        isCurrent && "text-foreground"
                      )}
                      style={
                        isCurrent
                          ? {
                              borderColor: stage.color,
                              backgroundColor: `${stage.color}18`,
                              boxShadow: `0 0 0 1px ${stage.color}40, 0 0 24px ${stage.color}25`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-[family:var(--font-heading)] text-sm font-medium">
                          {formatStageHour(stage.hour)}
                        </span>
                        <span className="text-sm">
                          {stage.emoji} {stage.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                className="mt-4 rounded-[1.25rem] border px-4 py-4 text-sm"
                style={{
                  borderColor: `${currentStage.color}55`,
                  backgroundColor: `${currentStage.color}12`,
                }}
              >
                <p className="font-medium text-foreground">
                  {currentStage.emoji} {currentStage.label}
                </p>
                <p className="mt-2 text-muted-foreground">{currentStage.description}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 border-t border-border/70 bg-background/50 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{activeSession ? "Current fast is synced to Supabase." : "No active fast right now."}</span>
          <span>
            {completedCount
              ? `${completedCount} recent completed sessions loaded.`
              : "History starts after your first completed fast."}
          </span>
        </CardFooter>
      </Card>

      <div className="grid gap-6">
        <Card className="border border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-[family:var(--font-heading)]">Quick stats</CardTitle>
            <CardDescription>Your synced FastTrack snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { label: "Total fasts", value: stats.totalFasts.toString(), icon: Flag },
              { label: "Total hours", value: stats.totalHours.toString(), icon: Flame },
              { label: "Average", value: formatCompactDuration(stats.averageMinutes), icon: PauseCircle },
              { label: "Current streak", value: `${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}`, icon: Trophy },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <item.icon className="size-4" />
                  </div>
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-[family:var(--font-heading)] text-lg font-semibold">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/90">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-[family:var(--font-heading)]">Friend feed</CardTitle>
                <CardDescription>Invite friends, accept requests, and see shared momentum.</CardDescription>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">
                <Users className="mr-2 size-3.5" />
                {dashboardData.acceptedFriendsCount} connected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <label className="text-sm font-medium text-foreground">Invite by email</label>
              <div className="flex gap-2">
                <Input
                  className="h-11 rounded-2xl border-border/80 bg-card"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="friend@example.com"
                  value={inviteEmail}
                />
                <Button className="h-11 rounded-2xl px-4" disabled={isInviting} onClick={sendFriendRequest}>
                  <UserPlus className="size-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Link href="/feed" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-xl")}>
                  Open Feed
                </Link>
                <Link href="/friends" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}>
                  Open Friends
                </Link>
              </div>
            </div>

            {dashboardData.pendingRequests.length ? (
              <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Pending requests</p>
                {dashboardData.pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarImage src={request.sender.avatarUrl ?? undefined} alt={request.sender.displayName ?? "Friend"} />
                        <AvatarFallback>{getInitials(request.sender.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.sender.displayName ?? request.sender.email}</p>
                        <p className="text-xs text-muted-foreground">{request.sender.email ?? "FastTrack member"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        className="h-9 rounded-xl px-3"
                        disabled={friendActionId === request.id}
                        onClick={() => respondToRequest(request.id, "accepted")}
                        size="sm"
                        variant="secondary"
                      >
                        <Check className="mr-1 size-4" />
                        Accept
                      </Button>
                      <Button
                        className="h-9 rounded-xl px-3"
                        disabled={friendActionId === request.id}
                        onClick={() => respondToRequest(request.id, "rejected")}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="mr-1 size-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              {dashboardData.feed.length ? (
                dashboardData.feed.slice(0, 4).map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={event.actor?.avatarUrl ?? undefined} alt={event.actor?.displayName ?? "Friend"} />
                      <AvatarFallback>{getInitials(event.actor?.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm leading-6 text-foreground">{buildFeedEventCopy(event)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center text-sm text-muted-foreground">
                  Accepted friends will appear here when they start, finish, or hit milestones in their fasts.
                </div>
              )}
            </div>

            <Button className="w-full rounded-2xl" disabled={isRefreshing} onClick={() => void refreshDashboard()}>
              {isRefreshing ? "Refreshing..." : "Refresh feed"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => setPendingAction(open ? pendingAction : null)}>
        <DialogContent className="border border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>{pendingAction === "complete" ? "Finish this fast?" : "Cancel this fast?"}</DialogTitle>
            <DialogDescription>
              {pendingAction === "complete"
                ? "This will save the finished session, refresh your streak, and publish the result to your feed."
                : "This will stop the active timer and log it as cancelled."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-border/70 bg-muted/30">
            <Button onClick={() => setPendingAction(null)} variant="outline">
              Keep going
            </Button>
            <Button
              onClick={() => pendingAction && resolveSession(pendingAction)}
              variant={pendingAction === "complete" ? "default" : "destructive"}
            >
              {pendingAction === "complete" ? "Save complete" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeMilestoneIndex !== null}
        onOpenChange={(open) => setActiveMilestoneIndex(open ? activeMilestoneIndex : null)}
      >
        <DialogContent className="border border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>
              {activeMilestoneIndex !== null
                ? `${FASTING_STAGES[activeMilestoneIndex].emoji} ${FASTING_STAGES[activeMilestoneIndex].label}`
                : "Milestone"}
            </DialogTitle>
            <DialogDescription>
              {activeMilestoneIndex !== null
                ? `${formatStageHour(FASTING_STAGES[activeMilestoneIndex].hour)} milestone crossed.`
                : "You just crossed a fasting milestone."}
            </DialogDescription>
          </DialogHeader>
          {activeMilestoneIndex !== null ? (
            <div
              className="rounded-[1.5rem] border px-4 py-4 text-sm text-muted-foreground"
              style={{
                borderColor: FASTING_STAGES[activeMilestoneIndex].color,
                backgroundColor: `${FASTING_STAGES[activeMilestoneIndex].color}12`,
              }}
            >
              {FASTING_STAGES[activeMilestoneIndex].description}
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/70 bg-muted/30">
            <Button onClick={() => setActiveMilestoneIndex(null)}>Keep Going 🔥</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completionSummary !== null} onOpenChange={(open) => setCompletionSummary(open ? completionSummary : null)}>
        <DialogContent className="border border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>FAST COMPLETE</DialogTitle>
            <DialogDescription>Your latest result is saved and ready to share.</DialogDescription>
          </DialogHeader>
          {completionSummary ? (
            <div className="space-y-4">
              <div className="rounded-[1.5rem] border border-primary/30 bg-primary/10 px-4 py-5">
                <p className="font-[family:var(--font-heading)] text-3xl font-semibold text-foreground">
                  {formatDuration(completionSummary.durationMinutes)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Reached {completionSummary.stage.emoji} {completionSummary.stage.label}
                </p>
                <p className="mt-2 text-sm font-medium text-primary">+{completionSummary.xpGained} XP</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current streak</p>
                  <p className="mt-2 font-[family:var(--font-heading)] text-2xl font-semibold text-foreground">
                    {completionSummary.currentStreak}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total fasts</p>
                  <p className="mt-2 font-[family:var(--font-heading)] text-2xl font-semibold text-foreground">
                    {completionSummary.totalFasts}
                  </p>
                </div>
              </div>
              {completionSummary.badges.length ? (
                <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Badges earned</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {completionSummary.badges.map((badge) => (
                      <Badge key={badge.id} className="bg-primary/15 text-primary hover:bg-primary/20">
                        {badge.icon} {badge.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/70 bg-muted/30">
            <Button onClick={() => void shareCompletion()} variant="secondary">
              <Share2 className="mr-2 size-4" />
              Share Result
            </Button>
            <Button onClick={() => setCompletionSummary(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={levelUpSummary !== null} onOpenChange={(open) => setLevelUpSummary(open ? levelUpSummary : null)}>
        <DialogContent className="border border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>LEVEL UP</DialogTitle>
            <DialogDescription>Your discipline just pushed you into a new tier.</DialogDescription>
          </DialogHeader>
          {levelUpSummary ? (
            <div className="rounded-[1.5rem] border border-primary/30 bg-primary/10 px-4 py-5">
              <p className="font-[family:var(--font-heading)] text-3xl font-semibold text-foreground">
                Level {levelUpSummary.previousLevel} → Level {levelUpSummary.newLevel}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep stacking fasts, XP, and milestones. Your profile and leaderboard rank just moved.
              </p>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/70 bg-muted/30">
            <Button onClick={() => setLevelUpSummary(null)}>Keep Climbing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
