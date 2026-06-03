import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { getCurrentUserId, upsertDailyCheckIn } from "@/lib/fasting-data";

const ratingSchema = z.number().int().min(1).max(5);

const checkInSchema = z.object({
  sessionId: z.string().uuid("Choose a completed fast."),
  energy: ratingSchema,
  mood: ratingSchema,
  hunger: ratingSchema,
  sleepQuality: ratingSchema,
  note: z.string().max(240, "Notes must be 240 characters or fewer.").optional().nullable(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = checkInSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error, "Invalid check-in."), 400);
  }

  try {
    const checkIn = await upsertDailyCheckIn(userId, parsed.data);

    return NextResponse.json({ checkIn });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to save check-in."), 400);
  }
}
