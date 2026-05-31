import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getErrorStatus, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { createFriendRequest, getCurrentUserId, getFriendsPageData } from "@/lib/fasting-data";

const createFriendSchema = z.object({
  email: z.string().email(),
});

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const friends = await getFriendsPageData(userId);

    return NextResponse.json(friends);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load friends."), 500);
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

  const parsed = createFriendSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    const friendshipId = await createFriendRequest(userId, parsed.data.email);

    return NextResponse.json({ friendshipId });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to create friend request.");
    return jsonMessage(message, getErrorStatus(message));
  }
}
