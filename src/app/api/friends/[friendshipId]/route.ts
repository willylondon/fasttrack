import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getErrorStatus, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { cancelOutgoingFriendRequest, getCurrentUserId, respondToFriendRequest } from "@/lib/fasting-data";

const respondFriendSchema = z.object({
  action: z.enum(["accepted", "rejected", "cancel"]),
});

type RouteContext = {
  params: Promise<{
    friendshipId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await getCurrentUserId();
  const { friendshipId } = await params;

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = respondFriendSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    if (parsed.data.action === "cancel") {
      const updatedFriendshipId = await cancelOutgoingFriendRequest(userId, friendshipId);

      return NextResponse.json({ friendshipId: updatedFriendshipId });
    }

    const updatedFriendshipId = await respondToFriendRequest(userId, friendshipId, parsed.data.action);

    return NextResponse.json({ friendshipId: updatedFriendshipId });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update friend request.");
    return jsonMessage(message, getErrorStatus(message));
  }
}
