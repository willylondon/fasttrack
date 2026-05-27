import { NextResponse } from "next/server";

import { getCurrentUserId, getHistoryData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const history = await getHistoryData(userId);

  return NextResponse.json(history);
}
