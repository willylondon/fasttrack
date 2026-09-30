import { serverTimingHeaders } from "@/lib/server-timing";
import { NextResponse } from "next/server";
import { matchesExpectedAccount } from "@/lib/account-guard";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, getDashboardData } from "@/lib/fasting-data";

export async function GET(request: Request) {
  const authStarted = performance.now();
  const userId = await getCurrentUserId();
  const authMs = performance.now() - authStarted;

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const expectedAccountId = request.headers.get("X-FastTrack-Account");
  if (!matchesExpectedAccount(userId, expectedAccountId)) {
    return jsonMessage("Your signed-in account changed. Refresh the page to continue.", 409);
  }

  try {
    const dataStarted = performance.now();
    const dashboard = await getDashboardData(userId);

    return NextResponse.json(dashboard, { headers: serverTimingHeaders(authMs, performance.now() - dataStarted) });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load dashboard."), 500);
  }
}
