import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitedResponse } from "@/lib/api-responses";
import { NextResponse } from "next/server";

import { getCurrentUserId, joinChallenge, leaveChallenge } from "@/lib/fasting-data";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`challenges:join:${userId}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  try {
    await joinChallenge(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to join challenge.";
    const status = message === "Challenge not found." ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`challenges:join:${userId}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  try {
    await leaveChallenge(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to leave challenge.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
