import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId, recordMilestone, updateFast, updateFastStartTime } from "@/lib/fasting-data";

const updateFastSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("complete"),
    notes: z.string().max(600).optional().nullable(),
  }),
  z.object({
    action: z.literal("cancel"),
    notes: z.string().max(600).optional().nullable(),
  }),
  z.object({
    action: z.literal("milestone"),
    stageIndex: z.number().int().min(1).max(13),
  }),
  z.object({
    action: z.literal("edit_start"),
    startedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid start time."),
  }),
]);

type RouteContext = {
  params: {
    sessionId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = updateFastSchema.parse(await request.json());

  if (payload.action === "milestone") {
    const stage = await recordMilestone(userId, params.sessionId, payload.stageIndex);

    return NextResponse.json({ stage });
  }

  if (payload.action === "edit_start") {
    const session = await updateFastStartTime(userId, params.sessionId, payload.startedAt);

    return NextResponse.json({ session });
  }

  const result = await updateFast(userId, params.sessionId, payload.action, payload.notes);

  return NextResponse.json(result);
}
