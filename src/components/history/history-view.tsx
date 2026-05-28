"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryData, buildHistorySeries, calculateStats, formatCompactDuration } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type HistoryViewProps = {
  initialData: HistoryData;
  providers: {
    google: boolean;
    github: boolean;
  };
  signedIn: boolean;
};

export function HistoryView({ initialData, providers, signedIn }: HistoryViewProps) {
  const [history, setHistory] = useState(initialData);

  useEffect(() => {
    setHistory(initialData);
  }, [initialData]);

  const stats = calculateStats(history.sessions, history.profile);
  const chartData = buildHistorySeries(history.sessions);
  const completedSessions = history.sessions.filter((session) => session.status === "completed");
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

  if (!signedIn) {
    return (
      <EmptyState
        eyebrow="History"
        title="Your fasting history will appear here."
        description="Track completed windows, trend lines, streaks, and recent sessions once you sign in and start saving progress."
        actions={
          <>
            <SignInDialog
              buttonClassName="w-full sm:w-auto"
              buttonLabel="Sign in to save your progress"
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

      <Card className="section-enter" style={{ animationDelay: "600ms" }}>
        <CardHeader>
          <CardTitle>Recent fasts</CardTitle>
          <CardDescription>Your latest completed sessions, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {completedSessions.length ? (
            completedSessions.map((session) => (
              <div
                key={session.id}
                className="glass-soft flex flex-col gap-3 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {session.endedAt ? format(new Date(session.endedAt), "EEEE, MMM d") : "In progress"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Started {format(new Date(session.startedAt), "h:mm a")}
                  </p>
                  {session.notes ? <p className="mt-2 text-sm text-muted-foreground">{session.notes}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-accent/40 text-accent">
                    Goal {formatCompactDuration(session.plannedMinutes)}
                  </Badge>
                  <span className="font-[family:var(--font-heading)] text-lg font-semibold">
                    {formatCompactDuration(session.durationMinutes ?? 0)}
                  </span>
                </div>
              </div>
            ))
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
