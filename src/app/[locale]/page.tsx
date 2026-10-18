import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { attachCardData, topFacets } from "@/lib/data";
import MemberCard from "@/components/MemberCard";
import TagLink from "@/components/TagLink";
import { alternates, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: { absolute: t("title") }, description: t("description"), alternates: alternates(locale, "/") };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const supabase = await createClient();
  const [{ data: latest, count }, facets] = await Promise.all([
    supabase.from("members")
      .select("id,slug,full_name,headline,avatar_url,current_country,location:tags!members_location_tag_id_fkey(name,slug)", { count: "exact" })
      .eq("status", "verified").eq("public_profile", true).order("created_at", { ascending: false }).limit(4),
    topFacets(supabase, 12),
  ]);
  const members = await attachCardData(supabase, (latest ?? []) as any[]);
  const steps = ["profile", "discover", "connect"] as const;

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
        "@context": "https://schema.org", "@type": "WebSite", name: "Alumni Connect", url: `${siteUrl}/${locale}`,
        potentialAction: { "@type": "SearchAction", target: `${siteUrl}/${locale}/directory?q={q}`, "query-input": "required name=q" },
      })} />
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">{t("heroTitle")}</h1>
        <p className="mt-3 max-w-2xl text-base text-brand-100 sm:text-lg">{t("heroText")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="btn bg-white text-brand-700 no-underline hover:bg-brand-50">{t("join")}</Link>
          <Link href="/directory" className="btn border border-white/60 text-white no-underline hover:bg-white/10">{t("browse")}</Link>
        </div>
        {!!count && <p className="mt-4 text-sm text-brand-100">{t("memberCount", { count })}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s} className="card">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{i + 1}</div>
            <h2 className="font-semibold">{t(`${s}Title`)}</h2>
            <p className="mt-1 text-sm text-slate-600">{t(`${s}Text`)}</p>
          </div>
        ))}
      </section>

      {(["expertise", "help", "school"] as const).map((k) => facets[k]?.length ? (
        <section key={k}>
          <h2 className="mb-3 text-lg font-semibold">{t(`popular_${k}`)}</h2>
          <div className="flex flex-wrap gap-2">{facets[k]!.map((f) => <TagLink key={f.slug} kind={k} tag={f} count={f.member_count} />)}</div>
        </section>
      ) : null)}

      {members.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{t("latest")}</h2>
            <Link href="/directory" className="text-sm font-medium">{t("seeAll")} →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">{members.map((m) => <MemberCard key={m.id} m={m} />)}</div>
        </section>
      )}
    </div>
  );
}
