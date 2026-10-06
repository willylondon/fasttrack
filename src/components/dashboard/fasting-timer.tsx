"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronDown, Clock3, Download, Flag, LoaderCircle, PencilLine, Share2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { FastingMilestoneBar } from "@/components/dashboard/fasting-milestone-bar";
import { SHARE_CARD_SIZES, ShareFastCard, ShareFastCardPreview, type ShareCardFormat, type ShareCardTheme } from "@/components/dashboard/share-fast-card";
import { TimerRing } from "@/components/dashboard/timer-ring";
import { WeekActivity } from "@/components/dashboard/week-activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  isFastSubstantiallyOverdue,
  MANUAL_START_CONFIRM_MINUTES,
  MAX_MANUAL_START_BACKDATE_MINUTES,
  MAX_PUBLIC_FAST_MINUTES,
  validateFastEndTimestamp,
  validateManualStartTimestamp,
} from "@/lib/fasting";
import { FASTING_STAGES, type FastingStage } from "@/lib/fasting-stages";
import {
  buildPostSyncLocalDashboardData,
  safeStorageRead,
  safeStorageWrite,
  SYNC_AFTER_SIGN_IN_KEY,
  LOCAL_DASHBOARD_STORAGE_KEY,
  readLocalDashboardData,
  writeLocalDashboardData,
} from "@/lib/local-dashboard";
import { completionRetryBody, isDefinitiveCompletionRejection, parsePendingCompletions, type PendingCompletion, reconcileFastSession, resolveLocalDateTime } from "@/lib/timer-recovery";
import { cn } from "@/lib/utils";
import { coalesceScopedRequest, withRequestTimeout, type PendingScopedRequest } from "@/lib/scoped-request";

type FastingTimerProps = {
  initialData: DashboardData;
  signedIn: boolean;
  userId?: string | null;
};

type PendingAction = "complete" | "cancel" | null;
type StartTimeMode = "now" | "earlier";
type EndTimeMode = "now" | "earlier";
type StartDialogMode = "start" | "edit" | null;
type WindowOptionLabel = (typeof WINDOW_OPTIONS)[number]["label"];

type CompletionSummary = {
  sessionId?: string;
  durationMinutes: number;
  stage: FastingStage;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  currentStreak: number | null;
  totalFasts: number | null;
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
  { label: "20h", minutes: 20 * 60 },
  { label: "22h", minutes: 22 * 60 },
  { label: "24h", minutes: 24 * 60 },
] as const;

const SAFETY_ACKNOWLEDGEMENT_KEY = "fasttrack:safety-acknowledged:v1";
const SHARE_CARD_PREFERENCES_KEY = "fasttrack:share-card:v1";

type ShareCardOptions = {
  format: ShareCardFormat;
  theme: ShareCardTheme;
  showTimes: boolean;
};

const DEFAULT_SHARE_CARD_OPTIONS: ShareCardOptions = { format: "post", theme: "dusk", showTimes: true };

function readShareCardOptions(): ShareCardOptions {
  try {
    const parsed = JSON.parse(safeStorageRead("localStorage", SHARE_CARD_PREFERENCES_KEY) ?? "null") as Partial<ShareCardOptions> | null;
    return {
      format: parsed?.format === "story" ? "story" : "post",
      theme: parsed?.theme === "daybreak" ? "daybreak" : "dusk",
      showTimes: parsed?.showTimes !== false,
    };
  } catch {
    return DEFAULT_SHARE_CARD_OPTIONS;
  }
}

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
  { label: "12h", minutes: 720 },
  { label: "24h", minutes: 1440 },
  { label: "2d", minutes: 2880 },
  { label: "7d", minutes: 10080 },
] as const;
const QUICK_END_BACKDATE_OPTIONS = [
  { label: "30m ago", minutes: 30 },
  { label: "1h ago", minutes: 60 },
  { label: "2h ago", minutes: 120 },
  { label: "4h ago", minutes: 240 },
] as const;
const CLOCK_HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const CLOCK_MINUTES = Array.from({ length: 60 }, (_, index) => index);

type ClockPeriod = "AM" | "PM";

