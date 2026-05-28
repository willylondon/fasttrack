"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedPageData, buildFeedEventCopy, formatCompactDuration, getElapsedMinutes } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type FeedViewProps = {
  initialData: FeedPageData;
  providers: {
    google: boolean;
    github: boolean;
  };
  signedIn: boolean;
};

type FeedFilter = "all" | "live" | "completed";

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

function getGroupLabel(date: Date) {
  if (isToday(date)) {
    return "Today";
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  return format(date, "EEEE, MMM d");
}

export function FeedView({ initialData, providers, signedIn }: FeedViewProps) {
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<FeedFilter>("all");

  useEffect(() => {
    if (!initialData.liveSessions.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, [initialData.liveSessions.length]);

  const groups = initialData.feed.reduce<Record<string, FeedPageData["feed"]>>((accumulator, event) => {
    const key = getGroupLabel(new Date(event.createdAt));

    accumulator[key] ??= [];
    accumulator[key].push(event);

    return accumulator;
  }, {});
  const completedGroups = initialData.feed
    .filter((event) => event.eventType === "fast_completed")
    .reduce<Record<string, FeedPageData["feed"]>>((accumulator, event) => {
      const key = getGroupLabel(new Date(event.createdAt));

      accumulator[key] ??= [];
      accumulator[key].push(event);

      return accumulator;
    }, {});
  const showLiveSessions = filter !== "completed" && initialData.liveSessions.length > 0;
  const activeGroups = filter === "completed" ? completedGroups : groups;
  const hasAnyContent = initialData.liveSessions.length > 0 || Object.keys(groups).length > 0;
  const hasVisibleContent = showLiveSessions || Object.keys(activeGroups).length > 0;

  return (
    <div className="grid gap-6">
      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary shadow-[0_8px_20px_rgba(139,92,246,0.16)]">
              <Activity className="size-4" />
            </div>
            <div>
              <CardTitle>Friend activity</CardTitle>
              <CardDescription>
                See shared progress from the people helping you stay steady, consistent, and accountable.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!signedIn ? (
            <EmptyState
              eyebrow="Signed out"
              title="See your accountability feed."
              description="FastTrack brings friend milestones, completed windows, and streak momentum into one calm timeline. Sign in to follow your circle."
              actions={
                <>
                  <SignInDialog
                    buttonClassName="w-full sm:w-auto"
                    buttonLabel="Sign in to save your progress"
                    providers={providers}
                    size="lg"
                  />
                  <Link href="/friends" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                    Explore friends
                  </Link>
                </>
              }
              preview={
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Preview</p>
                  {[
                    "Example: Jordan completed a planned 16h window.",
                    "Example: Maya kept a 5-day consistency streak going.",
                  ].map((item) => (
                    <div key={item} className="glass-soft rounded-[1.4rem] px-4 py-4 text-sm text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              }
            />
          ) : hasAnyContent ? (
            <>
              <Tabs
                value={filter}
                onValueChange={(value) => setFilter(value as FeedFilter)}
                className="gap-3"
              >
                <TabsList aria-label="Feed filters" className="w-full sm:w-auto">
                  <TabsTrigger value="all">All updates</TabsTrigger>
                  <TabsTrigger value="live">Live now</TabsTrigger>
                  <TabsTrigger value="completed">Completed only</TabsTrigger>
                </TabsList>
              </Tabs>

              {showLiveSessions ? (
                <section className="space-y-3">
                  <h2 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Fasting now</h2>
                  <div className="space-y-3">
                    {initialData.liveSessions.map((session) => {
                      const elapsedMinutes = getElapsedMinutes({ startedAt: session.startedAt }, now);

                      return (
                        <div
                          key={session.userId}
                          className="glass-soft flex gap-3 rounded-[1.5rem] px-4 py-4"
                        >
                          <Avatar size="sm">
                            <AvatarImage src={session.avatarUrl ?? undefined} alt={session.displayName ?? "Friend"} />
                            <AvatarFallback>{getInitials(session.displayName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm leading-6 text-foreground">
                                {session.displayName ?? "A friend"} is currently fasting.
                              </p>
                              <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
                                Live now
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              started {format(new Date(session.startedAt), "p")} • {formatCompactDuration(elapsedMinutes)} in • planned {formatCompactDuration(session.plannedMinutes)} • ends {format(new Date(Date.parse(session.startedAt) + session.plannedMinutes * 60000), "p")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {Object.entries(activeGroups).map(([label, events]) => (
                <section key={label} className="space-y-3">
                  <h2 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</h2>
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="glass-soft flex gap-3 rounded-[1.5rem] px-4 py-4"
                      >
                        <Avatar size="sm">
                          <AvatarImage src={event.actor?.avatarUrl ?? undefined} alt={event.actor?.displayName ?? "Friend"} />
                          <AvatarFallback>{getInitials(event.actor?.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm leading-6 text-foreground">{buildFeedEventCopy(event)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {!hasVisibleContent ? (
                <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground">
                  {filter === "live"
                    ? "No friends are sharing an active fasting window right now."
                    : "No completed windows have been shared here yet."}
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              eyebrow="No activity yet"
              title="Your feed will come to life here."
              description="When friends start sessions, stay active, and complete planned windows, you’ll see those updates here."
              actions={
                <>
                  <Link href="/friends" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
                    Add friends
                  </Link>
                  <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                    Back to dashboard
                  </Link>
                </>
              }
              preview={
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Example updates</p>
                  {[
                    "Example: Chris completed a planned window.",
                    "Example: Nia kept her weekly streak moving.",
                  ].map((item) => (
                    <div key={item} className="glass-soft rounded-[1.4rem] px-4 py-4 text-sm text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              }
            />
          )}
          {signedIn ? (
            <div className="glass-soft flex items-start gap-3 rounded-[1.5rem] px-4 py-4 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                <ArrowRight className="size-4" />
              </div>
              <p>Friend activity is for accountability, not pressure. FastTrack highlights consistency over extreme fasting.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
