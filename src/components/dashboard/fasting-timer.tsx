"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, Clock3, Flag, PencilLine, Share2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { FastingMilestoneBar } from "@/components/dashboard/fasting-milestone-bar";
import { TimerRing } from "@/components/dashboard/timer-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BadgeDefinition,
  DashboardData,
  EMPTY_DASHBOARD_DATA,
  FastCompletionGamification,
  formatCompactDuration,
  formatDuration,
  formatStageHour,
  getElapsedMinutes,
  getProgressPercent,
  getStageForMinutes,
  getStageIndexForMinutes,
  MANUAL_START_CONFIRM_MINUTES,
  MAX_MANUAL_START_BACKDATE_MINUTES,
  resolveManualStartTimeFromClock,
  validateManualStartTimestamp,
} from "@/lib/fasting";
import { FASTING_STAGES, type FastingStage } from "@/lib/fasting-stages";
import { cn } from "@/lib/utils";

type FastingTimerProps = {
  initialData: DashboardData;
  signedIn: boolean;
  userId?: string | null;
};

type PendingAction = "complete" | "cancel" | null;
type StartTimeMode = "now" | "earlier";
type StartDialogMode = "start" | "edit" | null;

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

type PendingStartAdjustment = {
  mode: Exclude<StartDialogMode, null>;
  startedAt: string;
  backdatedMinutes: number;
};

const WINDOW_OPTIONS = [
  { label: "12h", minutes: 12 * 60 },
  { label: "14h", minutes: 14 * 60 },
  { label: "16h", minutes: 16 * 60 },
  { label: "Custom", minutes: 14 * 60 },
] as const;

const HOURLY_CHECK_INS = [
  "Choose a window that fits your day and begin when ready.",
  "Use the first hour to settle in. A calm start makes the routine easier to repeat.",
  "Keep the pace gentle. Progress comes from consistency, not urgency.",
  "Notice how you feel and stay practical with the rest of your day.",
  "Small check-ins help. Water, routine, and steady pacing usually go further than pressure.",
  "If your energy feels steady, keep following the window you planned.",
  "Stay flexible with your schedule. The goal is a repeatable habit, not a perfect streak.",
  "A short reset can help. Step away, breathe, and let the clock do its work.",
  "This can be a common window for many routines. Let your plan guide the session.",
  "Keep the session measured and calm. You do not need to chase extra hours.",
  "If you are still feeling well, stay aligned with the window you chose.",
  "Check in with comfort, focus, and schedule before deciding what comes next.",
  "If this matches your plan, you are right where you need to be.",
  "Longer windows call for a little more care. Stay attentive to how you feel.",
  "A calm finish is usually better than pushing the clock for its own sake.",
  "If this is beyond your usual routine, consider ending at the planned time.",
  "Consistency matters more than stretching the session longer than intended.",
  "Use caution with longer windows and keep the plan realistic for your day.",
  "This is an extended window. Continue only if it still feels appropriate for you.",
  "A safe routine is the priority. Longer does not automatically mean better.",
  "If this is outside your normal range, ending here may be the wiser choice.",
  "Keep the focus on care, not pressure. The app is here to track, not to push.",
  "If you have questions about longer fasting, qualified guidance matters.",
  "The strongest routine is the one you can repeat safely and steadily.",
  "Advanced windows deserve extra caution. End when your plan or comfort says it is time.",
] as const;

const CONFETTI_COLORS = ["#8B5CF6", "#A855F7", "#F59E0B", "#22C55E", "#06B6D4", "#EF4444"];
const CONFETTI_PIECES = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  left: `${4 + (index % 13) * 7.2}%`,
  size: `${8 + (index % 4) * 2}px`,
  delay: `${(index % 8) * 0.06}s`,
  drift: `${(index % 2 === 0 ? 1 : -1) * (14 + (index % 5) * 7)}px`,
  rotate: `${(index * 21) % 180}deg`,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
}));

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };

    return payload.message || "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function getHourlyCheckIn(elapsedHours: number, active: boolean) {
  if (!active) {
    return HOURLY_CHECK_INS[0];
  }

  const hour = Math.max(0, Math.floor(elapsedHours));
  return HOURLY_CHECK_INS[Math.min(hour, HOURLY_CHECK_INS.length - 1)];
}

