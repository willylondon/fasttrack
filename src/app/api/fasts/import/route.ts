import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getErrorStatus, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import {
  MAX_PUBLIC_FAST_MINUTES,
  MIN_PUBLIC_FAST_MINUTES,
  validateFastEndTimestamp,
} from "@/lib/fasting";
import { getCurrentUserId, importLocalFastHistory } from "@/lib/fasting-data";
import { checkRateLimit } from "@/lib/rate-limit";

const importedSessionSchema = z.object({
  sourceId: z.string().trim().min(1).max(128),
  startedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid start time."),
  endedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid end time."),
  plannedMinutes: z.number().int().min(MIN_PUBLIC_FAST_MINUTES).max(MAX_PUBLIC_FAST_MINUTES),
  notes: z.string().max(600).optional().nullable(),
});

const importSchema = z.object({
  sessions: z
    .array(importedSessionSchema)
    .max(250, "Sync up to 250 local fasts at a time.")
    .refine(
      (sessions) => new Set(sessions.map((session) => session.sourceId)).size === sessions.length,
      "Local fast identifiers must be unique."
    ),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`fasts:import:${userId}`, 5, 10 * 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many history sync attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = importSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  for (const session of parsed.data.sessions) {
    const validation = validateFastEndTimestamp(session.startedAt, session.endedAt);

    if (!validation.valid) {
      return jsonMessage(validation.message, 400);
    }

    if (validation.durationMinutes > 31 * 24 * 60) {
      return jsonMessage("A synced fast cannot be longer than 31 days.", 400);
    }
  }

  try {
    const result = await importLocalFastHistory(userId, parsed.data.sessions);
    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error, "Unable to sync local fasting history.");
    return jsonMessage(message, getErrorStatus(message));
  }
}
