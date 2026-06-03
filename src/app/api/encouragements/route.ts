import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getErrorStatus, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { createEncouragementComment, getCurrentUserId, getEncouragementComments } from "@/lib/fasting-data";

const encouragementSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a short encouragement first.").max(180, "Keep encouragements to 180 characters or fewer."),
});

export async function GET(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const recipientId = new URL(request.url).searchParams.get("recipientId");
  const parsed = z.string().uuid().safeParse(recipientId);

  if (!parsed.success) {
    return jsonMessage("Choose a valid leaderboard member.", 400);
  }

  try {
    const comments = await getEncouragementComments(userId, parsed.data);

    return NextResponse.json({ comments });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load encouragements.");
    return jsonMessage(message, getErrorStatus(message));
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

  const parsed = encouragementSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    const comment = await createEncouragementComment(userId, parsed.data);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to send encouragement.");
    return jsonMessage(message, getErrorStatus(message));
  }
}
