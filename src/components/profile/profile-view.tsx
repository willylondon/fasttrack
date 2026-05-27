"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { ProfilePageData, buildFeedEventCopy } from "@/lib/fasting";
import { xpForNextLevel, xpIntoCurrentLevel } from "@/lib/gamification/xp";
import { cn } from "@/lib/utils";

type ProfileViewProps = {
  initialData: ProfilePageData;
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function ProfileView({ initialData }: ProfileViewProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialData.notificationsEnabled);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const earnedBadgeIds = useMemo(
    () => new Set(initialData.earnedBadges.map((badge) => badge.badgeId)),
    [initialData.earnedBadges]
  );

  if (!initialData.profile) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-16 text-center text-sm text-muted-foreground">
        Sign in to view your profile.
      </div>
    );
  }

  const currentLevelXp = xpIntoCurrentLevel(initialData.profile.xp);
  const nextLevelXp = xpForNextLevel(initialData.profile.level);
  const progress = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));

  async function toggleNotifications() {
    setIsTogglingNotifications(true);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported in this browser.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      let subscriptionPayload: PushSubscription | null = null;

      if ("PushManager" in window && vapidKey) {
        subscriptionPayload = await registration.pushManager.getSubscription();

        if (!subscriptionPayload) {
          subscriptionPayload = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
      }

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: !notificationsEnabled,
          subscription: subscriptionPayload,
        }),
      });

      if (!notificationsEnabled) {
        await registration.showNotification("FastTrack notifications enabled", {
          body: "You’ll see alerts here when streaks, badges, and milestones fire.",
          icon: "/favicon.ico",
        });
      }

      setNotificationsEnabled((current) => !current);
      toast.success(!notificationsEnabled ? "Notifications enabled." : "Notifications updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update notifications.");
    } finally {
      setIsTogglingNotifications(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                <AvatarImage src={initialData.profile.avatarUrl ?? undefined} alt={initialData.profile.displayName ?? "Profile"} />
                <AvatarFallback>{getInitials(initialData.profile.displayName)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{initialData.profile.displayName ?? "FastTrack user"}</CardTitle>
                <CardDescription>Level {initialData.profile.level} • {initialData.profile.xp} XP total</CardDescription>
              </div>
            </div>
            <Button
              className="rounded-2xl"
              disabled={isTogglingNotifications}
              onClick={() => void toggleNotifications()}
              variant={notificationsEnabled ? "secondary" : "outline"}
            >
              {notificationsEnabled ? <Bell className="mr-2 size-4" /> : <BellOff className="mr-2 size-4" />}
              {notificationsEnabled ? "Notifications On" : "Enable Notifications"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="glass-soft rounded-[1.5rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">XP progress</p>
              <p className="text-xs text-muted-foreground">
                {currentLevelXp}/{nextLevelXp} XP to next level
              </p>
            </div>
            <Progress value={progress}>
              <ProgressLabel>Level progress</ProgressLabel>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">{progress}%</span>
            </Progress>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total fasts", value: initialData.profile.totalFasts.toString() },
              { label: "Total hours", value: initialData.profile.totalFastHours.toString() },
              { label: "Best stage", value: `${initialData.profile.highestStageReached}h` },
              { label: "Friends", value: initialData.profile.friendCount.toString() },
            ].map((item) => (
              <div key={item.label} className="glass-soft rounded-[1.5rem] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-[family:var(--font-heading)] text-3xl font-bold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle>Badge cabinet</CardTitle>
          <CardDescription>Earned badges stay vivid. Locked ones stay mysterious.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {initialData.badges.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);

            return (
              <div
                key={badge.id}
                className={cn(
                  "rounded-[1.5rem] border px-4 py-4 transition-opacity",
                  earned
                    ? "border-primary/30 bg-primary/10"
                    : "border-border/70 bg-background/70 opacity-55"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xl">{earned ? badge.icon : "???"}</p>
                  <Badge variant="outline" className="border-border/60 text-muted-foreground">
                    {badge.category}
                  </Badge>
                </div>
                <p className="mt-3 font-medium text-foreground">{earned ? badge.name : "Locked"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {earned ? badge.description : "Keep fasting to uncover this badge."}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest milestones, badges, and level shifts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialData.recentActivity.length ? (
            initialData.recentActivity.map((event) => (
              <div
                key={event.id}
                className="glass-soft flex gap-3 rounded-[1.5rem] px-4 py-4"
              >
                <Avatar size="sm">
                  <AvatarImage src={initialData.profile?.avatarUrl ?? undefined} alt={initialData.profile?.displayName ?? "Profile"} />
                  <AvatarFallback>{getInitials(initialData.profile?.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm leading-6 text-foreground">{buildFeedEventCopy(event)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center text-sm text-muted-foreground">
              No recent activity yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
