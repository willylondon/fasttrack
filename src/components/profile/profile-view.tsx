"use client";

import { useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Bell, BellOff, Check, Image as ImageIcon, RotateCcw, Save, Upload, UserRound, Eye, EyeOff, Trophy } from "lucide-react";
import { toast } from "sonner";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { buildFeedEventCopy } from "@/lib/fasting";
import type { ProfilePageData, ProfileSummary } from "@/lib/fasting";
import { xpForNextLevel, xpIntoCurrentLevel } from "@/lib/gamification/xp";
import { cn } from "@/lib/utils";

type ProfileViewProps = {
  initialData: ProfilePageData;
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

async function readProfilePayload(response: Response) {
  return response.json().catch(() => null) as Promise<{
    profile?: ProfileSummary;
    message?: string;
  } | null>;
}

async function readNotificationPayload(response: Response) {
  return response.json().catch(() => null) as Promise<{
    saved?: boolean;
    message?: string;
  } | null>;
}

export function ProfileView({ initialData, providers, signedIn }: ProfileViewProps) {
  const [profile, setProfile] = useState(initialData.profile);
  const [notifications, setNotifications] = useState(initialData.notifications);
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialData.notificationsEnabled);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [liveStatusSharingEnabled, setLiveStatusSharingEnabled] = useState(initialData.liveStatusSharingEnabled);
  const [isUpdatingLiveSharing, setIsUpdatingLiveSharing] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(initialData.profile?.displayName ?? "");
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(initialData.profile?.avatarUrl ?? "");
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const liveStatusSharingSupported = initialData.liveStatusSharingSupported;
  const notificationsReady = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const earnedBadgeIds = useMemo(
    () => new Set(initialData.earnedBadges.map((badge) => badge.badgeId)),
    [initialData.earnedBadges]
  );

  if (!signedIn || !profile) {
    return (
      <EmptyState
        eyebrow="Profile preview"
        title="Sign in to sync your progress."
        description="Keep your streak, badges, settings, and recent activity tied to one FastTrack profile across devices."
        actions={
          <>
            <SignInDialog
              buttonClassName="w-full sm:w-auto"
              buttonLabel="Sign in to sync your progress"
              providers={providers}
              size="lg"
            />
            <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
              Go to dashboard
            </Link>
          </>
        }
        preview={
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Current streak", value: "5 days", tone: "text-success" },
              { label: "Badge cabinet", value: "12 badges", tone: "text-gold" },
              { label: "Level progress", value: "Level 4", tone: "text-primary" },
            ].map((item) => (
              <div key={item.label} className="premium-chip rounded-[1.25rem] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                <p className={cn("mt-3 font-[family:var(--font-heading)] text-2xl font-semibold", item.tone)}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        }
      />
    );
  }

  const currentProfile = profile;
  const currentLevelXp = xpIntoCurrentLevel(currentProfile.xp);
  const nextLevelXp = xpForNextLevel(currentProfile.level);
  const progress = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));
  const normalizedDisplayName = displayNameDraft.trim();
  const normalizedAvatarUrl = avatarUrlDraft.trim();
  const identityChanged =
    normalizedDisplayName !== (currentProfile.displayName ?? "") ||
    normalizedAvatarUrl !== (currentProfile.avatarUrl ?? "");
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  async function toggleNotifications() {
    setIsTogglingNotifications(true);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported in this browser.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");

      if (notificationsEnabled) {
        const subscription = await registration.pushManager?.getSubscription();
        await subscription?.unsubscribe();

        const response = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: false,
          }),
        });
        const payload = await readNotificationPayload(response);

        if (!response.ok || payload?.saved === false) {
          throw new Error(payload?.message ?? "Unable to turn notifications off.");
        }

        setNotificationsEnabled(false);
        toast.success("Notifications off.");
        return;
      }

      if (!("Notification" in window)) {
        throw new Error("Notifications are not supported in this browser.");
      }

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

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: !notificationsEnabled,
          subscription: subscriptionPayload,
        }),
      });
      const payload = await readNotificationPayload(response);

      if (!response.ok || payload?.saved === false) {
        throw new Error(payload?.message ?? "Unable to save notification settings.");
      }

      await registration.showNotification("FastTrack notifications enabled", {
        body: "You’ll see alerts here when streaks, badges, and milestones fire.",
        icon: "/favicon.ico",
      });

      setNotificationsEnabled(true);
      toast.success("Notifications enabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update notifications.");
    } finally {
      setIsTogglingNotifications(false);
    }
  }

  async function toggleLiveSharing() {
    setIsUpdatingLiveSharing(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareLiveStatus: !liveStatusSharingEnabled,
        }),
      });

      const payload = await readProfilePayload(response);

      if (!response.ok || !payload?.profile) {
        throw new Error(payload?.message ?? "Unable to update live status sharing.");
      }

      setLiveStatusSharingEnabled((current) => !current);
      setProfile(payload.profile);
      toast.success(!liveStatusSharingEnabled ? "Live fasting sharing enabled." : "Live fasting sharing hidden.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update live sharing.");
    } finally {
      setIsUpdatingLiveSharing(false);
    }
  }

  async function saveIdentity() {
    if (!normalizedDisplayName || normalizedDisplayName.length < 2) {
      toast.error("Use at least 2 characters for your display name.");
      return;
    }

    setIsSavingIdentity(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: normalizedDisplayName,
        }),
      });

      const payload = await readProfilePayload(response);

      if (!response.ok || !payload?.profile) {
        throw new Error(payload?.message ?? "Unable to update your profile.");
      }

      setProfile(payload.profile);
      setDisplayNameDraft(payload.profile.displayName ?? "");
      setAvatarUrlDraft(payload.profile.avatarUrl ?? "");
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your profile.");
    } finally {
      setIsSavingIdentity(false);
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for your avatar.");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = await readProfilePayload(response);

      if (!response.ok || !payload?.profile) {
        throw new Error(payload?.message ?? "Unable to upload avatar.");
      }

      setProfile(payload.profile);
      setAvatarUrlDraft(payload.profile.avatarUrl ?? "");
      toast.success("Avatar uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload avatar.");
    } finally {
      setIsUploadingAvatar(false);

      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  }

  function resetIdentityDrafts() {
    setDisplayNameDraft(currentProfile.displayName ?? "");
    setAvatarUrlDraft(currentProfile.avatarUrl ?? "");
  }

  async function markNotificationRead(notificationId: string) {
    const currentNotification = notifications.find((notification) => notification.id === notificationId);

    if (!currentNotification || currentNotification.readAt) {
      return;
    }

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, readAt } : notification
      )
    );

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to mark notification read.");
      }
    } catch (error) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, readAt: currentNotification.readAt } : notification
        )
      );
      toast.error(error instanceof Error ? error.message : "Unable to update notification.");
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                <AvatarImage src={normalizedAvatarUrl || undefined} alt={normalizedDisplayName || "Profile"} />
                <AvatarFallback>{getInitials(normalizedDisplayName || currentProfile.displayName)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{normalizedDisplayName || currentProfile.displayName || "FastTrack user"}</CardTitle>
                <CardDescription>Level {currentProfile.level} • {currentProfile.xp} XP earned</CardDescription>
              </div>
            </div>
            <Button
              className="rounded-2xl"
              disabled={isTogglingNotifications || !notificationsReady}
              onClick={() => void toggleNotifications()}
              variant={notificationsEnabled ? "secondary" : "outline"}
            >
              {notificationsEnabled ? <Bell className="mr-2 size-4" /> : <BellOff className="mr-2 size-4" />}
              {notificationsReady
                ? notificationsEnabled
                  ? "Notifications on"
                  : "Enable notifications"
                : "Notifications unavailable"}
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
              <Trophy className="mr-2 size-4" />
              View leaderboard
            </Link>
            <Button
              className="rounded-2xl"
              disabled={isUpdatingLiveSharing || !liveStatusSharingSupported}
              onClick={() => void toggleLiveSharing()}
              variant={liveStatusSharingEnabled ? "secondary" : "outline"}
            >
              {liveStatusSharingEnabled ? <Eye className="mr-2 size-4" /> : <EyeOff className="mr-2 size-4" />}
              {liveStatusSharingSupported
                ? liveStatusSharingEnabled
                  ? "Sharing live fasting"
                  : "Live fasting hidden"
                : "Live sharing unavailable"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="glass-soft rounded-[1.5rem] p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr] lg:items-start">
              <div>
                <p className="text-sm font-medium text-foreground">Profile identity</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose the name and avatar friends see on live fasting boards, challenges, and leaderboards.
                </p>
              </div>
              <div className="grid gap-3">
                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <UserRound className="size-3.5" />
                    Display name
                  </span>
                  <Input
                    maxLength={40}
                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                    placeholder="Your FastTrack name"
                    value={displayNameDraft}
                  />
                </label>
                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <ImageIcon className="size-3.5" />
                    Avatar image
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      inputMode="url"
                      placeholder="Upload an avatar"
                      readOnly
                      value={avatarUrlDraft}
                    />
                    <input
                      ref={avatarInputRef}
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => void uploadAvatar(event.target.files?.[0])}
                      type="file"
                    />
                    <Button
                      className="rounded-2xl sm:w-auto"
                      disabled={isUploadingAvatar || isSavingIdentity}
                      onClick={() => avatarInputRef.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      <Upload className="mr-2 size-4" />
                      {isUploadingAvatar ? "Uploading" : "Upload"}
                    </Button>
                  </div>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="rounded-2xl"
                    disabled={!identityChanged || isSavingIdentity}
                    onClick={() => void saveIdentity()}
                  >
                    <Save className="mr-2 size-4" />
                    Save profile
                  </Button>
                  <Button
                    className="rounded-2xl"
                    disabled={!identityChanged || isSavingIdentity}
                    onClick={resetIdentityDrafts}
                    variant="outline"
                  >
                    <RotateCcw className="mr-2 size-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {!notificationsReady ? (
            <div className="premium-rail rounded-[1.25rem] px-4 py-4 text-sm text-muted-foreground">
              Push notifications are not configured for this environment yet. Your saved progress and account data still work normally.
            </div>
          ) : null}
          <div className="premium-rail rounded-[1.25rem] px-4 py-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Live fasting visibility</p>
            <p className="mt-2 leading-6">
              {!liveStatusSharingSupported
                ? "Live in-progress sharing is not configured for this environment yet."
                : liveStatusSharingEnabled
                ? "Accepted friends can see when you are currently fasting, how long you have been in the window, and your planned end time."
                : "Accepted friends will not see your in-progress fasting window. Completed sessions and other feed updates still work as usual."}
            </p>
          </div>
          <div className="glass-soft rounded-[1.5rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Level progress</p>
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
                  { label: "Total fasts", value: currentProfile.totalFasts.toString() },
                  { label: "Total hours", value: currentProfile.totalFastHours.toString() },
                  { label: "Highest checkpoint", value: `${currentProfile.highestStageReached}h` },
                  { label: "Friends", value: currentProfile.friendCount.toString() },
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>Encouragements and circle challenge updates stay here.</CardDescription>
            </div>
            {unreadCount ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                {unreadCount} new
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length ? (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "glass-soft flex flex-col gap-3 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                  !notification.readAt && "border-primary/25 bg-primary/[0.08]"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{notification.title}</p>
                    {!notification.readAt ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-2xl")}
                    href={notification.href}
                    onClick={() => void markNotificationRead(notification.id)}
                  >
                    Open
                  </Link>
                  {!notification.readAt ? (
                    <Button
                      className="rounded-2xl"
                      onClick={() => void markNotificationRead(notification.id)}
                      size="sm"
                      variant="secondary"
                    >
                      <Check className="mr-1.5 size-3.5" />
                      Read
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center text-sm text-muted-foreground">
              Encouragements and circle invites will appear here.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Badge cabinet</CardTitle>
          <CardDescription>Badges focus on steady habits, streaks, and showing up for your plan.</CardDescription>
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
                  {earned ? badge.description : "Keep showing up for your planned windows to uncover this badge."}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="section-enter" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest milestones, badges, and account progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialData.recentActivity.length ? (
            initialData.recentActivity.map((event) => (
              <div
                key={event.id}
                className="glass-soft flex gap-3 rounded-[1.5rem] px-4 py-4"
              >
                <Avatar size="sm">
                  <AvatarImage src={currentProfile.avatarUrl ?? undefined} alt={currentProfile.displayName ?? "Profile"} />
                  <AvatarFallback>{getInitials(currentProfile.displayName)}</AvatarFallback>
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
              Complete a session or connect with friends and your recent activity will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
