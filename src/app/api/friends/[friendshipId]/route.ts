import { NextResponse } from "next/server";
import { z } from "zod";

import { cancelOutgoingFriendRequest, getCurrentUserId, respondToFriendRequest } from "@/lib/fasting-data";

const respondFriendSchema = z.object({
  action: z.enum(["accepted", "rejected", "cancel"]),
});

type RouteContext = {
  params: {
    friendshipId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = respondFriendSchema.parse(await request.json());

  if (payload.action === "cancel") {
    const friendshipId = await cancelOutgoingFriendRequest(userId, params.friendshipId);

    return NextResponse.json({ friendshipId });
  }

  const friendshipId = await respondToFriendRequest(userId, params.friendshipId, payload.action);

  return NextResponse.json({ friendshipId });
}
