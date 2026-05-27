"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryData, buildHistorySeries, calculateStats, formatCompactDuration } from "@/lib/fasting";

type HistoryViewProps = {
  initialData: HistoryData;
};

export function HistoryView({ initialData }: HistoryViewProps) {
  const [history, setHistory] = useState(initialData);

  useEffect(() => {
    setHistory(initialData);
  }, [initialData]);

  const stats = calculateStats(history.sessions, history.profile);
  const chartData = buildHistorySeries(history.sessions);
  const completedSessions = history.sessions.filter((session) => session.status === "completed");

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Total fasts", value: stats.totalFasts.toString() },
          { label: "Total hours", value: stats.totalHours.toString() },
          { label: "Average", value: formatCompactDuration(stats.averageMinutes) },
          { label: "Longest", value: formatCompactDuration(stats.longestFast) },
          { label: "Current streak", value: `${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}` },
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
          <CardTitle>Completion trend</CardTitle>
          <CardDescription>Synced completed fasts from your FastTrack account.</CardDescription>
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
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-16 text-center text-sm text-muted-foreground">
              Complete a fast on the dashboard and it will appear here with charts and streak math.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "600ms" }}>
        <CardHeader>
          <CardTitle>Recent fasts</CardTitle>
          <CardDescription>Latest completed sessions, newest first.</CardDescription>
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
              No completed fasts yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
