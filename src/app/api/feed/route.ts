import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, getFeedPageData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const feed = await getFeedPageData(userId);

    return NextResponse.json(feed);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load feed."), 500);
  }
}
