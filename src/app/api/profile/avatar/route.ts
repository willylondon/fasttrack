import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

import { getErrorMessage, jsonMessage, rateLimitedResponse } from "@/lib/api-responses";
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

function matchesImageSignature(bytes: Uint8Array, type: string) {
  const startsWith = (signature: number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value);

  switch (type) {
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return startsWith([0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`profile:avatar:${userId}`, 5, 10 * 60_000);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds, "Too many avatar uploads. Try again later.");
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

    const bytes = await file.arrayBuffer();

    if (!matchesImageSignature(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 12)), file.type)) {
      return jsonMessage("That file does not look like a valid image.", 400);
    }

    const supabase = createAdminClient();
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
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

    // Remove superseded avatars only after the new one is saved, so a failed upload never breaks the profile image.
    try {
      const { data: existingFiles, error: listError } = await supabase
        .storage
        .from(AVATAR_BUCKET)
        .list(userId);

      if (!listError && existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles
          .filter((f) => f.name.startsWith("avatar-") && `${userId}/${f.name}` !== path)
          .map((f) => `${userId}/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage.from(AVATAR_BUCKET).remove(filesToDelete);
        }
      }
    } catch (cleanupError) {
      console.error("Failed to clean up old avatars:", cleanupError);
    }

    return NextResponse.json({ avatarUrl, profile });
  } catch (error) {
    return jsonMessage(getErrorMessage(error, "Unable to upload avatar."), 400);
  }
}
