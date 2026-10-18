import { siteUrl } from "@/lib/site";

/** canonical + hreflang alternates for a locale-less path like "/directory". */
export function alternates(locale: string, path: string) {
  const p = path === "/" ? "" : path;
  return {
    canonical: `${siteUrl}/${locale}${p}`,
    languages: { vi: `${siteUrl}/vi${p}`, en: `${siteUrl}/en${p}`, "x-default": `${siteUrl}/vi${p}` },
  };
}

/** Tag pages with fewer members than this are noindex to avoid thin content. */
export const MIN_INDEXABLE_MEMBERS = 3;

export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