function getStatusLabel(active: boolean, currentStage: FastingStage, remainingMinutes: number) {
  if (!active) {
    return "Not started";
  }

  if (remainingMinutes <= 0) {
    return "Planned window complete";
  }

  return currentStage.label;
}

function formatTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return format(new Date(value), "p");
}

function clampCustomHours(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 14;
  }

  return Math.min(24, Math.max(12, parsed));
}

function getClockValue(value: string | null | undefined) {
  return format(new Date(value ?? Date.now()), "HH:mm");
}

export function FastingTimer({ initialData, signedIn, userId }: FastingTimerProps) {
  const [dashboardData, setDashboardData] = useState(initialData);
  const [selectedWindow, setSelectedWindow] = useState<(typeof WINDOW_OPTIONS)[number]["label"]>("16h");
  const [customHours, setCustomHours] = useState("14");
  const [now, setNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [levelUpSummary, setLevelUpSummary] = useState<LevelUpSummary | null>(null);
  const [isMutatingFast, setIsMutatingFast] = useState(false);
  const [startDialogMode, setStartDialogMode] = useState<StartDialogMode>(null);
  const [startTimeMode, setStartTimeMode] = useState<StartTimeMode>("now");
  const [startTimeValue, setStartTimeValue] = useState(() => getClockValue(new Date().toISOString()));
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [pendingStartAdjustment, setPendingStartAdjustment] = useState<PendingStartAdjustment | null>(null);
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
    selectedWindow === "Custom"
      ? clampCustomHours(customHours) * 60
      : WINDOW_OPTIONS.find((option) => option.label === selectedWindow)?.minutes ?? 16 * 60;
  const activeSession = dashboardData.activeSession;
  const elapsedMinutes = getElapsedMinutes(activeSession, now);
  const progress = getProgressPercent(activeSession, now);
  const currentStageIndex = getStageIndexForMinutes(elapsedMinutes);
  const currentStage = getStageForMinutes(elapsedMinutes);
  const remainingMinutes = activeSession ? Math.max(activeSession.plannedMinutes - elapsedMinutes, 0) : plannedMinutes;
  const statusLabel = getStatusLabel(Boolean(activeSession), currentStage, remainingMinutes);
  const hourlyCheckIn = getHourlyCheckIn(elapsedMinutes / 60, Boolean(activeSession));
  const selectedStartPreview = (() => {
    if (!startDialogMode) {
      return null;
    }

    if (startTimeMode === "now") {
      const startedAt = new Date().toISOString();

      return {
        startedAt,
        backdatedMinutes: 0,
        error: null,
      };
    }

    const startedAt = resolveManualStartTimeFromClock(startTimeValue, new Date());

    if (!startedAt) {
      return {
        startedAt: null,
        backdatedMinutes: 0,
        error: "Choose a valid start time.",
      };
    }

    const validation = validateManualStartTimestamp(startedAt, Date.now(), MAX_MANUAL_START_BACKDATE_MINUTES);

    return {
      startedAt: validation.valid ? startedAt : null,
      backdatedMinutes: validation.backdatedMinutes,
      error: validation.message,
    };
  })();
  const previewPlannedMinutes = activeSession?.plannedMinutes ?? plannedMinutes;
  const previewElapsedMinutes = selectedStartPreview?.backdatedMinutes ?? 0;
  const previewRemainingMinutes = Math.max(previewPlannedMinutes - previewElapsedMinutes, 0);
  const previewStage = getStageForMinutes(previewElapsedMinutes);
  const showExtendedWindowWarning = previewElapsedMinutes >= 18 * 60;

  const refreshDashboard = useCallback(async () => {
    if (!userId) {
      return undefined;
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
      toast.error(error instanceof Error ? error.message : "Dashboard refresh failed.");
      return undefined;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const poller = window.setInterval(() => {
      void refreshDashboard();
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

  function openStartTimeDialog(mode: Exclude<StartDialogMode, null>) {
    if (!userId) {
      toast.error("Sign in to save your progress.");
      return;
    }

    if (mode === "start" && activeSession) {
      toast.error("Finish the current fast before starting another.");
      return;
    }

    setStartDialogMode(mode);
    setStartTimeError(null);
    setStartTimeMode(mode === "edit" ? "earlier" : "now");
    setStartTimeValue(getClockValue(mode === "edit" ? activeSession?.startedAt : new Date().toISOString()));
  }

  function closeStartTimeDialog() {
    setStartDialogMode(null);
    setStartTimeError(null);
    setPendingStartAdjustment(null);
  }

  async function applyStartTimeChange(payload: PendingStartAdjustment) {
    if (!userId) {
      toast.error("Sign in to save your progress.");
      return;
    }

    if (payload.mode === "edit" && !activeSession) {
      toast.error("No active fast is available to adjust.");
      return;
    }

    setIsMutatingFast(true);

    try {
      const response = await fetch(payload.mode === "start" ? "/api/fasts" : `/api/fasts/${activeSession?.id}`, {
        method: payload.mode === "start" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(payload.mode === "start"
            ? {
                plannedMinutes,
                startedAt: payload.startedAt,
              }
            : {
                action: "edit_start",
                startedAt: payload.startedAt,
              }),
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const responsePayload = (await response.json()) as { session: DashboardData["activeSession"] };
      setNow(Date.now());
      setDashboardData((current) => ({
        ...current,
        activeSession: responsePayload.session,
        milestoneStageReached: responsePayload.session?.stageReached ?? 0,
      }));
      await refreshDashboard();
      closeStartTimeDialog();
      toast.success(payload.mode === "start" ? "Fast started. Progress saved." : "Start time updated. Progress recalculated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this start time.");
    } finally {
      setIsMutatingFast(false);
    }
  }

  async function submitStartTimeChange() {
    if (!startDialogMode || !selectedStartPreview) {
      return;
    }

    if (selectedStartPreview.error || !selectedStartPreview.startedAt) {
      setStartTimeError(selectedStartPreview.error ?? "Choose a valid start time.");
      return;
    }

    setStartTimeError(null);

    if (selectedStartPreview.backdatedMinutes > MANUAL_START_CONFIRM_MINUTES) {
      setPendingStartAdjustment({
        mode: startDialogMode,
        startedAt: selectedStartPreview.startedAt,
        backdatedMinutes: selectedStartPreview.backdatedMinutes,
      });
      return;
    }

    await applyStartTimeChange({
      mode: startDialogMode,
      startedAt: selectedStartPreview.startedAt,
      backdatedMinutes: selectedStartPreview.backdatedMinutes,
    });
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
          notes: "",
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
      setActiveMilestoneIndex(null);

      const nextDashboard = await refreshDashboard();

      if (action === "complete" && finishedSession) {
        const stage = getStageForMinutes(finishedSession.durationMinutes ?? 0);
        setCompletionSummary({
          durationMinutes: finishedSession.durationMinutes ?? 0,
          stage,
          currentStreak: nextDashboard?.profile?.currentStreak ?? dashboardData.profile?.currentStreak ?? 0,
          totalFasts: nextDashboard?.profile?.totalFasts ?? (dashboardData.profile?.totalFasts ?? 0) + 1,
          xpGained: payload.gamification?.xpGained ?? 0,
          badges: payload.gamification?.newlyEarnedBadges ?? [],
        });

        if (payload.gamification?.leveledUp) {
          setLevelUpSummary({
            previousLevel: payload.gamification.previousLevel,
            newLevel: payload.gamification.newLevel,
          });
        }
        toast.success("Fast complete. Progress saved.");
      } else {
        toast.success("Fast cancelled.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update this fast.");
    } finally {
      setIsMutatingFast(false);
    }
  }

  async function shareCompletion() {
    if (!completionSummary) {
      return;
    }

    const shareText = `I just completed ${formatCompactDuration(completionSummary.durationMinutes)} on FastTrack. Reached: ${completionSummary.stage.label} ${completionSummary.stage.emoji} fasttrack-alpha.vercel.app`;

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Result copied to clipboard.");
    } catch {
      toast.error("Clipboard share is unavailable on this device.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card className="section-enter overflow-hidden" style={{ animationDelay: "0ms" }}>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Badge className="w-fit">Today</Badge>
              <div>
                <h2 className="font-[family:var(--font-heading)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {activeSession ? "Current fast" : "Ready to start"}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {activeSession
                    ? "Track the window you planned, stay steady, and end the session when it matches your routine."
                  : "Choose your window and begin when ready."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:items-center">
            <div className="order-1">
              <TimerRing
                active={Boolean(activeSession)}
                elapsedMinutes={elapsedMinutes}
                plannedMinutes={activeSession?.plannedMinutes ?? plannedMinutes}
                progress={activeSession ? progress : 0}
                stage={currentStage}
              />
            </div>

            <div className="order-2 space-y-4">
              {!activeSession ? (
                <div className="glass-soft rounded-[1.7rem] p-4 sm:p-5">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Choose a window</p>
                    <div className="grid grid-cols-2 gap-2">
                      {WINDOW_OPTIONS.map((option) => {
                        const active = option.label === selectedWindow;

                        return (
                          <button
                            aria-pressed={active}
                            className={cn(
                              "min-h-[48px] rounded-2xl border px-3 py-3 text-sm font-medium transition-colors",
                              active
                                ? "border-primary bg-primary/15 text-primary shadow-[0_12px_26px_rgba(139,92,246,0.18)]"
                                : "border-white/[0.08] bg-white/[0.04] text-foreground hover:border-white/[0.14]"
                            )}
                            key={option.label}
                            onClick={() => setSelectedWindow(option.label)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {selectedWindow === "Custom" ? (
                      <div className="space-y-2">
                        <label
                          className="text-xs uppercase tracking-[0.24em] text-muted-foreground"
                          htmlFor="custom-hours"
                        >
                          Custom hours
                        </label>
                        <Input
                          id="custom-hours"
                          inputMode="numeric"
                          max={24}
                          min={12}
                          onChange={(event) => setCustomHours(event.target.value)}
                          value={customHours}
                        />
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      Planned window: <span className="font-medium text-foreground">{formatCompactDuration(plannedMinutes)}</span>
                    </p>
                    <div className="rounded-[1.3rem] border border-white/[0.08] bg-black/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current status</p>
                      <p className="mt-2 text-base font-medium text-foreground">{statusLabel}</p>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Choose <span className="font-medium text-foreground">Now</span> or set a recent start time if your
                      fasting window began before you opened FastTrack.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Started", value: formatTime(activeSession.startedAt) },
                    {
                      label: "Ends",
                      value: formatTime(
                        new Date(Date.parse(activeSession.startedAt) + activeSession.plannedMinutes * 60000).toISOString()
                      ),
                    },
                    { label: "Elapsed", value: formatDuration(elapsedMinutes) },
                    { label: "Remaining", value: formatDuration(remainingMinutes) },
                    { label: "Current status", value: statusLabel, fullWidth: true },
                  ].map((item) => (
                    <div
                      className={cn(
                        "glass-soft rounded-[1.4rem] px-4 py-4",
                        item.fullWidth ? "sm:col-span-2" : undefined
                      )}
                      key={item.label}
                    >
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                      <p className="mt-2 text-base font-medium text-foreground sm:text-lg">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="glass-soft rounded-[1.7rem] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Hourly check-in</p>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {activeSession ? `Hour ${Math.floor(elapsedMinutes / 60)}` : "Before you start"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{hourlyCheckIn}</p>
              </div>

              <div className="grid gap-3">
                {!activeSession ? (
                  <Button
                    className="h-12 w-full text-base font-semibold text-white"
                    disabled={isMutatingFast}
                    onClick={() => openStartTimeDialog("start")}
                    size="lg"
                  >
                    <Flag className="size-4" />
                    Start fast
                  </Button>
                ) : (
                  <>
                    <Button
                      className="h-12 w-full text-base font-semibold text-white"
                      disabled={isMutatingFast}
                      onClick={() => setPendingAction("complete")}
                      size="lg"
                    >
                      <Check className="size-4" />
                      End fast
                    </Button>
                    <Button
                      className="h-11 w-full"
                      disabled={isMutatingFast}
                      onClick={() => openStartTimeDialog("edit")}
                      size="lg"
                      variant="outline"
                    >
                      <PencilLine className="size-4" />
                      Edit start time
                    </Button>
                    <button
                      className="min-h-[44px] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      disabled={isMutatingFast}
                      onClick={() => setPendingAction("cancel")}
                      type="button"
                    >
                      Cancel fast
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <FastingMilestoneBar
            active={Boolean(activeSession)}
            elapsedMinutes={elapsedMinutes}
            plannedMinutes={activeSession?.plannedMinutes ?? plannedMinutes}
            startedAt={activeSession?.startedAt ?? null}
          />
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "100ms" }}>
        <CardContent className="p-4 sm:p-6">
          <div className="glass-soft flex items-start gap-3 rounded-[1.6rem] px-4 py-4 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-amber-500/10 p-2 text-amber-300">
              <ShieldAlert className="size-4" />
            </div>
            <p>
              FastTrack is a tracking tool, not medical advice. Fasting may not be appropriate for everyone. People
              under 18, pregnant users, users with diabetes, eating-disorder history, or medical conditions should
              seek qualified medical guidance before fasting.
            </p>
          </div>
        </CardContent>
      </Card>

      {startDialogMode && !pendingStartAdjustment ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeStartTimeDialog();
            }
          }}
        >
          <DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>When did your fast start?</DialogTitle>
              <DialogDescription>
                {startDialogMode === "start"
                  ? "Choose now or set the time your fasting window actually began."
                  : "Adjust the active session so it reflects when your fasting window actually began."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  { label: "Now", value: "now" },
                  { label: "Started earlier", value: "earlier" },
                ] as const).map((option) => {
                  const active = option.value === startTimeMode;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "min-h-[48px] rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary shadow-[0_12px_26px_rgba(139,92,246,0.18)]"
                          : "border-white/[0.08] bg-white/[0.04] text-foreground hover:border-white/[0.14]"
                      )}
                      onClick={() => {
                        setStartTimeMode(option.value);
                        setStartTimeError(null);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {startTimeMode === "earlier" ? (
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.24em] text-muted-foreground" htmlFor="start-time">
                    Start time
                  </label>
                  <Input
                    id="start-time"
                    type="time"
                    inputMode="numeric"
                    value={startTimeValue}
                    onChange={(event) => {
                      setStartTimeValue(event.target.value);
                      setStartTimeError(null);
                    }}
                  />
                  <p className="text-sm leading-6 text-muted-foreground">
                    You’re adjusting your start time. Make sure this reflects when your fasting window actually began.
                  </p>
                </div>
              ) : null}

              <div className="glass-soft rounded-[1.5rem] px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Started</p>
                    <p className="mt-2 text-base font-medium text-foreground">
                      {selectedStartPreview?.startedAt ? formatTime(selectedStartPreview.startedAt) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Ends</p>
                    <p className="mt-2 text-base font-medium text-foreground">
                      {selectedStartPreview?.startedAt
                        ? formatTime(
                            new Date(
                              Date.parse(selectedStartPreview.startedAt) + previewPlannedMinutes * 60000
                            ).toISOString()
                          )
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Elapsed</p>
                    <p className="mt-2 text-base font-medium text-foreground">{formatDuration(previewElapsedMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Remaining</p>
                    <p className="mt-2 text-base font-medium text-foreground">{formatDuration(previewRemainingMinutes)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current status</p>
                    <p className="mt-2 text-base font-medium text-foreground">{previewStage.label}</p>
                  </div>
                </div>
              </div>

              {(selectedStartPreview?.backdatedMinutes ?? 0) > MANUAL_START_CONFIRM_MINUTES ? (
                <div className="rounded-[1.4rem] border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-100">
                  This adjustment moves the start time back more than four hours. Double-check that it reflects when your
                  fasting window actually began.
                </div>
              ) : null}

              {showExtendedWindowWarning ? (
                <div className="rounded-[1.4rem] border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-100">
                  This places you in an extended fasting window. Stay within your plan and stop if you feel unwell.
                </div>
              ) : null}

              {startTimeError ? <p className="text-sm text-destructive">{startTimeError}</p> : null}
            </div>

            <DialogFooter>
              <Button onClick={closeStartTimeDialog} variant="outline">
                Keep current
              </Button>
              <Button disabled={isMutatingFast} onClick={() => void submitStartTimeChange()}>
                <Clock3 className="mr-2 size-4" />
                {startDialogMode === "start" ? "Start fast" : "Save start time"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {pendingStartAdjustment ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingStartAdjustment(null);
            }
          }}
        >
          <DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm adjusted start time</DialogTitle>
              <DialogDescription>
                You’re adjusting your start time. Make sure this reflects when your fasting window actually began.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-[1.4rem] border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-100">
              This change backdates the session by {formatCompactDuration(pendingStartAdjustment.backdatedMinutes)}.
              Use it only when you are correcting the actual start of the window.
            </div>
            <DialogFooter>
              <Button onClick={() => setPendingStartAdjustment(null)} variant="outline">
                Review time
              </Button>
              <Button
                disabled={isMutatingFast}
                onClick={() => void applyStartTimeChange(pendingStartAdjustment)}
              >
                Confirm adjustment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {pendingAction ? (
        <Dialog open onOpenChange={(open) => setPendingAction(open ? pendingAction : null)}>
          <DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{pendingAction === "complete" ? "End this fast?" : "Cancel this fast?"}</DialogTitle>
              <DialogDescription>
                {pendingAction === "complete"
                  ? "This will save the finished session and update your account."
                  : "This will stop the active timer and mark this session as cancelled."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setPendingAction(null)} variant="outline">
                Keep current
              </Button>
              <Button onClick={() => void resolveSession(pendingAction)} variant={pendingAction === "complete" ? "default" : "destructive"}>
                {pendingAction === "complete" ? "End fast" : "Confirm cancel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {activeMilestoneIndex !== null ? (
        <Dialog open onOpenChange={(open) => setActiveMilestoneIndex(open ? activeMilestoneIndex : null)}>
          <DialogContent className="mx-2 max-w-[calc(100vw-1rem)] overflow-hidden sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{`${FASTING_STAGES[activeMilestoneIndex].emoji} ${FASTING_STAGES[activeMilestoneIndex].label}`}</DialogTitle>
              <DialogDescription>{`${formatStageHour(FASTING_STAGES[activeMilestoneIndex].hour)} check-in reached.`}</DialogDescription>
            </DialogHeader>
            <div className="pointer-events-none absolute inset-x-5 top-0 h-56 overflow-hidden">
              {CONFETTI_PIECES.map((piece) => (
                <span
                  key={piece.id}
                  className="confetti-piece"
                  style={
                    {
                      "--confetti-left": piece.left,
                      "--confetti-size": piece.size,
                      "--confetti-delay": piece.delay,
                      "--confetti-drift": piece.drift,
                      "--confetti-rotate": piece.rotate,
                      "--confetti-color": piece.color,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div
              className="animate-pop-in rounded-[1.5rem] border px-4 py-4 text-sm text-muted-foreground"
              style={{
                borderColor: FASTING_STAGES[activeMilestoneIndex].color,
                backgroundColor: `${FASTING_STAGES[activeMilestoneIndex].color}18`,
                boxShadow: `0 16px 36px ${FASTING_STAGES[activeMilestoneIndex].color}24`,
              }}
            >
              <p className="text-base font-semibold text-foreground">
                {FASTING_STAGES[activeMilestoneIndex].emoji} {FASTING_STAGES[activeMilestoneIndex].label}
              </p>
              <p className="mt-3">{FASTING_STAGES[activeMilestoneIndex].description}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setActiveMilestoneIndex(null)}>Keep going</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {completionSummary ? (
        <Dialog open onOpenChange={(open) => setCompletionSummary(open ? completionSummary : null)}>
          <DialogContent className="animate-pop-in mx-2 max-w-[calc(100vw-1rem)] overflow-hidden bg-[linear-gradient(180deg,#1a1a1a_0%,#0d0d0d_100%)] sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-center text-xs uppercase tracking-[0.36em] text-muted-foreground">
                Fast Complete
              </DialogTitle>
              <DialogDescription>Your latest result is saved and ready to share.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-[#b46cff] shadow-[0_16px_34px_rgba(139,92,246,0.3)]">
                  <span className="text-3xl">{completionSummary.stage.emoji}</span>
                </div>
                <p className="font-[family:var(--font-heading)] text-4xl font-bold text-foreground">
                  {formatDuration(completionSummary.durationMinutes)}
                </p>
                <p className="mt-2 text-base text-muted-foreground">
                  Reached {completionSummary.stage.label}
                </p>
              </div>
              <div className="glass-soft grid gap-4 rounded-[1.5rem] px-4 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">XP gained</p>
                  <p className="mt-2 font-[family:var(--font-heading)] text-3xl font-bold text-foreground">
                    +{completionSummary.xpGained}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current streak</p>
                  <p className="mt-2 font-[family:var(--font-heading)] text-3xl font-bold text-foreground">
                    {completionSummary.currentStreak}
                  </p>
                </div>
              </div>
              <div className="glass-soft rounded-[1.5rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total fasts</p>
                <p className="mt-2 font-[family:var(--font-heading)] text-3xl font-bold text-foreground">
                  {completionSummary.totalFasts}
                </p>
              </div>
              {completionSummary.badges.length ? (
                <div className="glass-soft rounded-[1.5rem] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Badges earned</p>
                  <div className="mt-3 space-y-2">
                    {completionSummary.badges.map((badge) => (
                      <div key={badge.id} className="flex items-center justify-between rounded-[1.1rem] bg-white/[0.05] px-3 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {badge.icon} {badge.name}
                        </p>
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Earned</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <DialogFooter>
                <Button onClick={() => void shareCompletion()} variant="secondary">
                  <Share2 className="mr-2 size-4" />
                  Share result
                </Button>
                <Button onClick={() => setCompletionSummary(null)}>Done</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {levelUpSummary ? (
        <Dialog open onOpenChange={(open) => setLevelUpSummary(open ? levelUpSummary : null)}>
          <DialogContent className="animate-pop-in mx-2 max-w-[calc(100vw-1rem)] sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Level up</DialogTitle>
              <DialogDescription>Your steady consistency just moved you into a new level.</DialogDescription>
            </DialogHeader>
            <div className="glass-soft rounded-[1.5rem] border border-primary/30 px-4 py-5">
              <p className="font-[family:var(--font-heading)] text-3xl font-semibold text-foreground">
                Level {levelUpSummary.previousLevel} to Level {levelUpSummary.newLevel}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep following the windows that fit your routine. Your profile progress just moved forward.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setLevelUpSummary(null)}>Keep going</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
