import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { MIN_INDEXABLE_MEMBERS } from "@/lib/seo";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const entry = (path: string, lastModified?: string | Date, priority = 0.6): MetadataRoute.Sitemap =>
  routing.locales.map((l) => ({
    url: `${siteUrl}/${l}${path === "/" ? "" : path}`,
    lastModified,
    priority,
    alternates: { languages: Object.fromEntries(routing.locales.map((x) => [x, `${siteUrl}/${x}${path === "/" ? "" : path}`])) },
  }));

/** Public profiles + tag pages with enough members. Private/unverified profiles are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let out: MetadataRoute.Sitemap = [...entry("/", undefined, 1), ...entry("/directory", undefined, 0.8)];
  try {
    const supabase = await createClient();
    const [members, tags] = await Promise.all([
      supabase.from("members").select("slug,updated_at").eq("status", "verified").eq("public_profile", true).limit(5000),
      supabase.from("tag_stats").select("kind,slug,member_count").gte("member_count", MIN_INDEXABLE_MEMBERS).limit(5000),
    ]);
    for (const m of members.data ?? []) out = out.concat(entry(`/m/${m.slug}`, m.updated_at, 0.7));
    for (const t of tags.data ?? []) out = out.concat(entry(`/${t.kind}/${t.slug}`, undefined, 0.5));
  } catch {
    /* serve the static entries if the database is unreachable */
  }
  return out;
}
