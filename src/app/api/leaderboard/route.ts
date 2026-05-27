import { NextResponse } from "next/server";

import { getCurrentUserId, getLeaderboardData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();
  const leaderboard = await getLeaderboardData(userId);

  return NextResponse.json(leaderboard);
}
