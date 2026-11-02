import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteAccount, type AccountDeletionClient } from "@/lib/account-deletion";
import { getZodMessage, jsonMessage, rateLimitedResponse, readJsonBody } from "@/lib/api-responses";
import { getCurrentUserId } from "@/lib/fasting-data";
import { createAdminClient } from "@/lib/supabase/admin";

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", "Type DELETE to confirm."),
});

export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`account:delete:${userId}`, 5, 10 * 60_000);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = deleteAccountSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    await deleteAccount(createAdminClient() as unknown as AccountDeletionClient, userId);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return jsonMessage("Unable to delete your account. Please try again.", 500);
  }
}
