import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage } from "@/lib/api-responses";
import { getCurrentUserId, updateProfileSettings } from "@/lib/fasting-data";
import { createAdminClient } from "@/lib/supabase/admin";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return jsonMessage("Choose an image to upload.", 400);
    }

    const extension = ALLOWED_AVATAR_TYPES.get(file.type);

    if (!extension) {
      return jsonMessage("Avatar must be a JPG, PNG, WebP, or GIF image.", 400);
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return jsonMessage("Avatar image must be 2 MB or smaller.", 400);
    }

    const supabase = createAdminClient();

    // Clean up previous avatars to prevent storage leak
    try {
      const { data: existingFiles, error: listError } = await supabase
        .storage
        .from(AVATAR_BUCKET)
        .list(userId);

      if (!listError && existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles
          .filter((f) => f.name.startsWith("avatar-"))
          .map((f) => `${userId}/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage.from(AVATAR_BUCKET).remove(filesToDelete);
        }
      }
    } catch (cleanupError) {
      console.error("Failed to clean up old avatars:", cleanupError);
    }

    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const bytes = await file.arrayBuffer();
    const uploadResult = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const publicUrlResult = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const avatarUrl = publicUrlResult.data.publicUrl;
    const profile = await updateProfileSettings(userId, { avatarUrl });

    return NextResponse.json({ avatarUrl, profile });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to upload avatar."), 400);
  }
}
