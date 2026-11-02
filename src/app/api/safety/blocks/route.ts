import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getZodMessage, jsonMessage, rateLimitedResponse, readJsonBody } from "@/lib/api-responses";
import { getCurrentUserId } from "@/lib/fasting-data";
import { blockMember, unblockMember } from "@/lib/user-safety";

const blockSchema = z.object({
  targetUserId: z.string().uuid("Choose a valid FastTrack member."),
});

async function handle(request: Request, action: typeof blockMember, result: Record<string, boolean>, fallback: string) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`safety:blocks:${userId}`, 30, 10 * 60_000);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = blockSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    await action(userId, parsed.data.targetUserId);

    return NextResponse.json(result);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, fallback), 400);
  }
}

export function POST(request: Request) {
  return handle(request, blockMember, { blocked: true }, "Unable to block this member.");
}

export function DELETE(request: Request) {
  return handle(request, unblockMember, { unblocked: true }, "Unable to unblock this member.");
}
