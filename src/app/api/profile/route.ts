import { NextResponse } from "next/server";

import { getCurrentUserId, getProfilePageData } from "@/lib/fasting-data";

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfilePageData(userId);

  return NextResponse.json(profile);
}
