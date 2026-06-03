import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { createChallenge, getChallengesListData, getCurrentUserId } from "@/lib/fasting-data";

const createChallengeSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(80),
  description: z.string().max(300).optional(),
  challengeType: z.enum(["streak_days", "total_hours", "daily_fast", "milestone_reach"]),
  targetValue: z.number().int().min(1, "Target must be at least 1."),
  durationDays: z.number().int().min(1).max(90),
  visibility: z.enum(["circle", "public"]).default("circle"),
});

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const challenges = await getChallengesListData(userId);

    return NextResponse.json(challenges);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load challenges."), 500);
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = createChallengeSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error, "Invalid challenge."), 400);
  }

  try {
    const challengeId = await createChallenge(userId, parsed.data);

    return NextResponse.json({ challengeId });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to create challenge."), 500);
  }
}
