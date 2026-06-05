"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DailyCheckIn,
  FastSession,
  HistoryData,
  buildHistorySeries,
  calculateStats,
  formatCompactDuration,
} from "@/lib/fasting";
import { buildSignedOutHistoryData, readLocalDashboardData } from "@/lib/local-dashboard";
import { cn } from "@/lib/utils";

type HistoryViewProps = {
  initialData: HistoryData;
  providers: {
    google: boolean;
    github: boolean;
  };
  signedIn: boolean;
};

type CheckInDraft = {
  energy: number;
  mood: number;
  hunger: number;
  sleepQuality: number;
  note: string;
};

type EndTimeDraft = {
  date: string;
  time: string;
};

const DEFAULT_CHECK_IN_DRAFT: CheckInDraft = {
  energy: 3,
  mood: 3,
  hunger: 3,
  sleepQuality: 3,
  note: "",
};

const CHECK_IN_FIELDS = [
  { key: "energy", label: "Energy" },
  { key: "mood", label: "Mood" },
  { key: "hunger", label: "Hunger" },
  { key: "sleepQuality", label: "Sleep" },
] satisfies Array<{ key: keyof Omit<CheckInDraft, "note">; label: string }>;

function buildDrafts(checkIns: DailyCheckIn[]) {
  return Object.fromEntries(
    checkIns.map((checkIn) => [
      checkIn.sessionId,
      {
        energy: checkIn.energy,
        mood: checkIn.mood,
        hunger: checkIn.hunger,
        sleepQuality: checkIn.sleepQuality,
        note: checkIn.note ?? "",
      },
    ])
  ) as Record<string, CheckInDraft>;
}

function buildLocalCheckInInsights(checkIns: DailyCheckIn[]) {
  if (!checkIns.length) {
    return [];
  }

  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const averageEnergy = average(checkIns.map((checkIn) => checkIn.energy));
  const averageMood = average(checkIns.map((checkIn) => checkIn.mood));
  const averageHunger = average(checkIns.map((checkIn) => checkIn.hunger));
  const goodEnergyCount = checkIns.filter((checkIn) => checkIn.energy >= 4).length;

  return [
    {
      label: "Energy",
      value: averageEnergy.toFixed(1),
      detail:
        averageEnergy >= 4
          ? "Your recent fasts are landing with strong energy."
          : "Energy is mixed; consider gentler targets on lower-energy days.",
    },
    {
      label: "Mood",
      value: averageMood.toFixed(1),
      detail:
        averageMood >= 4
          ? "Mood looks steady after recent sessions."
          : "Mood has room to improve; watch sleep, stress, and timing.",
    },
    {
      label: "Hunger",
      value: averageHunger.toFixed(1),
      detail:
        averageHunger >= 4
          ? "Hunger has been high; consistency may improve with less aggressive windows."
          : "Hunger has stayed manageable across recent check-ins.",
    },
    {
      label: "Best signal",
      value: `${goodEnergyCount}/${checkIns.length}`,
      detail: "Check-ins with strong energy help identify your most repeatable fasting rhythm.",
    },
  ];
}

function formatDateDraft(value: string) {
  return format(new Date(value), "yyyy-MM-dd");
}

function formatTimeDraft(value: string) {
  return format(new Date(value), "HH:mm");
}