type ClockTimeInputProps = {
  id: string;
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

function getClockParts(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hours = match ? Number(match[1]) : 0;
  const minutes = match ? Number(match[2]) : 0;

  return {
    hour: hours % 12 || 12,
    minute: Math.min(Math.max(minutes, 0), 59),
    period: (hours >= 12 ? "PM" : "AM") as ClockPeriod,
  };
}

function buildClockValue(hour: number, minute: number, period: ClockPeriod) {
  const hours = period === "PM" ? (hour % 12) + 12 : hour % 12;
  return `${hours.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function ClockTimeInput({ id, invalid = false, label, onChange, value }: ClockTimeInputProps) {
  const parts = getClockParts(value);
  const selectClassName =
    "h-11 min-w-0 cursor-pointer rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&>option]:bg-background [&>option]:text-foreground";

  return (
    <div aria-label={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2" role="group">
      <select
        aria-invalid={invalid}
        aria-label={`${label} hour`}
        className={selectClassName}
        id={id}
        onChange={(event) => onChange(buildClockValue(Number(event.target.value), parts.minute, parts.period))}
        value={parts.hour}
      >
        {CLOCK_HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <select
        aria-invalid={invalid}
        aria-label={`${label} minute`}
        className={selectClassName}
        onChange={(event) => onChange(buildClockValue(parts.hour, Number(event.target.value), parts.period))}
        value={parts.minute}
      >
        {CLOCK_MINUTES.map((minute) => (
          <option key={minute} value={minute}>
            {minute.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        aria-invalid={invalid}
        aria-label={`${label} AM or PM`}
        className={selectClassName}
        onChange={(event) => onChange(buildClockValue(parts.hour, parts.minute, event.target.value as ClockPeriod))}
        value={parts.period}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

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

function getDateValue(value: string | null | undefined) {
  return format(new Date(value ?? Date.now()), "yyyy-MM-dd");
}

function formatDateDraft(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

const resolveManualStartTimeFromDraft = resolveLocalDateTime;

type LiveTimerPanelProps = {
  sessions: DashboardData["sessions"];
  historyReady: boolean;
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
  sessions,
  historyReady,
  activeSession,
  plannedMinutes,
  selectedWindow,
  isMutatingFast,
  onSelectWindow,
  onOpenStartTimeDialog,
  onPendingAction,
  onStageReached,
}: LiveTimerPanelProps) {
  const [now, setNow] = useState(0);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const planSummaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, activeSession ? 1000 : 60_000);
    window.addEventListener("focus", updateClock);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateClock);
    };
  }, [activeSession]);

  const elapsedMinutes = getElapsedMinutes(activeSession, now);
  const progress = getProgressPercent(activeSession, now);
  const currentStageIndex = getStageIndexForMinutes(elapsedMinutes);
  const currentStage = getStageForMinutes(elapsedMinutes);
  const remainingMinutes = activeSession ? Math.max(activeSession.plannedMinutes - elapsedMinutes, 0) : plannedMinutes;
  const needsOverdueResolution = isFastSubstantiallyOverdue(activeSession, now);
  const statusLabel = getStatusLabel(Boolean(activeSession), currentStage, remainingMinutes);
  const hourlyCheckIn = getHourlyCheckIn(elapsedMinutes / 60, Boolean(activeSession));

  useEffect(() => {
    if (!activeSession || currentStageIndex === 0) {
      return;
    }

    onStageReached(currentStageIndex);
  }, [activeSession, currentStageIndex, onStageReached]);

  const targetAt = activeSession
    ? new Date(Date.parse(activeSession.startedAt) + activeSession.plannedMinutes * 60000)
    : null;

  return (
    <div className="space-y-3">
      <WeekActivity sessions={sessions} now={now} ready={historyReady && now > 0} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)] lg:items-center lg:gap-6">
        <TimerRing
          active={Boolean(activeSession)}
          elapsedMinutes={elapsedMinutes}
          elapsedSeconds={activeSession ? (now - Date.parse(activeSession.startedAt)) / 1000 : 0}
          plannedMinutes={activeSession?.plannedMinutes ?? plannedMinutes}
          progress={activeSession ? progress : 0}
          stage={currentStage}
        />

        <div className="space-y-3">
          {activeSession && targetAt ? (
            <div className="premium-rail grid grid-cols-2 divide-x divide-white/[0.08] rounded-2xl py-2">
              <button
                aria-label={now ? `Edit start time, ${format(new Date(activeSession.startedAt), "EEE, MMM d, p")}` : "Edit start time"}
                className="group min-h-11 min-w-0 px-3 text-left disabled:opacity-50"
                disabled={isMutatingFast}
                onClick={() => onOpenStartTimeDialog("edit")}
                type="button"
              >
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Started <PencilLine aria-hidden="true" className="size-3" /></span>
                <span className="timer-numerals mt-1 block text-sm font-semibold text-foreground group-hover:text-primary-readable">{now ? format(new Date(activeSession.startedAt), "EEE, p") : "—"}</span>
              </button>
              <div className="min-w-0 px-3 py-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{formatCompactDuration(activeSession.plannedMinutes)} target</p>
                <time dateTime={targetAt.toISOString()} className="timer-numerals mt-1 block text-sm font-semibold text-foreground">{now ? format(targetAt, "EEE, p") : "—"}</time>
              </div>
            </div>
          ) : (
            <details className="group/plan premium-rail rounded-2xl" open={planPickerOpen} onToggle={(event) => setPlanPickerOpen(event.currentTarget.open)}>
              <summary ref={planSummaryRef} className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-readable">
                <span><span className="font-semibold text-foreground">{formatCompactDuration(plannedMinutes)} plan</span><span className="ml-2 text-muted-foreground">Change</span></span>
                <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open/plan:rotate-180" />
              </summary>
              <fieldset disabled={isMutatingFast} className="min-w-0 space-y-3 border-t border-white/[0.08] p-3">
                <legend className="sr-only">Choose a fasting window</legend>
                <div className="grid grid-cols-4 gap-2">
                  {WINDOW_OPTIONS.map((option) => (
                    <button
                      aria-pressed={option.label === selectedWindow}
                      className={cn("min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors disabled:opacity-50", option.label === selectedWindow ? "border-primary bg-primary/15 text-primary-readable" : "border-white/[0.08] bg-white/[0.04] text-foreground hover:bg-white/[0.08]")}
                      key={option.label}
                      onClick={() => { onSelectWindow(option.label); setPlanPickerOpen(false); planSummaryRef.current?.focus(); }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Choose the window that fits your plan. You can set an earlier start next.</p>
              </fieldset>
            </details>
          )}

          {needsOverdueResolution ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm leading-5 text-amber-100" role="status">
              This fast is well past its plan. Resolve it to keep your history accurate.
            </p>
          ) : !activeSession && plannedMinutes >= 18 * 60 ? (
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Extended windows need extra care. Stay within your plan and stop if you feel unwell.
            </p>
          ) : null}

          <Button
            className="h-12 w-full text-base font-semibold text-white"
            disabled={isMutatingFast}
            aria-busy={isMutatingFast}
            onClick={() => activeSession ? onPendingAction("complete") : onOpenStartTimeDialog("start")}
            size="lg"
          >
            {isMutatingFast ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : activeSession ? <Check aria-hidden="true" className="size-4" /> : <Flag aria-hidden="true" className="size-4" />}
            {isMutatingFast ? "Saving…" : activeSession ? needsOverdueResolution ? "Resolve overdue fast" : "End fast" : "Start fast"}
          </Button>
        </div>
      </div>

      {activeSession ? (
        <details className="group/details rounded-2xl border border-white/[0.08] bg-white/[0.025]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm text-muted-foreground marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-readable">
            <span>Session details</span>
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open/details:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-white/[0.08] p-3">
            <p className="text-sm font-medium text-foreground">{statusLabel}</p>
            <p className="text-sm leading-6 text-muted-foreground">{hourlyCheckIn}</p>
            <FastingMilestoneBar active elapsedMinutes={elapsedMinutes} plannedMinutes={activeSession.plannedMinutes} startedAt={activeSession.startedAt} />
            <Button className="min-h-11 w-full" disabled={isMutatingFast} onClick={() => onPendingAction("cancel")} variant="outline">Cancel fast</Button>
          </div>
        </details>
      ) : null}
    </div>
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
  const [shareOptions, setShareOptions] = useState<ShareCardOptions>(DEFAULT_SHARE_CARD_OPTIONS);
  const [preparedShareImage, setPreparedShareImage] = useState<{ key: string; blob: Blob } | null>(null);
  const [startDialogMode, setStartDialogMode] = useState<StartDialogMode>(null);
  const [startTimeMode, setStartTimeMode] = useState<StartTimeMode>("now");
  const [startDateValue, setStartDateValue] = useState(() => getDateValue(new Date().toISOString()));
  const [startTimeValue, setStartTimeValue] = useState(() => getClockValue(new Date().toISOString()));
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeMode, setEndTimeMode] = useState<EndTimeMode>("now");
  const [endDateValue, setEndDateValue] = useState(() => getDateValue(new Date().toISOString()));
  const [endTimeValue, setEndTimeValue] = useState(() => getClockValue(new Date().toISOString()));
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [endTimeOverride, setEndTimeOverride] = useState<string | null>(null);
  const [pendingStartAdjustment, setPendingStartAdjustment] = useState<PendingStartAdjustment | null>(null);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [localDashboardReady, setLocalDashboardReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [pendingCompletions, setPendingCompletions] = useState<PendingCompletion[]>([]);
  const mutationRef = useRef(false);
  const generationRef = useRef(0);
  const refreshSequenceRef = useRef(0);
  const dashboardRequestRef = useRef<PendingScopedRequest<DashboardData | undefined> | null>(null);
  const accountRef = useRef(userId);

  const startOperationRef = useRef<string | null>(null);
  const milestoneInFlightRef = useRef(false);
  const lastDashboardRefreshRef = useRef(0);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    accountRef.current = userId;
    mutationRef.current = false;
    setIsMutatingFast(false);
    setSyncError(null);
    generationRef.current++;
    lastDashboardRefreshRef.current = 0;
    dashboardRequestRef.current = null;
    startOperationRef.current = null;
    setPendingCompletions(userId ? parsePendingCompletions(safeStorageRead("localStorage", `fasttrack:pending-rewards:${userId}`), userId) : []);
    return () => { accountRef.current = undefined; };
  }, [userId]);

  useEffect(() => {
    setSafetyAcknowledged(safeStorageRead("localStorage", SAFETY_ACKNOWLEDGEMENT_KEY) === "true");
    setShareOptions(readShareCardOptions());
  }, []);

  function updateShareOptions(next: Partial<ShareCardOptions>) {
    setShareOptions((current) => {
      const merged = { ...current, ...next };
      safeStorageWrite("localStorage", SHARE_CARD_PREFERENCES_KEY, JSON.stringify(merged));
      return merged;
    });
  }

  const shareImageKey = completionSummary
    ? [completionSummary.sessionId ?? completionSummary.endedAt, completionSummary.durationMinutes, completionSummary.currentStreak, completionSummary.totalFasts, shareOptions.format, shareOptions.theme, shareOptions.showTimes].join("|")
    : null;

  const renderShareImage = useCallback(async () => {
    const node = shareCardRef.current;
    if (!node) throw new Error("Share image is not ready yet.");
    const { width, height } = SHARE_CARD_SIZES[shareOptions.format];
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(node, { pixelRatio: 1, canvasWidth: width, canvasHeight: height, width, height });
    if (!blob) throw new Error("Share image generation failed.");
    return blob;
  }, [shareOptions.format]);

  // Render ahead of the tap: iOS only allows navigator.share() shortly after a user gesture,
  // so the image must already exist when Share is pressed.
  useEffect(() => {
    if (!shareImageKey) {
      setPreparedShareImage(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderShareImage()
        .then((blob) => { if (!cancelled) setPreparedShareImage({ key: shareImageKey, blob }); })
        .catch(() => undefined);
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [renderShareImage, shareImageKey]);

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

    setStorageWarning(!writeLocalDashboardData(dashboardData));
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

    const startedAt = resolveManualStartTimeFromDraft(startDateValue, startTimeValue);

    if (!startedAt) {
      return {
        startedAt: null,
        backdatedMinutes: 0,
        error: "Use a valid date and 24-hour start time.",
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
  const selectedEndPreview = (() => {
    if (pendingAction !== "complete" || !activeSession) {
      return null;
    }

    const endedAt =
      endTimeMode === "now"
        ? new Date().toISOString()
        : endTimeOverride ?? resolveManualStartTimeFromDraft(endDateValue, endTimeValue);

    if (!endedAt) {
      return {
        endedAt: null,
        durationMinutes: 0,
        error: "Use a valid date and 24-hour end time.",
      };
    }

    const validation = validateFastEndTimestamp(activeSession.startedAt, endedAt);

    return {
      endedAt: validation.valid ? endedAt : null,
      durationMinutes: validation.durationMinutes,
      error: validation.message,
    };
  })();
  const refreshDashboard = useCallback(async (options?: { force?: boolean; quiet?: boolean }) => {
    if (!userId) {
      return undefined;
    }

    const currentTime = Date.now();
    if (!options?.force && currentTime - lastDashboardRefreshRef.current < DASHBOARD_REFRESH_COOLDOWN_MS) {
      return undefined;
    }

    const generation = generationRef.current;
    const account = userId;
    return coalesceScopedRequest(dashboardRequestRef, { account, generation }, async () => {
      if (accountRef.current !== account || generationRef.current !== generation) return undefined;
      const sequence = ++refreshSequenceRef.current;
      try {
        return await withRequestTimeout(async (signal) => {
          const response = await fetch("/api/dashboard", {
            method: "GET",
            headers: { "X-FastTrack-Account": account },
            cache: "no-store",
            signal,
          });

          if (!response.ok) {
            throw new Error(await readApiError(response));
          }

          const nextDashboard = (await response.json()) as DashboardData;
          if (signal.aborted || accountRef.current !== account || generation !== generationRef.current || sequence !== refreshSequenceRef.current) return undefined;
          lastDashboardRefreshRef.current = Date.now();
          setDashboardData(nextDashboard);
          return nextDashboard;
        });
      } catch (error) {
        if (!options?.quiet && accountRef.current === account && generationRef.current === generation) {
          toast.error(error instanceof Error ? error.message : "Dashboard refresh failed.");
        }
        return undefined;
      }
    }, { forceFresh: options?.force });
  }, [userId]);

  useEffect(() => {
    if (!signedIn || !userId || mutationRef.current) return;
    const marker = safeStorageRead("sessionStorage", SYNC_AFTER_SIGN_IN_KEY);
    if (marker !== "true" && marker !== userId) return;
    // Claim legacy sign-in intent for this account before attempting transmission.
    if (!safeStorageWrite("sessionStorage", SYNC_AFTER_SIGN_IN_KEY, userId)) {
      setSyncError("Device storage is unavailable. Local history has not been synced.");
      return;
    }
    const localData = readLocalDashboardData();
    const completedSessions = localData.sessions.filter(
      (session): session is typeof session & { endedAt: string } =>
        session.status === "completed" && Boolean(session.endedAt) && (session.durationMinutes ?? 0) > 0
    );
    if (!localData.activeSession && !completedSessions.length) {
      safeStorageWrite("sessionStorage", SYNC_AFTER_SIGN_IN_KEY, null);
      setSyncError(null);
      return;
    }
    mutationRef.current = true;
    generationRef.current++;
    setIsMutatingFast(true);
    setSyncError(null);
    const account = userId;
    void (async () => {
      let activeSessionSynced = false;
      const completedSessionIds: string[] = [];
      const errors: string[] = [];
      try {
        for (let offset = 0; offset < completedSessions.length; offset += 250) {
          if (accountRef.current !== account) return;
          const batch = completedSessions.slice(offset, offset + 250);
          const response = await fetch("/api/fasts/import", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedAccountId: account, sessions: batch.map((session) => ({
              sourceId: session.id, startedAt: session.startedAt, endedAt: session.endedAt,
              plannedMinutes: session.plannedMinutes, notes: session.notes,
            })) }),
          });
          if (!response.ok) throw new Error(await readApiError(response));
          const payload = await response.json() as { syncedSourceIds?: string[] };
          if (!Array.isArray(payload.syncedSourceIds)) throw new Error("History sync returned an invalid response.");
          completedSessionIds.push(...payload.syncedSourceIds.filter((id) => batch.some((item) => item.id === id)));
        }
      } catch (error) { errors.push(error instanceof Error ? error.message : "History could not be synced."); }
      try {
        if (localData.activeSession && accountRef.current === account) {
          const response = await fetch("/api/fasts", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedAccountId: account, sourceId: localData.activeSession.id,
              plannedMinutes: localData.activeSession.plannedMinutes, startedAt: localData.activeSession.startedAt }),
          });
          if (!response.ok) throw new Error(await readApiError(response));
          const payload = await response.json() as { session: DashboardData["sessions"][number] };
          if (!payload.session?.id) throw new Error("Active fast sync returned an invalid response.");
          activeSessionSynced = true;
          if (accountRef.current === account) {
            generationRef.current++;
            setDashboardData((current) => reconcileFastSession(current, payload.session));
          }
        }
      } catch (error) { errors.push(error instanceof Error ? error.message : "Active fast could not be synced."); }
      if (accountRef.current !== account) return;
      // Read latest storage so confirmed imports cannot erase progress made in another tab.
      const remaining = buildPostSyncLocalDashboardData(readLocalDashboardData(), {
        activeSessionSynced: activeSessionSynced && readLocalDashboardData().activeSession?.id === localData.activeSession?.id,
        completedSessionIds,
      });
      const saved = remaining ? writeLocalDashboardData(remaining) : safeStorageWrite("localStorage", LOCAL_DASHBOARD_STORAGE_KEY, null);
      if (!saved) errors.push("Synced progress could not be cleared from this device. Retry when storage is available.");
      const outstanding = remaining?.activeSession || remaining?.sessions.some((item) => item.status === "completed" && (item.durationMinutes ?? 0) > 0);
      if (!outstanding && saved) {
        if (!safeStorageWrite("sessionStorage", SYNC_AFTER_SIGN_IN_KEY, null)) errors.push("Progress synced, but device storage is unavailable.");
      } else if (!errors.length) errors.push("Some local progress still needs to sync.");
      if (activeSessionSynced || completedSessionIds.length) {
        await refreshDashboard({ force: true, quiet: true });
        toast.success("Local progress saved to your account.");
      }
      setSyncError(errors.length ? errors.join(" ") : null);
    })().catch(() => {
      if (accountRef.current === account) setSyncError("Local progress could not be synced. Please retry.");
    }).finally(() => {
      if (accountRef.current === account) {
        mutationRef.current = false;
        setIsMutatingFast(false);
      }
    });
  }, [refreshDashboard, signedIn, userId, syncAttempt]);

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
    if (mutationRef.current || !activeSession || stageIndex === 0) {
      return;
    }

    if (stageIndex <= dashboardData.milestoneStageReached || milestoneInFlightRef.current) {
      return;
    }

    milestoneInFlightRef.current = true;
    const milestoneGeneration = generationRef.current;
    const milestoneSessionId = activeSession.id;

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
            expectedAccountId: userId,
            stageIndex,
          }),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        if (generationRef.current !== milestoneGeneration || accountRef.current !== userId) return;
        setDashboardData((current) => current.activeSession?.id !== milestoneSessionId ? current : ({
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
    if (mutationRef.current) return;
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
    setStartDateValue(getDateValue(mode === "edit" ? activeSession?.startedAt : new Date().toISOString()));
    setStartTimeValue(getClockValue(mode === "edit" ? activeSession?.startedAt : new Date().toISOString()));
  }

  function acknowledgeSafetyAndStart() {
    if (!safeStorageWrite("localStorage", SAFETY_ACKNOWLEDGEMENT_KEY, "true")) setStorageWarning(true);
    setSafetyAcknowledged(true);
    setSafetyDialogOpen(false);
    setStartDialogMode("start");
    setStartTimeError(null);
    setStartTimeMode("now");
    setStartDateValue(getDateValue(new Date().toISOString()));
    setStartTimeValue(getClockValue(new Date().toISOString()));
  }

  function closeStartTimeDialog() {
    if (mutationRef.current) return;
    setStartDialogMode(null);
    setStartTimeError(null);
    setPendingStartAdjustment(null);
  }

  function setManualStartFromBackdate(minutes: number) {
    const startedAt = new Date(Date.now() - minutes * 60000).toISOString();

    setStartTimeMode("earlier");
    setStartDateValue(getDateValue(startedAt));
    setStartTimeValue(getClockValue(startedAt));
    setStartTimeError(null);
  }

  async function applyStartTimeChange(payload: PendingStartAdjustment) {
    if (mutationRef.current) return;
    if (payload.mode === "edit" && !activeSession) {
      toast.error("No active fast is available to adjust.");
      return;
    }

    if (plannedMinutes > MAX_PUBLIC_FAST_MINUTES) {
      toast.error("FastTrack supports planned windows up to 24 hours.");
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
          ? "Fast started. Tracking on this device."
          : "Start time updated. Progress recalculated on this device."
      );
      return;
    }

    mutationRef.current = true;
    generationRef.current++;
    const account = userId;
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
                expectedAccountId: userId,
                sourceId: startOperationRef.current ?? (startOperationRef.current = crypto.randomUUID()),
                startedAt: payload.startedAt,
              }
            : {
                action: "edit_start",
                expectedAccountId: userId,
                startedAt: payload.startedAt,
              }),
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const responsePayload = (await response.json()) as { session: DashboardData["activeSession"] };
      if (accountRef.current !== account) return;
      if (!responsePayload.session) throw new Error("The server did not return the saved fast.");
      generationRef.current++;
      setDashboardData((current) => reconcileFastSession(current, responsePayload.session!));
      startOperationRef.current = null;
      setStartDialogMode(null);
      setStartTimeError(null);
      setPendingStartAdjustment(null);
      toast.success(responsePayload.session.status !== "active" ? "Your previously saved fast was recovered." : payload.mode === "start" ? "Fast started. Progress saved." : "Start time updated. Progress recalculated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this start time.");
    } finally {
      if (accountRef.current === account) {
        mutationRef.current = false;
        setIsMutatingFast(false);
      }
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

  function openSessionAction(action: Exclude<PendingAction, null>) {
    if (mutationRef.current) return;
    setPendingAction(action);
    setEndTimeError(null);
    setEndTimeOverride(null);

    if (action === "complete") {
      const now = new Date().toISOString();
      setEndTimeMode("now");
      setEndDateValue(getDateValue(now));
      setEndTimeValue(getClockValue(now));
    }
  }

  function setManualEndTime(endedAt: string) {
    setEndTimeMode("earlier");
    setEndDateValue(getDateValue(endedAt));
    setEndTimeValue(getClockValue(endedAt));
    setEndTimeError(null);
    setEndTimeOverride(endedAt);
  }

  function setEndFromBackdate(minutes: number) {
    setManualEndTime(new Date(Date.now() - minutes * 60000).toISOString());
  }

  function setEndAtPlannedWindow() {
    if (!activeSession) {
      return;
    }

    const plannedEndMs = Date.parse(activeSession.startedAt) + activeSession.plannedMinutes * 60000;
    setManualEndTime(new Date(Math.min(plannedEndMs, Date.now())).toISOString());
  }

  function savePendingCompletions(intents: PendingCompletion[], account: string) {
    const unique = parsePendingCompletions(JSON.stringify(intents), account);
    setPendingCompletions(unique);
    if (!safeStorageWrite("localStorage", `fasttrack:pending-rewards:${account}`, unique.length ? JSON.stringify(unique) : null)) {
      setStorageWarning(true);
      toast.warning("Device storage is unavailable. Keep this page open until the completion is confirmed.");
    }
  }

  async function retryPendingRewards() {
    if (!userId || mutationRef.current) return;
    const account = userId;
    let remaining = [...pendingCompletions];
    mutationRef.current = true;
    generationRef.current++;
    setIsMutatingFast(true);
    try {
      for (const intent of pendingCompletions) {
        if (accountRef.current !== account) return;
        const response = await fetch(`/api/fasts/${intent.sessionId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completionRetryBody(intent)),
        });
        if (accountRef.current !== account) return;
        if (!response.ok) {
          const message = await readApiError(response);
          if (isDefinitiveCompletionRejection(response.status, message)) {
            remaining = remaining.filter((entry) => entry.sessionId !== intent.sessionId);
            savePendingCompletions(remaining, account);
          }
          throw new Error(message);
        }
        const payload = await response.json() as { session?: DashboardData["sessions"][number]; rewardsPending?: boolean };
        if (accountRef.current !== account) return;
        if (!payload.session || payload.session.id !== intent.sessionId || payload.session.status !== "completed") {
          throw new Error("Completion could not be confirmed. Please retry.");
        }
        generationRef.current++;
        setDashboardData((current) => reconcileFastSession(current, payload.session!));
        setPendingAction(null);
        setActiveMilestoneIndex(null);
        if (payload.rewardsPending) throw new Error("Your completed fast is saved. Rewards are still updating; try again later.");
        remaining = remaining.filter((entry) => entry.sessionId !== intent.sessionId);
        savePendingCompletions(remaining, account);
      }
      // The mutation already confirmed persistence and rewards. Revalidation is optional.
      void refreshDashboard({ force: true, quiet: true });
      if (accountRef.current === account) toast.success("Completion and rewards confirmed.");
    } catch (error) {
      if (accountRef.current === account) toast.error(error instanceof Error ? error.message : "Completion could not be confirmed yet.");
    } finally {
      if (accountRef.current === account) {
        mutationRef.current = false;
        setIsMutatingFast(false);
      }
    }
  }

  async function resolveSession(action: Exclude<PendingAction, null>, completedAt?: string) {
    if (mutationRef.current) return;
    if (!activeSession) {
      return;
    }

    if (action === "complete") {
      const validation = validateFastEndTimestamp(
        activeSession.startedAt,
        completedAt ?? new Date().toISOString()
      );

      if (!validation.valid) {
        setEndTimeError(validation.message);
        return;
      }
    }

    if (!userId) {
      const endedAt = action === "complete" && completedAt ? completedAt : new Date().toISOString();
      const durationMinutes = Math.max(
        0,
        Math.round((Date.parse(endedAt) - Date.parse(activeSession.startedAt)) / 60000)
      );

      if (action === "complete" && durationMinutes < 1) {
        setPendingAction(null);
        toast.error("Fast must run for at least 1 minute before it can be completed. Cancel it instead if this was a mistake.");
        return;
      }

      const finalStageReached = getStageIndexForMinutes(durationMinutes);
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

      toast.success(action === "complete" ? "Fast complete. Recorded on this page." : "Fast cancelled.");
      return;
    }

    mutationRef.current = true;
    generationRef.current++;
    const account = userId;
    setIsMutatingFast(true);
    const intent: PendingCompletion | null = action === "complete" ?
      pendingCompletions.find((entry) => entry.sessionId === activeSession.id) ??
      { sessionId: activeSession.id, accountId: account, endedAt: completedAt ?? new Date().toISOString() } : null;
    const queued = intent ? [...pendingCompletions.filter((entry) => entry.sessionId !== intent.sessionId), intent] : pendingCompletions;
    // Write ahead of the request: a lost response or page reload must preserve the chosen end time.
    if (intent) savePendingCompletions(queued, account);

    try {
      const response = await fetch(`/api/fasts/${activeSession.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          expectedAccountId: userId,
          notes: "",
          ...(intent ? completionRetryBody(intent) : {}),
        }),
      });

      if (!response.ok) {
        const message = await readApiError(response);
        if (intent && accountRef.current === account && isDefinitiveCompletionRejection(response.status, message)) {
          savePendingCompletions(queued.filter((entry) => entry.sessionId !== intent.sessionId), account);
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as {
        session: DashboardData["sessions"][number];
        gamification?: FastCompletionGamification;
        rewardsPending?: boolean;
        progress?: { currentStreak: number; totalFasts: number };
      };
      const finishedSession = payload.session;
      if (accountRef.current !== account) return;
      if (!finishedSession?.id || finishedSession.id !== activeSession.id ||
          finishedSession.status !== (action === "complete" ? "completed" : "cancelled")) throw new Error("The server did not confirm this fast. Please retry.");
      if (action === "complete") {
        savePendingCompletions(payload.rewardsPending ? queued : queued.filter((entry) => entry.sessionId !== finishedSession.id), account);
      }
      generationRef.current++;
      setDashboardData((current) => reconcileFastSession(current, finishedSession));
      setPendingAction(null);
      setActiveMilestoneIndex(null);

      // Present the confirmed result now; optional account refresh must not keep
      // Start/End disabled. Its existing account/generation guard rejects stale data.
      const refreshGeneration = generationRef.current;
      void refreshDashboard({ force: true, quiet: true }).then((nextDashboard) => {
        if (accountRef.current !== account || generationRef.current !== refreshGeneration) return;
        if (!nextDashboard) {
          toast.warning("Fast saved. Account totals will refresh when your connection returns.");
          return;
        }
        if (nextDashboard.profile) {
          const profile = nextDashboard.profile;
          setCompletionSummary((current) => current?.sessionId === finishedSession.id
            ? { ...current, currentStreak: profile.currentStreak, totalFasts: profile.totalFasts }
            : current);
        }
      });

      if (action === "complete" && finishedSession) {
        const stage = getStageForMinutes(finishedSession.durationMinutes ?? 0);
        setCompletionSummary({
          sessionId: finishedSession.id,
          durationMinutes: finishedSession.durationMinutes ?? 0,
          stage,
          startedAt: finishedSession.startedAt,
          endedAt: finishedSession.endedAt ?? new Date().toISOString(),
          plannedMinutes: finishedSession.plannedMinutes,
          currentStreak: payload.progress?.currentStreak ?? null,
          totalFasts: payload.progress?.totalFasts ?? null,
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
      if (accountRef.current === account) {
        mutationRef.current = false;
        setIsMutatingFast(false);
      }
    }
  }

  async function getShareImage() {
    if (preparedShareImage && preparedShareImage.key === shareImageKey) return preparedShareImage.blob;
    return renderShareImage();
  }

  function getShareFilename() {
    return `fasttrack-${completionSummary ? format(new Date(completionSummary.endedAt), "yyyy-MM-dd") : "fast"}.png`;
  }

  function downloadShareImage(blob: Blob) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = getShareFilename();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  async function shareCompletion() {
    if (!completionSummary) return;
    setIsSharingResult(true);

    try {
      const blob = await getShareImage();
      const file = new File([blob], getShareFilename(), { type: "image/png" });
      const shareData = {
        files: [file],
        text: `Just finished a ${formatCompactDuration(completionSummary.durationMinutes)} fast.`,
      };

      if (typeof navigator.canShare === "function" && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }

      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          toast.success("Image copied. Paste it into your chat.");
          return;
        } catch {
          // Fall through to a download when clipboard image writes are blocked.
        }
      }

      downloadShareImage(blob);
      toast.success("Image saved. Attach it to your chat.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Unable to create the share image.");
    } finally {
      setIsSharingResult(false);
    }
  }

  async function saveCompletionImage() {
    if (!completionSummary) return;
    setIsSharingResult(true);
    try {
      downloadShareImage(await getShareImage());
      toast.success("Image saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the share image.");
    } finally {
      setIsSharingResult(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <p className="sr-only" role="status">{isMutatingFast ? "Saving your fast. Please wait." : ""}</p>
      {storageWarning ? <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm">{signedIn ? "Device storage is unavailable. Your saved fasts are safe, but pending retries may not survive closing this page." : "Device storage is unavailable. Progress is only kept while this page stays open."}</p> : null}
      {pendingCompletions.length ? <div role="status" className="rounded-xl border border-primary/30 p-3 text-sm"><p>A completion or reward update still needs confirmation. Retry to check its status.</p><Button className="mt-2" disabled={isMutatingFast} onClick={() => void retryPendingRewards()} variant="outline">Retry completion</Button></div> : null}
      {syncError ? <div role="alert" className="rounded-xl border border-amber-400/30 p-3 text-sm"><p>{syncError}</p><Button className="mt-2" disabled={isMutatingFast} onClick={() => setSyncAttempt((value) => value + 1)} variant="outline">Retry sync</Button></div> : null}
      {!signedIn && !activeSession ? (
        <Card className="order-2 section-enter surface-primary relative overflow-hidden" style={{ animationDelay: "100ms" }}>
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Badge className="w-fit">Private beta preview</Badge>
              <h2 className="mt-4 font-[family:var(--font-heading)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Track your fasting window
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Try the FastTrack timer locally, review milestone guidance, and sync later when you are ready.
              </p>
            </div>
            <div className="premium-rail grid grid-cols-3 gap-2 rounded-[1.35rem] p-2 text-center">
              {[
                { label: "Core goals", value: "12-16h" },
                { label: "Extended max", value: "24h" },
                { label: "Saved here", value: "Local" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl px-2 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground sm:text-base">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="order-1 surface-primary section-enter relative overflow-hidden py-0 hover:translate-y-0" style={{ animationDelay: "0ms" }}>
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <CardContent className="space-y-3 p-3 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-[family:var(--font-heading)] text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {activeSession ? "Current fast" : "Your fasting window"}
            </h2>
            <span className="text-xs text-muted-foreground">{activeSession ? "In progress" : "Not started"}</span>
          </div>

          <LiveTimerPanel
            sessions={dashboardData.sessions}
            historyReady={localDashboardReady}
            activeSession={activeSession}
            isMutatingFast={isMutatingFast}
            onOpenStartTimeDialog={openStartTimeDialog}
            onPendingAction={openSessionAction}
            onSelectWindow={setSelectedWindow}
            onStageReached={handleStageReached}
            plannedMinutes={plannedMinutes}
            selectedWindow={selectedWindow}
          />
        </CardContent>
      </Card>

      <div className="order-3 section-enter flex items-start gap-3 px-2 text-sm leading-6 text-muted-foreground" style={{ animationDelay: "150ms" }}>
        <div className="rounded-xl bg-amber-500/10 p-2 text-amber-300">
          <ShieldAlert className="size-4" />
        </div>
        <p>
          FastTrack is a tracking tool, not medical advice. Fasting may not be appropriate for everyone. People
          under 18, pregnant users, users with diabetes, eating-disorder history, or medical conditions should
          seek qualified medical guidance before fasting.
        </p>
      </div>

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
            if (!open && !mutationRef.current) {
              closeStartTimeDialog();
            }
          }}
        >
          <DialogContent showCloseButton={!isMutatingFast} className="top-[calc(env(safe-area-inset-top)+0.5rem)] mx-0 flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] max-h-[720px] max-w-[calc(100vw-1rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:top-1/2 sm:mx-auto sm:h-auto sm:max-h-[min(720px,calc(100dvh-2rem))] sm:max-w-lg sm:-translate-y-1/2">
            <DialogHeader className="shrink-0 px-4 pb-3 pt-4 pr-12 sm:px-5 sm:pt-5">
              <DialogTitle>When did your fast start?</DialogTitle>
              <DialogDescription>
                {startDialogMode === "start"
                  ? "Choose now or set the time your fasting window actually began."
                  : "Adjust the active session so it reflects when your fasting window actually began."}
              </DialogDescription>
            </DialogHeader>

            <fieldset disabled={isMutatingFast} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">
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
                          ? "border-primary bg-primary/15 text-primary-readable shadow-[0_12px_26px_rgba(139,92,246,0.18)]"
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.24em] text-muted-foreground" htmlFor="start-date">
                        Start date
                      </label>
                      <Input
                        id="start-date"
                        aria-invalid={Boolean(startTimeError)}
                        autoComplete="off"
                        enterKeyHint="next"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="2026-06-15"
                        value={startDateValue}
                        onChange={(event) => {
                          setStartDateValue(formatDateDraft(event.target.value));
                          setStartTimeError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.24em] text-muted-foreground" htmlFor="start-time">
                        Start time
                      </label>
                      <ClockTimeInput
                        id="start-time"
                        invalid={Boolean(startTimeError)}
                        label="Start time"
                        value={startTimeValue}
                        onChange={(value) => {
                          setStartTimeValue(value);
                          setStartTimeError(null);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
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
                    Pick the date and 24-hour time, or use a quick backdate to fill them in.
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

              {startTimeError ? <p className="text-sm text-destructive" role="alert">{startTimeError}</p> : null}
            </fieldset>

            <DialogFooter className="relative z-10 mx-0 mb-0 shrink-0 bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:mx-0 sm:mb-0 sm:px-5 sm:py-4">
              <Button onClick={closeStartTimeDialog} variant="outline">
                Keep current
              </Button>
              <Button disabled={isMutatingFast} aria-busy={isMutatingFast} onClick={() => void submitStartTimeChange()}>
                {isMutatingFast ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : <Clock3 aria-hidden="true" className="mr-2 size-4" />}
                {isMutatingFast ? startDialogMode === "start" ? "Starting…" : "Saving…" : startDialogMode === "start" ? "Start fast" : "Save start time"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {pendingStartAdjustment ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !mutationRef.current) {
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
              <Button disabled={isMutatingFast} onClick={() => setPendingStartAdjustment(null)} variant="outline">
                Review time
              </Button>
              <Button
                disabled={isMutatingFast}
                aria-busy={isMutatingFast}
                onClick={() => void applyStartTimeChange(pendingStartAdjustment)}
              >
                {isMutatingFast ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
                {isMutatingFast ? "Saving…" : "Confirm adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {pendingAction ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !mutationRef.current) {
              setPendingAction(null);
              setEndTimeError(null);
            }
          }}
        >
          <DialogContent className="mx-2 max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:mx-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{pendingAction === "complete" ? "End this fast?" : "Cancel this fast?"}</DialogTitle>
              <DialogDescription>
                {pendingAction === "complete"
                  ? signedIn
                    ? "Save the time you actually finished. Your account totals will use that time."
                    : "Save the time you actually finished. This session will stay on this device until you sign in."
                  : "This will stop the active timer and mark this session as cancelled."}
              </DialogDescription>
            </DialogHeader>
            {pendingAction === "complete" && activeSession ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2" aria-label="Choose when the fast ended">
                  {([
                    { label: "End now", value: "now" },
                    { label: "Ended earlier", value: "earlier" },
                  ] as const).map((option) => {
                    const active = endTimeMode === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        className={cn(
                          "min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary/15 text-primary-readable"
                            : "border-white/[0.08] bg-white/[0.04] text-foreground hover:border-white/[0.14]"
                        )}
                        onClick={() => {
                          setEndTimeMode(option.value);
                          setEndTimeError(null);
                          setEndTimeOverride(null);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {endTimeMode === "earlier" ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-[0.24em] text-muted-foreground" htmlFor="end-date">
                          End date
                        </label>
                        <Input
                          id="end-date"
                          autoComplete="off"
                          inputMode="numeric"
                          maxLength={10}
                          value={endDateValue}
                          onChange={(event) => {
                            setEndDateValue(formatDateDraft(event.target.value));
                            setEndTimeError(null);
                            setEndTimeOverride(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-[0.24em] text-muted-foreground" htmlFor="end-time">
                          End time
                        </label>
                        <ClockTimeInput
                          id="end-time"
                          invalid={Boolean(endTimeError || selectedEndPreview?.error)}
                          label="End time"
                          value={endTimeValue}
                          onChange={(value) => {
                            setEndTimeValue(value);
                            setEndTimeError(null);
                            setEndTimeOverride(null);
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button
                        className="min-h-10 rounded-xl border border-primary/25 bg-primary/10 px-2 text-xs font-medium text-primary-readable transition-colors hover:bg-primary/15 sm:col-span-1"
                        onClick={setEndAtPlannedWindow}
                        type="button"
                      >
                        At planned end
                      </button>
                      {QUICK_END_BACKDATE_OPTIONS.map((option) => (
                        <button
                          key={option.minutes}
                          className="min-h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.08]"
                          onClick={() => setEndFromBackdate(option.minutes)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="glass-soft grid grid-cols-2 gap-3 rounded-[1.4rem] px-4 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Recorded duration</p>
                    <p className="mt-2 text-base font-medium text-foreground">
                      {selectedEndPreview?.endedAt
                        ? formatDuration(selectedEndPreview.durationMinutes)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">End time</p>
                    <p className="mt-2 text-base font-medium text-foreground">
                      {selectedEndPreview?.endedAt ? formatTime(selectedEndPreview.endedAt) : "—"}
                    </p>
                  </div>
                </div>

                {endTimeError || selectedEndPreview?.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {endTimeError ?? selectedEndPreview?.error}
                  </p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button disabled={isMutatingFast} onClick={() => setPendingAction(null)} variant="outline">
                Keep current
              </Button>
              <Button
                disabled={isMutatingFast}
                aria-busy={isMutatingFast}
                onClick={() => {
                  if (pendingAction === "complete") {
                    if (!selectedEndPreview?.endedAt || selectedEndPreview.error) {
                      setEndTimeError(selectedEndPreview?.error ?? "Choose a valid end time.");
                      return;
                    }

                    void resolveSession("complete", selectedEndPreview.endedAt);
                    return;
                  }

                  void resolveSession("cancel");
                }}
                variant={pendingAction === "complete" ? "default" : "destructive"}
              >
                {isMutatingFast ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
                {isMutatingFast ? pendingAction === "complete" ? "Saving…" : "Cancelling…" : pendingAction === "complete" ? "Save completed fast" : "Confirm cancel"}
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
          <DialogContent className="animate-pop-in mx-2 max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:mx-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Fast complete</DialogTitle>
              <DialogDescription>
                {formatCompactDuration(completionSummary.durationMinutes)} saved. Share it with your friends or group chat.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className={cn("mx-auto w-full", shareOptions.format === "story" ? "max-w-[15rem]" : "max-w-[20rem]")}>
                <ShareFastCardPreview
                  currentStreak={completionSummary.currentStreak}
                  durationMinutes={completionSummary.durationMinutes}
                  endedAt={completionSummary.endedAt}
                  format={shareOptions.format}
                  plannedMinutes={completionSummary.plannedMinutes}
                  showTimes={shareOptions.showTimes}
                  startedAt={completionSummary.startedAt}
                  theme={shareOptions.theme}
                  totalFasts={completionSummary.totalFasts}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "Format", options: [{ value: "post", label: "Post" }, { value: "story", label: "Story" }], key: "format" },
                  { label: "Look", options: [{ value: "dusk", label: "Dusk" }, { value: "daybreak", label: "Daybreak" }], key: "theme" },
                ] as const).map((group) => (
                  <div key={group.key} role="group" aria-label={group.label} className="grid grid-cols-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                    {group.options.map((option) => {
                      const active = shareOptions[group.key] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={active}
                          className={cn(
                            "min-h-10 rounded-lg px-2 text-sm font-medium transition-colors",
                            active ? "bg-white/[0.12] text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => updateShareOptions({ [group.key]: option.value } as Partial<ShareCardOptions>)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground">
                Show start and end times
                <input
                  checked={shareOptions.showTimes}
                  className="size-5 accent-[hsl(var(--primary))]"
                  onChange={(event) => updateShareOptions({ showTimes: event.target.checked })}
                  type="checkbox"
                />
              </label>

              <dl className="grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-center">
                {[
                  { label: "XP gained", value: signedIn ? `+${completionSummary.xpGained}` : "—" },
                  { label: "Streak", value: completionSummary.currentStreak ?? "…" },
                  { label: "Total fasts", value: completionSummary.totalFasts ?? "…" },
                ].map((item) => (
                  <div key={item.label} className="px-2">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="timer-numerals mt-1 text-lg font-semibold text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {completionSummary.badges.length ? (
                <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-3">
                  <p className="text-xs text-muted-foreground">Badges earned</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {completionSummary.badges.map((badge) => (
                      <li key={badge.id} className="rounded-full bg-white/[0.06] px-3 py-1 text-sm font-medium text-foreground">
                        {badge.icon} {badge.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button disabled={isSharingResult} onClick={() => setCompletionSummary(null)} variant="ghost">
                  Done
                </Button>
                <Button disabled={isSharingResult} onClick={() => void saveCompletionImage()} variant="outline">
                  <Download aria-hidden="true" className="mr-2 size-4" />
                  Save image
                </Button>
                <Button disabled={isSharingResult} aria-busy={isSharingResult} onClick={() => void shareCompletion()}>
                  {isSharingResult ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : <Share2 aria-hidden="true" className="mr-2 size-4" />}
                  Share
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {completionSummary ? (
        <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
          <ShareFastCard
            ref={shareCardRef}
            currentStreak={completionSummary.currentStreak}
            durationMinutes={completionSummary.durationMinutes}
            endedAt={completionSummary.endedAt}
            format={shareOptions.format}
            plannedMinutes={completionSummary.plannedMinutes}
            showTimes={shareOptions.showTimes}
            startedAt={completionSummary.startedAt}
            theme={shareOptions.theme}
            totalFasts={completionSummary.totalFasts}
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
