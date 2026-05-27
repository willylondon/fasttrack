import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/fasting-data";
import { createAdminClient } from "@/lib/supabase/admin";

const subscribeSchema = z.object({
  enabled: z.boolean(),
  subscription: z
    .object({
      endpoint: z.string(),
      expirationTime: z.number().nullable().optional(),
      keys: z.record(z.string(), z.string()),
    })
    .nullable()
    .optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = subscribeSchema.parse(await request.json());
  const supabase = createAdminClient();

  if (!payload.enabled) {
    const deleteResult = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId);

    if (deleteResult.error && deleteResult.error.code !== "PGRST204") {
      return NextResponse.json({ saved: false }, { status: 200 });
    }

    return NextResponse.json({ saved: true, enabled: false });
  }

  if (!payload.subscription) {
    return NextResponse.json({ saved: true, enabled: true, subscriptionStored: false });
  }

  const upsertResult = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: payload.subscription.endpoint,
      subscription: payload.subscription,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,endpoint",
    }
  );

  if (upsertResult.error) {
    return NextResponse.json({ saved: false, enabled: true, subscriptionStored: false }, { status: 200 });
  }

  return NextResponse.json({ saved: true, enabled: true, subscriptionStored: true });
}
