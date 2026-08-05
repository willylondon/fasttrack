import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getErrorStatus, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { MAX_PUBLIC_FAST_MINUTES, MIN_PUBLIC_FAST_MINUTES } from "@/lib/fasting";
import { getCurrentUserId, startFast } from "@/lib/fasting-data";
import { checkRateLimit } from "@/lib/rate-limit";

const startFastSchema = z.object({
  plannedMinutes: z
    .number()
    .int()
    .min(MIN_PUBLIC_FAST_MINUTES, "Choose a fasting window of at least 12 hours.")
    .max(MAX_PUBLIC_FAST_MINUTES, "FastTrack supports planned windows up to 24 hours."),
  startedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid start time.")
    .optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`fasts:start:${userId}`, 20, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many fasting updates. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = startFastSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    const session = await startFast(userId, parsed.data.plannedMinutes, parsed.data.startedAt);

    return NextResponse.json({ session });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to start fast.");
    return jsonMessage(message, getErrorStatus(message));
  }
}
