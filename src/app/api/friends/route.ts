import { NextResponse } from "next/server";
import { z } from "zod";

import { createFriendRequest, getCurrentUserId, getFriendsPageData } from "@/lib/fasting-data";

const createFriendSchema = z.object({
  email: z.string().email(),
});

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const friends = await getFriendsPageData(userId);

  return NextResponse.json(friends);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = createFriendSchema.parse(await request.json());
  const friendshipId = await createFriendRequest(userId, payload.email);

  return NextResponse.json({ friendshipId });
}