function resolveEndTimeDraft(draft: EndTimeDraft) {
  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(draft.date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.test(draft.time);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const parsed = new Date(`${draft.date}T${draft.time}:00`);

  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function HistoryView({ initialData, providers, signedIn }: HistoryViewProps) {
  const [history, setHistory] = useState(initialData);
  const [checkInDrafts, setCheckInDrafts] = useState<Record<string, CheckInDraft>>(() =>
    buildDrafts(initialData.checkIns)
  );
  const [savingCheckInId, setSavingCheckInId] = useState<string | null>(null);
  const [editingEndSessionId, setEditingEndSessionId] = useState<string | null>(null);
  const [savingEndSessionId, setSavingEndSessionId] = useState<string | null>(null);
  const [endTimeDrafts, setEndTimeDrafts] = useState<Record<string, EndTimeDraft>>({});

  useEffect(() => {
    if (!signedIn) {
      setHistory(buildSignedOutHistoryData(readLocalDashboardData()));
      setCheckInDrafts({});
      return;
    }

    setHistory(initialData);
    setCheckInDrafts(buildDrafts(initialData.checkIns));
  }, [initialData, signedIn]);

  const stats = calculateStats(history.sessions, history.profile);
  const chartData = buildHistorySeries(history.sessions);
  const completedSessions = history.sessions.filter((session) => session.status === "completed");
  const checkInMap = new Map(history.checkIns.map((checkIn) => [checkIn.sessionId, checkIn]));
  const checkInInsights = history.checkInInsights.length
    ? history.checkInInsights
    : buildLocalCheckInInsights(history.checkIns);
  const resolvedSessions = history.sessions.filter((session) => session.status !== "active");
  const completionRate = resolvedSessions.length
    ? Math.round((completedSessions.length / resolvedSessions.length) * 100)
    : 0;
  const weeklyConsistency = Math.min(
    100,
    Math.round(
      (completedSessions.filter(
        (session) => session.endedAt && new Date(session.endedAt) >= subDays(new Date(), 7)
      ).length /
        7) *
        100
    )
  );

  function updateCheckInDraft(sessionId: string, patch: Partial<CheckInDraft>) {
    setCheckInDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...(current[sessionId] ?? DEFAULT_CHECK_IN_DRAFT),
        ...patch,
      },
    }));
  }

  function startEditingEndTime(session: FastSession) {
    const endedAt = session.endedAt;

    if (!endedAt) {
      return;
    }

    setEditingEndSessionId(session.id);
    setEndTimeDrafts((current) => ({
      ...current,
      [session.id]: current[session.id] ?? {
        date: formatDateDraft(endedAt),
        time: formatTimeDraft(endedAt),
      },
    }));
  }

  function updateEndTimeDraft(sessionId: string, patch: Partial<EndTimeDraft>) {
    setEndTimeDrafts((current) => ({
      ...current,
      [sessionId]: {
        date: current[sessionId]?.date ?? "",
        time: current[sessionId]?.time ?? "",
        ...patch,
      },
    }));
  }

  async function refreshHistory() {
    const response = await fetch("/api/history", { cache: "no-store" });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to refresh history.");
    }

    const nextHistory = (await response.json()) as HistoryData;
    setHistory(nextHistory);
    setCheckInDrafts(buildDrafts(nextHistory.checkIns));
  }

  async function saveEndTime(sessionId: string) {
    const draft = endTimeDrafts[sessionId];
    const endedAt = draft ? resolveEndTimeDraft(draft) : null;

    if (!endedAt) {
      toast.error("Use a valid date and 24-hour end time.");
      return;
    }

    setSavingEndSessionId(sessionId);

    try {
      const response = await fetch(`/api/fasts/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "edit_end",
          endedAt,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        session?: FastSession;
        message?: string;
      } | null;

      if (!response.ok || !payload?.session) {
        throw new Error(payload?.message ?? "Unable to save end time.");
      }

      await refreshHistory();
      setEditingEndSessionId(null);
      toast.success("End time updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save end time.");
    } finally {
      setSavingEndSessionId(null);
    }
  }

  async function saveCheckIn(sessionId: string) {
    const draft = checkInDrafts[sessionId] ?? DEFAULT_CHECK_IN_DRAFT;
    setSavingCheckInId(sessionId);

    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          energy: draft.energy,
          mood: draft.mood,
          hunger: draft.hunger,
          sleepQuality: draft.sleepQuality,
          note: draft.note.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        checkIn?: DailyCheckIn;
        message?: string;
      } | null;

      if (!response.ok || !payload?.checkIn) {
        throw new Error(payload?.message ?? "Unable to save check-in.");
      }

      setHistory((current) => {
        const nextCheckIns = [
          payload.checkIn!,
          ...current.checkIns.filter((checkIn) => checkIn.sessionId !== sessionId),
        ];

        return {
          ...current,
          checkIns: nextCheckIns,
          checkInInsights: buildLocalCheckInInsights(nextCheckIns),
        };
      });
      toast.success("Check-in saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save check-in.");
    } finally {
      setSavingCheckInId(null);
    }
  }

  if (!signedIn && !resolvedSessions.length) {
    return (
      <EmptyState
        eyebrow="History"
        title="Your fasting history will appear here."
        description="Completed windows saved on this device will appear here. Sign in to keep your history synced across devices."
        actions={
          <>
            <SignInDialog
              buttonClassName="w-full sm:w-auto"
              buttonLabel="Sign in to sync your history"
              providers={providers}
              size="lg"
            />
            <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
              Back to dashboard
            </Link>
          </>
        }
        preview={
          <div className="glass-soft rounded-[1.6rem] p-4">
            <div className="h-48 rounded-[1.3rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
          </div>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      {!signedIn ? (
        <Card className="section-enter border-accent/25 bg-accent/5" style={{ animationDelay: "0ms" }}>
          <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Saved on this device</CardTitle>
              <CardDescription>
                Your recent sessions are available here locally. Sign in to keep your progress synced across devices.
              </CardDescription>
            </div>
            <SignInDialog
              buttonClassName="w-full sm:w-auto"
              buttonLabel="Sign in to sync your history"
              providers={providers}
              size="lg"
            />
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Completed sessions", value: stats.totalFasts.toString() },
          { label: "Current streak", value: `${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}` },
          { label: "Average session", value: formatCompactDuration(stats.averageMinutes) },
          { label: "Completion rate", value: `${completionRate}%` },
          { label: "Weekly consistency", value: `${weeklyConsistency}%` },
        ].map((item, index) => (
          <Card key={item.label} className="section-enter" style={{ animationDelay: `${index * 100}ms` }}>
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="font-[family:var(--font-heading)] text-3xl">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="section-enter" style={{ animationDelay: "500ms" }}>
        <CardHeader>
          <CardTitle>Weekly trend</CardTitle>
          <CardDescription>Review how your completed windows are trending over time.</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <Tabs defaultValue="hours" className="gap-5">
              <TabsList>
                <TabsTrigger value="hours">Actual hours</TabsTrigger>
                <TabsTrigger value="goal">Goal hours</TabsTrigger>
              </TabsList>
              <TabsContent value="hours">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="hours-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <YAxis stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "18px",
                        }}
                      />
                      <Area type="monotone" dataKey="hours" stroke="#8B5CF6" fill="url(#hours-fill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              <TabsContent value="goal">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="goal-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <YAxis stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "18px",
                        }}
                      />
                      <Area type="monotone" dataKey="goalHours" stroke="#22C55E" fill="url(#goal-fill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <EmptyState
              eyebrow="No saved sessions"
              title="Your fasting history will appear here."
              description="Complete a planned session and FastTrack will start building your trend view, streak summary, and recent log."
              actions={
                <Link href="/" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
                  Start from the dashboard
                </Link>
              }
              preview={
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <div className="h-48 rounded-[1.3rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                </div>
              }
            />
          )}
        </CardContent>
      </Card>

      {signedIn ? (
        <Card className="section-enter" style={{ animationDelay: "600ms" }}>
          <CardHeader>
            <CardTitle>Daily check-in</CardTitle>
            <CardDescription>Track how each completed fast actually felt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkInInsights.length ? (
              <div className="grid gap-3 sm:grid-cols-4">
                {checkInInsights.map((insight) => (
                  <div key={insight.label} className="premium-chip rounded-[1.25rem] px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{insight.label}</p>
                    <p className="mt-2 font-[family:var(--font-heading)] text-2xl font-semibold text-foreground">
                      {insight.value}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.detail}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {completedSessions.slice(0, 5).length ? (
              completedSessions.slice(0, 5).map((session) => {
                const savedCheckIn = checkInMap.get(session.id);
                const draft = checkInDrafts[session.id] ?? DEFAULT_CHECK_IN_DRAFT;

                return (
                  <div key={session.id} className="glass-soft rounded-[1.5rem] px-4 py-4">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {session.endedAt ? format(new Date(session.endedAt), "EEE, MMM d") : "Completed fast"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCompactDuration(session.durationMinutes ?? 0)}
                          {savedCheckIn ? " checked in" : " awaiting check-in"}
                        </p>
                      </div>
                      <Button
                        className="rounded-2xl"
                        disabled={savingCheckInId === session.id}
                        onClick={() => void saveCheckIn(session.id)}
                        size="sm"
                      >
                        {savingCheckInId === session.id ? "Saving..." : savedCheckIn ? "Update" : "Save"}
                      </Button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1.25fr]">
                      {CHECK_IN_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {field.label}
                          </p>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                key={value}
                                aria-label={`${field.label} ${value}`}
                                className={cn(
                                  "grid size-8 place-items-center rounded-xl border text-xs font-medium transition-colors",
                                  draft[field.key] === value
                                    ? "border-primary/60 bg-primary/20 text-foreground"
                                    : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                                )}
                                onClick={() => updateCheckInDraft(session.id, { [field.key]: value })}
                                type="button"
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Note
                        </span>
                        <Textarea
                          maxLength={240}
                          onChange={(event) => updateCheckInDraft(session.id, { note: event.target.value })}
                          placeholder="Anything you noticed?"
                          rows={2}
                          value={draft.note}
                        />
                      </label>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center text-sm text-muted-foreground">
                Complete a fast and the check-in will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="section-enter" style={{ animationDelay: "700ms" }}>
        <CardHeader>
          <CardTitle>Recent fasts</CardTitle>
          <CardDescription>Your latest completed sessions, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {completedSessions.length ? (
            completedSessions.map((session) => {
              const editingEnd = editingEndSessionId === session.id;
              const endDraft = endTimeDrafts[session.id] ?? {
                date: session.endedAt ? formatDateDraft(session.endedAt) : "",
                time: session.endedAt ? formatTimeDraft(session.endedAt) : "",
              };

              return (
                <div
                  key={session.id}
                  className="glass-soft flex flex-col gap-4 rounded-[1.5rem] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {session.endedAt ? format(new Date(session.endedAt), "EEEE, MMM d") : "In progress"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Started {format(new Date(session.startedAt), "h:mm a")}
                      {session.endedAt ? ` • Ended ${format(new Date(session.endedAt), "h:mm a")}` : ""}
                    </p>
                    {session.notes ? <p className="mt-2 text-sm text-muted-foreground">{session.notes}</p> : null}

                    {editingEnd ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <label className="space-y-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            End date
                          </span>
                          <Input
                            inputMode="numeric"
                            maxLength={10}
                            onChange={(event) =>
                              updateEndTimeDraft(session.id, {
                                date: event.target.value.replace(/[^\d-]/g, "").slice(0, 10),
                              })
                            }
                            placeholder="2026-06-05"
                            value={endDraft.date}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            End time
                          </span>
                          <Input
                            enterKeyHint="done"
                            inputMode="numeric"
                            maxLength={5}
                            onChange={(event) =>
                              updateEndTimeDraft(session.id, {
                                time: event.target.value.replace(/[^\d:]/g, "").slice(0, 5),
                              })
                            }
                            placeholder="18:30"
                            value={endDraft.time}
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            className="rounded-2xl"
                            disabled={savingEndSessionId === session.id}
                            onClick={() => void saveEndTime(session.id)}
                            size="sm"
                          >
                            {savingEndSessionId === session.id ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            className="rounded-2xl"
                            disabled={savingEndSessionId === session.id}
                            onClick={() => setEditingEndSessionId(null)}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <Badge variant="outline" className="border-accent/40 text-accent">
                      Goal {formatCompactDuration(session.plannedMinutes)}
                    </Badge>
                    <span className="font-[family:var(--font-heading)] text-lg font-semibold">
                      {formatCompactDuration(session.durationMinutes ?? 0)}
                    </span>
                    {signedIn && session.endedAt ? (
                      <Button
                        className="rounded-2xl"
                        onClick={() => startEditingEndTime(session)}
                        size="sm"
                        variant="outline"
                      >
                        Edit end
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center text-sm text-muted-foreground">
              No completed sessions yet. Once you finish a planned window, it will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
