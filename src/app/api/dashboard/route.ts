import { NextResponse } from "next/server";

import { getCurrentUserId, getDashboardData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await getDashboardData(userId);

  return NextResponse.json(dashboard);
}
