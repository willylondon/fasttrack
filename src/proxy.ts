import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_PATHS = new Set([
  "/",
  "/history",
  "/feed",
  "/friends",
  "/leaderboard",
  "/profile",
  "/challenges",
  "/privacy",
  "/terms",
]);

export default auth((request) => {
  const { nextUrl } = request;
  const isPublicChallengePath = nextUrl.pathname.startsWith("/challenges/");

  if (PUBLIC_PATHS.has(nextUrl.pathname) || isPublicChallengePath || request.auth) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/", nextUrl);
  signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);

  return NextResponse.redirect(signInUrl);
});

// Prefetch headers are untrusted performance hints, never authentication. Only
// known public page routes may skip the proxy during background prefetch. Those
// pages still call auth() before loading account data; APIs keep their own guards.
// Normal navigations retain the Auth.js wrapper and its session-cookie renewal.
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|opengraph-image|sw.js|offline.html|icon-.*\\.png|apple-touch-icon\\.png|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // Server Action POSTs are never background prefetches. Preserve the existing
    // wrapper/renewal when next-action and prefetch headers appear together.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|opengraph-image|sw.js|offline.html|icon-.*\\.png|apple-touch-icon\\.png|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)$).*)",
      has: [{ type: "header", key: "next-action" }],
    },
    // Catch unknown/protected paths even when a client spoofs prefetch headers.
    // Keep this exact public allowlist in sync with the independently guarded pages.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|opengraph-image|sw.js|offline.html|icon-.*\\.png|apple-touch-icon\\.png|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)$|(?:history|feed|friends|leaderboard|profile|privacy|terms|challenges)/?$|challenges/[^/]+/?$|$).*)",
  ],
};
