import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams, searchMembers } from "@/lib/data";
import { isTagKind } from "@/lib/tags";
import { MIN_INDEXABLE_MEMBERS, alternates, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import Results from "@/components/Results";

type Props = {
  params: Promise<{ locale: string; kind: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(kind: string, slug: string, page: number) {
  if (!isTagKind(kind)) return null;
  const supabase = await createClient();
  const res = await searchMembers(supabase, { filters: { [kind]: slug }, q: "", page });
  const tag = res.tags[0];
  return tag ? { tag, res } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, kind, slug } = await params;
  const { page } = parseSearchParams(await searchParams);
  const data = await load(kind, slug, page);
  if (!data) return { robots: { index: false } };
  const t = await getTranslations({ locale, namespace: "tagPage" });
  const tk = await getTranslations({ locale, namespace: "kinds" });
  const title = t(`title_${data.tag.kind}`, { name: data.tag.name });
  return {
    title,
    description: t("description", { name: data.tag.name, kind: tk(data.tag.kind).toLowerCase(), count: data.res.total }),
    robots: data.res.total < MIN_INDEXABLE_MEMBERS ? { index: false, follow: true } : undefined,
    alternates: alternates(locale, `/${kind}/${slug}`),
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { locale, kind, slug } = await params;
  const { page } = parseSearchParams(await searchParams);
  const data = await load(kind, slug, page);
  if (!data) notFound();
  const { tag, res } = data;
  const t = await getTranslations({ locale, namespace: "tagPage" });
  const tk = await getTranslations({ locale, namespace: "kinds" });

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: t(`title_${tag.kind}`, { name: tag.name }), url: `${siteUrl}/${locale}/${kind}/${slug}`,
        mainEntity: { "@type": "ItemList", itemListElement: res.members.map((m, i) => ({
          "@type": "ListItem", position: i + 1, url: `${siteUrl}/${locale}/m/${m.slug}`, name: m.full_name })) },
      })} />
      <nav className="mb-2 text-sm text-slate-500">
        <Link href="/directory" className="text-slate-500">{t("directory")}</Link> / {tk(tag.kind)}
      </nav>
      <h1 className="text-2xl font-bold">{t(`title_${tag.kind}`, { name: tag.name })}</h1>
      <p className="mb-5 mt-1 text-slate-600">{t("lead", { name: tag.name })}</p>
      <div className="mb-5">
        <Link href={`/directory?${tag.kind}=${tag.slug}`} className="btn-secondary no-underline">{t("refine")}</Link>
      </div>
      <Results members={res.members} total={res.total} page={page} pageSize={res.pageSize}
        href={(p) => `/${kind}/${slug}${p > 1 ? `?page=${p}` : ""}`} />
    </div>
  );
}
