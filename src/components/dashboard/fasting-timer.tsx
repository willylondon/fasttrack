"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, Clock3, Flag, PencilLine, Share2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { FastingMilestoneBar } from "@/components/dashboard/fasting-milestone-bar";
import { ShareFastCard } from "@/components/dashboard/share-fast-card";
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
  calculateStats,
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
  MAX_PUBLIC_FAST_MINUTES,
  resolveManualStartTimeFromClock,
  validateManualStartTimestamp,
} from "@/lib/fasting";
import { FASTING_STAGES, type FastingStage } from "@/lib/fasting-stages";
import {
  buildPostSyncLocalDashboardData,
  LOCAL_DASHBOARD_STORAGE_KEY,
  readLocalDashboardData,
  writeLocalDashboardData,
} from "@/lib/local-dashboard";
import { cn } from "@/lib/utils";

type FastingTimerProps = {
  initialData: DashboardData;
  signedIn: boolean;
  userId?: string | null;
};

type PendingAction = "complete" | "cancel" | null;
type StartTimeMode = "now" | "earlier";
type StartDialogMode = "start" | "edit" | null;
type WindowOptionLabel = (typeof WINDOW_OPTIONS)[number]["label"];

type CompletionSummary = {
  durationMinutes: number;
  stage: FastingStage;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
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
  { label: "18h", minutes: 18 * 60 },
] as const;

const SAFETY_ACKNOWLEDGEMENT_KEY = "fasttrack:safety-acknowledged:v1";
const SYNC_AFTER_SIGN_IN_KEY = `${LOCAL_DASHBOARD_STORAGE_KEY}:sync-after-sign-in`;

const HOURLY_CHECK_INS = [
  "Choose a window that fits your day and begin when ready.",
  "Use the first hour to settle in. A calm start makes the routine easier to repeat.",
  "Keep the pace gentle. Progress comes from consistency, not urgency.",
  "Notice how you feel and stay practical with the rest of your day.",
  "Small check-ins help. Water, routine, and steady pacing usually go further than pressure.",
  "If your energy feels steady, keep following the window you planned.",
  "Keep your schedule practical. A repeatable window matters more than a perfect streak.",
  "Check your plan for the day and adjust only if it still fits comfortably.",
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
const DASHBOARD_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const QUICK_BACKDATE_OPTIONS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "4h", minutes: 240 },
] as const;

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

function getClockValue(value: string | null | undefined) {
  return format(new Date(value ?? Date.now()), "HH:mm");
}

type LiveTimerPanelProps = {
  activeSession: DashboardData["activeSession"];
  plannedMinutes: number;
  selectedWindow: WindowOptionLabel;
  isMutatingFast: boolean;
  onSelectWindow: (windowLabel: WindowOptionLabel) => void;
  onOpenStartTimeDialog: (mode: Exclude<StartDialogMode, null>) => void;
  onPendingAction: (action: Exclude<PendingAction, null>) => void;
  onStageReached: (stageIndex: number) => void;
};

