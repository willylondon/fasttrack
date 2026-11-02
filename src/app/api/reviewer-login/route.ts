import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReviewerSession,
  reviewerSessionCookieName,
  verifyReviewerLogin,
  type ReviewerSessionClient,
} from "@/lib/reviewer-login";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new NextResponse(null, { status: 403 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!(await verifyReviewerLogin({ email, password, clientIp }))) {
    return redirectTo(request, "/reviewer-login?error=1");
  }

  try {
    const { sessionToken, expires } = await createReviewerSession(
      createAdminClient() as unknown as ReviewerSessionClient,
      email
    );
    const secure = request.nextUrl.protocol === "https:";
    const response = redirectTo(request, "/");

    response.cookies.set(reviewerSessionCookieName(secure), sessionToken, {
      expires,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure,
    });

    return response;
  } catch (error) {
    console.error("Reviewer login failed:", error instanceof Error ? error.message : "Unknown error");
    return redirectTo(request, "/reviewer-login?error=1");
  }
}
