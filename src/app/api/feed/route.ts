import { NextResponse } from "next/server";

import { getCurrentUserId, getFeedPageData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const feed = await getFeedPageData(userId);

  return NextResponse.json(feed);
}