function LiveTimerPanel({
  activeSession,
  plannedMinutes,
  selectedWindow,
  isMutatingFast,
  onSelectWindow,
  onOpenStartTimeDialog,
  onPendingAction,
  onStageReached,
}: LiveTimerPanelProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSession]);

  const elapsedMinutes = getElapsedMinutes(activeSession, now);
  const progress = getProgressPercent(activeSession, now);
  const currentStageIndex = getStageIndexForMinutes(elapsedMinutes);
  const currentStage = getStageForMinutes(elapsedMinutes);
  const remainingMinutes = activeSession ? Math.max(activeSession.plannedMinutes - elapsedMinutes, 0) : plannedMinutes;
  const statusLabel = getStatusLabel(Boolean(activeSession), currentStage, remainingMinutes);
  const hourlyCheckIn = getHourlyCheckIn(elapsedMinutes / 60, Boolean(activeSession));
  const nextMilestone = FASTING_STAGES.find((stage) => stage.hour * 60 > elapsedMinutes);
  const timerMetrics = [
    { label: "Window", value: formatCompactDuration(activeSession?.plannedMinutes ?? plannedMinutes) },
    { label: "Stage", value: activeSession ? currentStage.label : "Ready" },
    { label: activeSession ? "Remaining" : "Starts", value: activeSession ? formatCompactDuration(remainingMinutes) : "Now" },
    { label: "Next", value: nextMilestone ? `${formatStageHour(nextMilestone.hour)} ${nextMilestone.label}` : "Complete" },
  ];

  useEffect(() => {
    if (!activeSession || currentStageIndex === 0) {
      return;
    }

    onStageReached(currentStageIndex);
  }, [activeSession, currentStageIndex, onStageReached]);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:items-center">
        <div className="order-1">
          <TimerRing
            active={Boolean(activeSession)}
            elapsedMinutes={elapsedMinutes}
            plannedMinutes={activeSession?.plannedMinutes ?? plannedMinutes}
            progress={activeSession ? progress : 0}
            stage={currentStage}
          />
          <div className="premium-rail mt-4 grid grid-cols-2 gap-2 rounded-[1.25rem] p-2 sm:grid-cols-4 lg:grid-cols-2">
            {timerMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>
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
                        onClick={() => onSelectWindow(option.label)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  Planned window: <span className="font-medium text-foreground">{formatCompactDuration(plannedMinutes)}</span>
                </p>
                {selectedWindow === "18h" ? (
                  <p className="rounded-[1.1rem] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    18h is FastTrack&apos;s cautious planning max for private beta. Stay within your plan and stop if you feel unwell.
                  </p>
                ) : null}
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

          <div className="premium-rail rounded-[1.25rem] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Coach note</p>
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
                onClick={() => onOpenStartTimeDialog("start")}
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
                  onClick={() => onPendingAction("complete")}
                  size="lg"
                >
                  <Check className="size-4" />
                  End fast
                </Button>
                <Button
                  className="h-11 w-full"
                  disabled={isMutatingFast}
                  onClick={() => onOpenStartTimeDialog("edit")}
                  size="lg"
                  variant="outline"
                >
                  <PencilLine className="size-4" />
                  Edit start time
                </Button>
                <button
                  className="min-h-[44px] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  disabled={isMutatingFast}
                  onClick={() => onPendingAction("cancel")}
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
    </>
  );
}

