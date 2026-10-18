import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildQuery, parseSearchParams, searchMembers, topFacets } from "@/lib/data";
import { TAG_KINDS } from "@/lib/tags";
import { alternates } from "@/lib/seo";
import Results from "@/components/Results";
import TagLink from "@/components/TagLink";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { filters, q, page } = parseSearchParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "directory" });
  const entries = Object.entries(filters);
  const filtered = entries.length > 0 || !!q || page > 1;
  return {
    title: t("title"),
    description: t("description"),
    // Filtered/combined URLs are noindex; a single-tag filter canonicalises to its tag page.
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates: entries.length === 1 && !q && page === 1
      ? alternates(locale, `/${entries[0][0]}/${entries[0][1]}`)
      : alternates(locale, "/directory"),
  };
}

export default async function Directory({ params, searchParams }: Props) {
  const { locale } = await params;
  const state = parseSearchParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "directory" });
  const tk = await getTranslations({ locale, namespace: "kinds" });
  const supabase = await createClient();
  const [res, facets] = await Promise.all([searchMembers(supabase, state), topFacets(supabase, 8)]);
  const active = res.tags;
  const href = (page: number) => `/directory${buildQuery(state, { page: page > 1 ? String(page) : null })}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4">
        <form action={`/${locale}/directory`} className="card space-y-3">
          {Object.entries(state.filters).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="label" htmlFor="q">{t("search")}</label>
          <input id="q" name="q" defaultValue={state.q} className="input" placeholder={t("searchHint")} type="search" />
          <button className="btn-primary w-full">{t("searchBtn")}</button>
        </form>

        <details className="card" open>
          <summary className="cursor-pointer font-semibold">{t("filters")}</summary>
          <div className="mt-3 space-y-4">
            {TAG_KINDS.map((k) => facets[k]?.length ? (
              <div key={k}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{tk(k)}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {facets[k]!.map((f) => (
                    <Link key={f.slug} href={`/directory${buildQuery(state, { [k]: f.slug, page: null })}`}
                      className={`chip border-slate-200 bg-white text-slate-700 ${state.filters[k] === f.slug ? "!border-brand-500 !bg-brand-50" : ""}`}>
                      {f.name}<span className="ml-1.5 opacity-60">{f.member_count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null)}
          </div>
        </details>
      </aside>

      <section>
        <h1 className="mb-3 text-2xl font-bold">{t("title")}</h1>
        {(active.length > 0 || state.q) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {active.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-1">
                <TagLink kind={tag.kind} tag={tag} />
                <Link href={`/directory${buildQuery(state, { [tag.kind]: null, page: null })}`} aria-label={t("removeFilter")} className="text-lg leading-none text-slate-500 no-underline">×</Link>
              </span>
            ))}
            {state.q && (
              <span className="chip border-slate-300 bg-white text-slate-700">“{state.q}”
                <Link href={`/directory${buildQuery(state, { q: null, page: null })}`} aria-label={t("removeFilter")} className="ml-1.5 text-base leading-none text-slate-500 no-underline">×</Link>
              </span>
            )}
            <Link href="/directory" className="text-sm">{t("clear")}</Link>
          </div>
        )}
        <Results members={res.members} total={res.total} page={state.page} pageSize={res.pageSize} href={href} />
      </section>
    </div>
  );
}
