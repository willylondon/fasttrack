import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId, startFast } from "@/lib/fasting-data";

const startFastSchema = z.object({
  plannedMinutes: z.number().int().min(12 * 60).max(48 * 60),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = startFastSchema.parse(await request.json());
  const session = await startFast(userId, payload.plannedMinutes);

  return NextResponse.json({ session });
}