export function FastingTimer({ initialData, signedIn, userId }: FastingTimerProps) {
  const [dashboardData, setDashboardData] = useState(initialData);
  const [selectedWindow, setSelectedWindow] = useState<WindowOptionLabel>("16h");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [levelUpSummary, setLevelUpSummary] = useState<LevelUpSummary | null>(null);
  const [isMutatingFast, setIsMutatingFast] = useState(false);
  const [isSharingResult, setIsSharingResult] = useState(false);
  const [startDialogMode, setStartDialogMode] = useState<StartDialogMode>(null);
  const [startTimeMode, setStartTimeMode] = useState<StartTimeMode>("now");
  const [startTimeValue, setStartTimeValue] = useState(() => getClockValue(new Date().toISOString()));
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [pendingStartAdjustment, setPendingStartAdjustment] = useState<PendingStartAdjustment | null>(null);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [localDashboardReady, setLocalDashboardReady] = useState(false);
  const milestoneInFlightRef = useRef(false);
  const lastDashboardRefreshRef = useRef(0);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSafetyAcknowledged(window.localStorage.getItem(SAFETY_ACKNOWLEDGEMENT_KEY) === "true");
  }, []);

  useEffect(() => {
    if (signedIn) {
      setDashboardData(initialData ?? EMPTY_DASHBOARD_DATA);
      setLocalDashboardReady(true);
      return;
    }

    setDashboardData(readLocalDashboardData());
    setLocalDashboardReady(true);
  }, [initialData, signedIn]);

  useEffect(() => {
    if (signedIn || !localDashboardReady) {
      return;
    }

    writeLocalDashboardData(dashboardData);
  }, [dashboardData, localDashboardReady, signedIn]);

  const plannedMinutes = WINDOW_OPTIONS.find((option) => option.label === selectedWindow)?.minutes ?? 16 * 60;
  const activeSession = dashboardData.activeSession;
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
  const refreshDashboard = useCallback(async (options?: { force?: boolean; quiet?: boolean }) => {
    if (!userId) {
      return undefined;
    }

    const currentTime = Date.now();
    if (!options?.force && currentTime - lastDashboardRefreshRef.current < DASHBOARD_REFRESH_COOLDOWN_MS) {
      return undefined;
    }

    lastDashboardRefreshRef.current = currentTime;

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
      if (!options?.quiet) {
        toast.error(error instanceof Error ? error.message : "Dashboard refresh failed.");
      }
      return undefined;
    }
  }, [userId]);

  useEffect(() => {
    if (!signedIn || !userId) {
      return;
    }

    if (window.sessionStorage.getItem(SYNC_AFTER_SIGN_IN_KEY) !== "true") {
      return;
    }

    window.sessionStorage.removeItem(SYNC_AFTER_SIGN_IN_KEY);
    const localData = readLocalDashboardData();

    if (!localData.activeSession) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/fasts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plannedMinutes: localData.activeSession?.plannedMinutes,
            startedAt: localData.activeSession?.startedAt,
          }),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const remainingLocalData = buildPostSyncLocalDashboardData(localData);

        if (remainingLocalData) {
          writeLocalDashboardData(remainingLocalData);
        } else {
          window.localStorage.removeItem(LOCAL_DASHBOARD_STORAGE_KEY);
        }
        await refreshDashboard({ force: true });
        toast.success("Local fast synced to your account.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Your local fast could not be saved.");
      }
    })();
  }, [refreshDashboard, signedIn, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") {
        void refreshDashboard({ quiet: true });
      }
    };

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [refreshDashboard, userId]);

  const handleStageReached = useCallback((stageIndex: number) => {
    if (!activeSession || stageIndex === 0) {
      return;
    }

    if (stageIndex <= dashboardData.milestoneStageReached || milestoneInFlightRef.current) {
      return;
    }

    milestoneInFlightRef.current = true;

    if (!userId) {
      setDashboardData((current) => ({
        ...current,
        milestoneStageReached: stageIndex,
        activeSession: current.activeSession
          ? {
              ...current.activeSession,
              stageReached: stageIndex,
            }
          : null,
      }));
      setActiveMilestoneIndex(stageIndex);
      milestoneInFlightRef.current = false;
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/fasts/${activeSession.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "milestone",
            stageIndex,
          }),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        setDashboardData((current) => ({
          ...current,
          milestoneStageReached: stageIndex,
          activeSession: current.activeSession
            ? {
                ...current.activeSession,
                stageReached: stageIndex,
              }
            : null,
        }));
        setActiveMilestoneIndex(stageIndex);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Milestone sync failed.");
      } finally {
        milestoneInFlightRef.current = false;
      }
    })();
  }, [activeSession, dashboardData.milestoneStageReached, userId]);

  function openStartTimeDialog(mode: Exclude<StartDialogMode, null>) {
    if (mode === "start" && activeSession) {
      toast.error("Finish the current fast before starting another.");
      return;
    }

    if (mode === "start" && !safetyAcknowledged) {
      setSafetyDialogOpen(true);
      return;
    }

    setStartDialogMode(mode);
    setStartTimeError(null);
    setStartTimeMode(mode === "edit" ? "earlier" : "now");
    setStartTimeValue(getClockValue(mode === "edit" ? activeSession?.startedAt : new Date().toISOString()));
  }

  function acknowledgeSafetyAndStart() {
    window.localStorage.setItem(SAFETY_ACKNOWLEDGEMENT_KEY, "true");
    setSafetyAcknowledged(true);
    setSafetyDialogOpen(false);
    setStartDialogMode("start");
    setStartTimeError(null);
    setStartTimeMode("now");
    setStartTimeValue(getClockValue(new Date().toISOString()));
  }

  function closeStartTimeDialog() {
    setStartDialogMode(null);
    setStartTimeError(null);
    setPendingStartAdjustment(null);
  }

  function setManualStartFromBackdate(minutes: number) {
    const startedAt = new Date(Date.now() - minutes * 60000).toISOString();

    setStartTimeMode("earlier");
    setStartTimeValue(getClockValue(startedAt));
    setStartTimeError(null);
  }

  async function applyStartTimeChange(payload: PendingStartAdjustment) {
    if (payload.mode === "edit" && !activeSession) {
      toast.error("No active fast is available to adjust.");
      return;
    }

    if (plannedMinutes > MAX_PUBLIC_FAST_MINUTES) {
      toast.error("FastTrack supports planned windows up to 18 hours for this beta.");
      return;
    }

    if (!userId) {
      const stageReached = getStageIndexForMinutes(payload.backdatedMinutes);
      const localSession =
        payload.mode === "start"
          ? {
              id: `local-${Date.now()}`,
              userId: "local",
              startedAt: payload.startedAt,
              endedAt: null,
              durationMinutes: null,
              plannedMinutes,
              status: "active" as const,
              notes: null,
              createdAt: new Date().toISOString(),
              stageReached,
            }
          : activeSession
            ? {
                ...activeSession,
                startedAt: payload.startedAt,
                stageReached,
              }
            : null;

      if (!localSession) {
        toast.error("No active fast is available to adjust.");
        return;
      }

      setDashboardData((current) => ({
        ...current,
        activeSession: localSession,
        milestoneStageReached: stageReached,
      }));
      closeStartTimeDialog();
      toast.success(
        payload.mode === "start"
          ? "Fast started. Progress saved on this device."
          : "Start time updated. Progress recalculated on this device."
      );
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
      setDashboardData((current) => ({
        ...current,
        activeSession: responsePayload.session,
        milestoneStageReached: responsePayload.session?.stageReached ?? 0,
      }));
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

    if (!userId) {
      const endedAt = new Date().toISOString();
      const durationMinutes = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(activeSession.startedAt)) / 60000));

      if (action === "complete" && durationMinutes < 1) {
        setPendingAction(null);
        toast.error("Fast must run for at least 1 minute before it can be completed. Cancel it instead if this was a mistake.");
        return;
      }

      const finalStageReached = Math.max(activeSession.stageReached ?? 0, getStageIndexForMinutes(durationMinutes));
      const finishedSession = {
        ...activeSession,
        endedAt,
        durationMinutes,
        status: action === "complete" ? ("completed" as const) : ("cancelled" as const),
        stageReached: finalStageReached,
      };
      const nextSessions = [finishedSession, ...dashboardData.sessions];
      const nextStats = calculateStats(nextSessions);

      setPendingAction(null);
      setActiveMilestoneIndex(null);
      setDashboardData((current) => ({
        ...current,
        activeSession: null,
        sessions: nextSessions,
        milestoneStageReached: 0,
      }));

      if (action === "complete") {
        setCompletionSummary({
          durationMinutes,
          stage: getStageForMinutes(durationMinutes),
          startedAt: finishedSession.startedAt,
          endedAt: finishedSession.endedAt ?? endedAt,
          plannedMinutes: finishedSession.plannedMinutes,
          currentStreak: nextStats.currentStreak,
          totalFasts: nextStats.totalFasts,
          xpGained: 0,
          badges: [],
        });
      }

      toast.success(action === "complete" ? "Fast complete. Progress saved on this device." : "Fast cancelled.");
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

      const nextDashboard = await refreshDashboard({ force: true });

      if (action === "complete" && finishedSession) {
        const stage = getStageForMinutes(finishedSession.durationMinutes ?? 0);
        setCompletionSummary({
          durationMinutes: finishedSession.durationMinutes ?? 0,
          stage,
          startedAt: finishedSession.startedAt,
          endedAt: finishedSession.endedAt ?? new Date().toISOString(),
          plannedMinutes: finishedSession.plannedMinutes,
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
    if (!completionSummary || !shareCardRef.current) {
      return;
    }

    setIsSharingResult(true);

    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        canvasWidth: 1080,
        canvasHeight: 1350,
        backgroundColor: "#0b0b0b",
      });

      if (!blob) {
        throw new Error("Share image generation failed.");
      }

      const filename = `fasttrack-fast-${format(new Date(completionSummary.endedAt), "yyyy-MM-dd-HHmm")}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      const shareData = {
        files: [file],
        title: "FastTrack result",
        text: `Fast completed • ${formatCompactDuration(completionSummary.durationMinutes)} • Tracked with FastTrack`,
      };

      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        toast.success("Result shared.");
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Result downloaded as PNG.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast.error(error instanceof Error ? error.message : "Unable to generate the share image.");
    } finally {
      setIsSharingResult(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {!signedIn && !activeSession ? (
        <Card className="section-enter surface-primary relative overflow-hidden" style={{ animationDelay: "0ms" }}>
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Badge className="w-fit">Private beta preview</Badge>
              <h2 className="mt-4 font-[family:var(--font-heading)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Track a safer fasting window before you create an account.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Try the FastTrack timer locally, review milestone guidance, and sync later when you are ready.
              </p>
            </div>
            <div className="premium-rail grid grid-cols-3 gap-2 rounded-[1.35rem] p-2 text-center">
              {[
                { label: "Core goals", value: "12-16h" },
                { label: "Cautious max", value: "18h" },
                { label: "Saved here", value: "Local" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl px-2 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground sm:text-base">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="surface-primary section-enter relative overflow-hidden" style={{ animationDelay: "0ms" }}>
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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

          <LiveTimerPanel
            activeSession={activeSession}
            isMutatingFast={isMutatingFast}
            onOpenStartTimeDialog={openStartTimeDialog}
            onPendingAction={setPendingAction}
            onSelectWindow={setSelectedWindow}
            onStageReached={handleStageReached}
            plannedMinutes={plannedMinutes}
            selectedWindow={selectedWindow}
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

      <Dialog open={safetyDialogOpen} onOpenChange={setSafetyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Safety acknowledgement</DialogTitle>
            <DialogDescription>
              FastTrack is a tracker only. It is not medical advice and it does not decide whether fasting is safe for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-6 text-muted-foreground">
            <div className="premium-rail rounded-[1.25rem] px-4 py-4">
              <p className="font-medium text-foreground">Do not start a fast without qualified medical guidance if you are:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Under 18.</li>
                <li>Pregnant, trying to become pregnant, or breastfeeding.</li>
                <li>Diabetic, using glucose-lowering medication, or managing blood sugar risk.</li>
                <li>Underweight, medically at risk, or recovering from illness.</li>
                <li>Living with current or past eating-disorder history.</li>
              </ul>
            </div>
            <p>
              By continuing, you confirm you understand FastTrack only records fasting windows and that you are responsible for using it safely.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSafetyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={acknowledgeSafetyAndStart}>
              I understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {startDialogMode && !pendingStartAdjustment ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeStartTimeDialog();
            }
          }}
        >
          <DialogContent className="bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] top-[calc(env(safe-area-inset-top)+0.5rem)] mx-2 flex max-w-[calc(100vw-1rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:bottom-auto sm:top-1/2 sm:mx-auto sm:max-h-[min(720px,calc(100dvh-2rem))] sm:max-w-lg sm:-translate-y-1/2">
            <DialogHeader className="shrink-0 px-4 pb-3 pt-4 pr-12 sm:px-5 sm:pt-5">
              <DialogTitle>When did your fast start?</DialogTitle>
              <DialogDescription>
                {startDialogMode === "start"
                  ? "Choose now or set the time your fasting window actually began."
                  : "Adjust the active session so it reflects when your fasting window actually began."}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">
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
                    type="text"
                    enterKeyHint="done"
                    inputMode="numeric"
                    maxLength={5}
                    pattern="[0-9:]*"
                    placeholder="14:00"
                    value={startTimeValue}
                    onChange={(event) => {
                      setStartTimeValue(event.target.value.replace(/[^\d:]/g, "").slice(0, 5));
                      setStartTimeError(null);
                    }}
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_BACKDATE_OPTIONS.map((option) => (
                      <button
                        key={option.minutes}
                        className="min-h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.08]"
                        onClick={() => setManualStartFromBackdate(option.minutes)}
                        type="button"
                      >
                        {option.label} ago
                      </button>
                    ))}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Type a 24-hour time, or use a quick backdate. Then use the Start fast button below.
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

            <DialogFooter className="mx-0 mb-0 shrink-0 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:mx-0 sm:mb-0 sm:px-5 sm:py-4">
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
                  Completed session
                </p>
              </div>
              <div className="glass-soft grid gap-3 rounded-[1.5rem] px-4 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Started</p>
                  <p className="mt-2 text-base font-medium text-foreground">{formatTime(completionSummary.startedAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ended</p>
                  <p className="mt-2 text-base font-medium text-foreground">{formatTime(completionSummary.endedAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Planned window</p>
                  <p className="mt-2 text-base font-medium text-foreground">
                    {formatDuration(completionSummary.plannedMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Checkpoint</p>
                  <p className="mt-2 text-base font-medium text-foreground">{completionSummary.stage.label}</p>
                </div>
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
                <Button disabled={isSharingResult} onClick={() => void shareCompletion()} variant="secondary">
                  <Share2 className="mr-2 size-4" />
                  {isSharingResult ? "Preparing image..." : "Share result"}
                </Button>
                <Button onClick={() => setCompletionSummary(null)}>Done</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {completionSummary ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-[200vw] top-0 z-[-1]"
        >
          <ShareFastCard
            ref={shareCardRef}
            durationMinutes={completionSummary.durationMinutes}
            endedAt={completionSummary.endedAt}
            milestoneLabel={completionSummary.stage.label}
            plannedMinutes={completionSummary.plannedMinutes}
            startedAt={completionSummary.startedAt}
          />
        </div>
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
