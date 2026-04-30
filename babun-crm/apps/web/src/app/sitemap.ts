import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://babun.app/",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://babun.app/register",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: "https://babun.app/login",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: "https://babun.app/privacy",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://babun.app/terms",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
