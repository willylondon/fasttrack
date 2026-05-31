import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, getLeaderboardData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const leaderboard = await getLeaderboardData(userId);

    return NextResponse.json(leaderboard);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load leaderboard."), 500);
  }
}
