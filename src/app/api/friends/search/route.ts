import { NextResponse } from "next/server";

import { getCurrentUserId, searchProfiles } from "@/lib/fasting-data";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = await searchProfiles(userId, query);

  return NextResponse.json({ results });
}
