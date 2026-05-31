import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_PATHS = new Set(["/"]);

export default auth((request) => {
  const { nextUrl } = request;

  if (PUBLIC_PATHS.has(nextUrl.pathname) || request.auth) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/", nextUrl);
  signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);

  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|opengraph-image|sw.js|offline.html|icon-.*\\.png|apple-touch-icon\\.png|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)$).*)",
  ],
};
