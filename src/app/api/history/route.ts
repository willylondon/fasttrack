import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, getHistoryData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await getHistoryData(userId);

    return NextResponse.json(history);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load history."), 500);
  }
}
