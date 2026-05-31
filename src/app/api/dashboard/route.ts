import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, getDashboardData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const dashboard = await getDashboardData(userId);

    return NextResponse.json(dashboard);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load dashboard."), 500);
  }
}
