import { NextResponse } from "next/server";

import { buildAssetLinks } from "@/lib/asset-links";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    buildAssetLinks(process.env.ANDROID_PACKAGE_NAME, process.env.ANDROID_SHA256_CERT_FINGERPRINTS)
  );
}
