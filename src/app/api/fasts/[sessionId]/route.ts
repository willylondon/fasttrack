import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getErrorStatus, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
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
  params: Promise<{
    sessionId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await getCurrentUserId();
  const { sessionId } = await params;

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = updateFastSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  const payload = parsed.data;

  try {
    if (payload.action === "milestone") {
      const stage = await recordMilestone(userId, sessionId, payload.stageIndex);

      return NextResponse.json({ stage });
    }

    if (payload.action === "edit_start") {
      const session = await updateFastStartTime(userId, sessionId, payload.startedAt);

      return NextResponse.json({ session });
    }

    const result = await updateFast(userId, sessionId, payload.action, payload.notes);

    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update fast.");
    return jsonMessage(message, getErrorStatus(message));
  }
}
