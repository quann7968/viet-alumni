import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/", "/*/admin", "/*/connections", "/*/profile/", "/*/login", "/*/verify", "/*/invite", "/*/join/", "/*/directory?"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
