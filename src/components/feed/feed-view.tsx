"use client";

import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Activity } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedPageData, buildFeedEventCopy } from "@/lib/fasting";

type FeedViewProps = {
  initialData: FeedPageData;
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

export function FeedView({ initialData }: FeedViewProps) {
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
              <CardDescription>Accepted friends are grouped into a clean rolling feed.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(groups).length ? (
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
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-16 text-center text-sm text-muted-foreground">
              No friend activity yet. Add friends and their fast milestones will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
