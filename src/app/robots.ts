import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fasttracker.online";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/history", "/friends", "/profile", "/leaderboard", "/feed", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
