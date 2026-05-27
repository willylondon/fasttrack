"use client";

import { Crown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardData, LeaderboardEntry } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type LeaderboardViewProps = {
  initialData: LeaderboardData;
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

function renderRows(entries: LeaderboardEntry[], statLabel: string) {
  if (!entries.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-14 text-center text-sm text-muted-foreground">
        No leaderboard activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.userId}
          className={cn(
            "flex items-center justify-between gap-3 rounded-[1.5rem] border px-4 py-4",
            entry.isCurrentUser
              ? "border-primary/40 bg-primary/10 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]"
              : "border-border/70 bg-background/70"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-sm font-semibold text-foreground">
              {entry.rank <= 3 ? <Crown className="size-4 text-gold" /> : `#${entry.rank}`}
            </div>
            <Avatar size="sm">
              <AvatarImage src={entry.avatarUrl ?? undefined} alt={entry.displayName ?? "User"} />
              <AvatarFallback>{getInitials(entry.displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{entry.displayName ?? "FastTrack user"}</p>
              <p className="text-xs text-muted-foreground">Level {entry.level}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-[family:var(--font-heading)] text-lg font-semibold text-foreground">{entry.stat}</p>
            <p className="text-xs text-muted-foreground">{statLabel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeaderboardView({ initialData }: LeaderboardViewProps) {
  return (
    <div className="grid gap-6">
      <Card className="border border-border/80 bg-card/90">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="font-[family:var(--font-heading)]">Leaderboard</CardTitle>
              <CardDescription>Three ways to compare momentum without changing the visual feel of the app.</CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Live rankings
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="weekly" className="gap-5">
            <TabsList className="rounded-full bg-background/70">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="all-time">All Time</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly">{renderRows(initialData.weekly, "hours this week")}</TabsContent>
            <TabsContent value="monthly">{renderRows(initialData.monthly, "hours this month")}</TabsContent>
            <TabsContent value="all-time">{renderRows(initialData.allTime, "XP")}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
