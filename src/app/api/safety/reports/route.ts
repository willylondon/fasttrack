import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getZodMessage, jsonMessage, rateLimitedResponse, readJsonBody } from "@/lib/api-responses";
import { getCurrentUserId } from "@/lib/fasting-data";
import { createUserReport, REPORT_CONTENT_TYPES, REPORT_REASONS } from "@/lib/user-safety";

const reportSchema = z.object({
  reportedUserId: z.string().uuid("Choose a valid FastTrack member."),
  reason: z.enum(REPORT_REASONS, "Choose a reason for this report."),
  details: z.string().trim().max(500, "Keep details to 500 characters or fewer.").optional().nullable(),
  contentType: z.enum(REPORT_CONTENT_TYPES),
  contentId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`safety:reports:${userId}`, 10, 10 * 60_000);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds, "Too many reports. Try again later.");
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const parsed = reportSchema.safeParse(body.data);

  if (!parsed.success) {
    return jsonMessage(getZodMessage(parsed.error), 400);
  }

  try {
    await createUserReport({ reporterId: userId, ...parsed.data });

    return NextResponse.json({ reported: true });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to send this report."), 400);
  }
}
