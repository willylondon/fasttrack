import { NextResponse } from "next/server";

import { getErrorMessage, getErrorStatus, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, markAppNotificationRead } from "@/lib/fasting-data";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const { notificationId } = await params;
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await markAppNotificationRead(userId, notificationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update notification.");

    return jsonMessage(message, getErrorStatus(message));
  }
}
