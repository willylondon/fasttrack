"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Crown } from "lucide-react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardData, LeaderboardEntry, formatCompactDuration } from "@/lib/fasting";
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

function renderRows(entries: LeaderboardEntry[], statLabel: string) {
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
              "glass-soft flex items-center justify-between gap-3 rounded-[1.5rem] px-4 py-4",
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
            <div className="shrink-0 text-right">
              <p className="font-[family:var(--font-heading)] text-3xl font-bold text-foreground">{entry.stat}</p>
              <p className="text-xs text-muted-foreground">{statLabel}</p>
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
              <TabsContent value="weekly">{renderRows(initialData.weekly, "planned windows")}</TabsContent>
              <TabsContent value="monthly">{renderRows(initialData.monthly, "planned windows")}</TabsContent>
              <TabsContent value="all-time">{renderRows(initialData.allTime, "steady sessions")}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
