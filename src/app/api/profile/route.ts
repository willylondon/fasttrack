import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getZodMessage, jsonMessage, readJsonBody } from "@/lib/api-responses";
import { getCurrentUserId, getProfilePageData, updateProfileSettings } from "@/lib/fasting-data";

const updateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(40, "Display name must be 40 characters or fewer.")
    .optional(),
  avatarUrl: z
    .union([
      z.string().trim().url("Avatar must be a valid image URL.").max(500, "Avatar URL is too long."),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  shareLiveStatus: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "Include at least one profile field to update.",
});

function isTrustedAvatarUrl(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return false;
  }

  try {
    const avatarUrl = new URL(value);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);

    return (
      avatarUrl.origin === supabaseUrl.origin &&
      avatarUrl.pathname.includes("/storage/v1/object/public/avatars/")
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getProfilePageData(userId);

    return NextResponse.json(profile);
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to load profile."), 500);
  }
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (body.error) {
    return jsonMessage(body.error, 400);
  }

  const payload = updateSchema.safeParse(body.data);

  if (!payload.success) {
    return jsonMessage(getZodMessage(payload.error, "Invalid profile update."), 400);
  }

  if ("avatarUrl" in payload.data && !isTrustedAvatarUrl(payload.data.avatarUrl ?? null)) {
    return jsonMessage("Upload an avatar image instead of linking to an external image URL.", 400);
  }

  try {
    const profile = await updateProfileSettings(userId, payload.data);

    return NextResponse.json({ profile });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update profile.");

    if (message.includes("share_live_status")) {
      return jsonMessage("Live status sharing is not configured for this environment yet.", 400);
    }

    return jsonMessage(message, 400);
  }
}
