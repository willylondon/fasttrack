"use server";

import "server-only";

import webPush from "web-push";

import type { SocialProfile } from "@/lib/fasting";
import { createAdminClient } from "@/lib/supabase/admin";

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      auth: string;
      p256dh: string;
    };
  };
};

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  url: string;
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) {
    return true;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_APP_URL;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function notifyEncouragementRecipient(
  recipientId: string,
  author: Pick<SocialProfile, "displayName"> | null
) {
  const authorName = author?.displayName?.trim() || "A friend";

  await sendPushToUser(recipientId, {
    title: "New encouragement",
    body: `${authorName} left you encouragement on FastTrack.`,
    icon: "/favicon.ico",
    url: "/friends",
  });
}

async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!configureVapid()) {
    return;
  }

  const supabase = createAdminClient();
  const subscriptionResult = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,subscription")
    .eq("user_id", userId);

  if (subscriptionResult.error) {
    console.error("Unable to load push subscriptions", subscriptionResult.error);
    return;
  }

  const subscriptions = (subscriptionResult.data ?? []) as StoredPushSubscription[];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(subscription.subscription, JSON.stringify(payload));
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          return;
        }

        console.error("Unable to send push notification", error);
      }
    })
  );
}
