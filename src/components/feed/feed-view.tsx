"use client";

import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedPageData, buildFeedEventCopy } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type FeedViewProps = {
  initialData: FeedPageData;
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
  const groups = initialData.feed.reduce<Record<string, FeedPageData["feed"]>>((accumulator, event) => {
    const key = getGroupLabel(new Date(event.createdAt));

    accumulator[key] ??= [];
    accumulator[key].push(event);

    return accumulator;
  }, {});

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
          ) : Object.keys(groups).length ? (
            Object.entries(groups).map(([label, events]) => (
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
            ))
          ) : (
            <EmptyState
              eyebrow="No activity yet"
              title="Your feed will come to life here."
              description="When friends start sessions, complete planned windows, and keep streaks moving, you’ll see those updates here."
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
