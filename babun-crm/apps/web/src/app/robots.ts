import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/onboarding", "/invite", "/api"],
      },
    ],
    sitemap: "https://babun.app/sitemap.xml",
    host: "https://babun.app",
  };
}
