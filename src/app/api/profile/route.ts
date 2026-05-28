import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId, getProfilePageData, updateLiveStatusSharing } from "@/lib/fasting-data";

const updateSchema = z.object({
  shareLiveStatus: z.boolean(),
});

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfilePageData(userId);

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = updateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ message: "Invalid profile update." }, { status: 400 });
  }

  const profile = await updateLiveStatusSharing(userId, payload.data.shareLiveStatus);

  return NextResponse.json({ profile });
}
