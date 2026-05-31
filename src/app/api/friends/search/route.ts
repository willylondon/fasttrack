import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, searchProfiles } from "@/lib/fasting-data";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (query.trim().length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchProfiles(userId, query);

    return NextResponse.json({ results });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to search profiles."), 500);
  }
}
