import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getChallengeDetail, getCurrentUserId } from "@/lib/fasting-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  try {
    const challenge = await getChallengeDetail(id, userId);

    if (!challenge) {
      return jsonMessage("Challenge not found.", 404);
    }

    return NextResponse.json(challenge);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load challenge."), 500);
  }
}
