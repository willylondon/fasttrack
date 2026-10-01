"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

async function readNotificationPayload(response: Response) {
  return response.json().catch(() => null) as Promise<{
    saved?: boolean;
    message?: string;
  } | null>;
}

export function PushNotificationControl({ initialEnabled }: { initialEnabled: boolean | null }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialEnabled);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const notificationsReady = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
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

  if (notificationsEnabled === null) return <Button disabled variant="outline" className="rounded-2xl">Notification settings unavailable</Button>;
  return (
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
  );
}
