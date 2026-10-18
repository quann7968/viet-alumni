import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { alternates, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import Avatar from "@/components/Avatar";
import TagLink from "@/components/TagLink";
import { reportMember, respondConnect, sendConnect } from "@/app/actions";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

async function loadMember(slug: string) {
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("members")
    .select("*, location:tags!members_location_tag_id_fkey(name,slug)")
    .eq("slug", slug)
    .maybeSingle();
  return { supabase, m };
}

const bioFor = (m: any, locale: string) => (locale === "vi" ? m.bio_vi || m.bio_en : m.bio_en || m.bio_vi) as string;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const { m } = await loadMember(slug);
  if (!m) return { robots: { index: false } };
  const indexable = m.status === "verified" && m.public_profile;
  const bio = bioFor(m, locale);
  return {
    title: m.headline ? `${m.full_name} — ${m.headline}` : m.full_name,
    description: (bio || m.headline || m.full_name).slice(0, 160),
    robots: indexable ? undefined : { index: false, follow: false },
    alternates: alternates(locale, `/m/${slug}`),
    openGraph: { type: "profile", title: m.full_name, description: (bio || m.headline).slice(0, 200), images: m.avatar_url ? [m.avatar_url] : ["/og.png"] },
  };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const { supabase, m } = await loadMember(slug);
  if (!m) notFound();

  const t = await getTranslations({ locale, namespace: "profile" });
  const ts = await getTranslations({ locale, namespace: "studyStatus" });
  const viewer = await getViewer();
  const isSelf = viewer?.id === m.id;
  const viewerVerified = viewer?.member?.status === "verified";

  const [edu, pos, tags, contactRes, connRes] = await Promise.all([
    supabase.from("education").select("degree,grad_year,school:tags!education_school_tag_id_fkey(name,slug),faculty:tags!education_faculty_tag_id_fkey(name,slug)").eq("member_id", m.id).order("grad_year", { ascending: false }),
    supabase.from("positions").select("is_current,company:tags!positions_company_tag_id_fkey(name,slug),job:tags!positions_job_tag_id_fkey(name,slug)").eq("member_id", m.id).order("is_current", { ascending: false }),
    supabase.from("member_tags").select("tag:tags(kind,name,slug)").eq("member_id", m.id),
    viewerVerified ? supabase.from("member_contacts").select("*").eq("member_id", m.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer && !isSelf && viewerVerified
      ? supabase.from("connections").select("id,from_id,to_id,status").or(`and(from_id.eq.${viewer.id},to_id.eq.${m.id}),and(from_id.eq.${m.id},to_id.eq.${viewer.id})`).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const education = (edu.data ?? []) as any[];
  const positions = (pos.data ?? []) as any[];
  const allTags = ((tags.data ?? []) as any[]).map((r) => r.tag).filter(Boolean);
  const expertise = allTags.filter((x) => x.kind === "expertise");
  const help = allTags.filter((x) => x.kind === "help");
  const contacts = contactRes.data as any;
  const conn = connRes.data as any;
  const bio = bioFor(m, locale);
  const next = encodeURIComponent(`/m/${slug}`);
  const verified = m.status === "verified";

  const person = {
    "@context": "https://schema.org", "@type": "Person", name: m.full_name, url: `${siteUrl}/${locale}/m/${slug}`,
    ...(m.headline && { description: m.headline }),
    ...(positions[0] && { jobTitle: positions[0].job.name, worksFor: { "@type": "Organization", name: positions[0].company.name } }),
    ...(education.length && { alumniOf: education.map((e) => ({ "@type": "CollegeOrUniversity", name: e.school.name })) }),
    ...(expertise.length && { knowsAbout: expertise.map((e) => e.name) }),
    ...(m.avatar_url && { image: m.avatar_url }),
  };

  const flash = sp.connect === "sent" ? t("flashSent") : sp.connect === "limit" ? t("flashLimit")
    : sp.connect === "exists" ? t("flashExists") : sp.connect === "generic" ? t("flashError") : sp.reported ? t("flashReported") : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {verified && m.public_profile && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(person)} />}
      {isSelf && !verified && (
        <div className="card border-amber-300 bg-amber-50 text-sm">
          {m.status === "pending" ? t("selfPending") : <>{t("selfUnverified")} <Link href="/verify" className="font-semibold">{t("verifyNow")} →</Link></>}
        </div>
      )}
      {isSelf && verified && !m.public_profile && <div className="card border-slate-300 bg-slate-100 text-sm">{t("selfPrivate")}</div>}
      {flash && <div role="status" className="card border-emerald-300 bg-emerald-50 text-sm">{flash}</div>}

      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={m.full_name} url={m.avatar_url} size={96} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
              {m.full_name}
              {verified && <span className="chip border-emerald-300 bg-emerald-50 text-emerald-700" title={t("verifiedHint")}>✓ {t("verified")}</span>}
            </h1>
            {m.headline && <p className="mt-1 text-slate-700">{m.headline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {m.location && <TagLink kind="location" tag={m.location} />}
              {m.current_country && <span>{m.current_country}</span>}
              {m.study_status && <span className="chip border-slate-200 bg-slate-50 text-slate-700">{ts(m.study_status)}</span>}
            </div>
            {isSelf && <Link href="/profile/edit" className="btn-secondary mt-3 no-underline">{t("edit")}</Link>}
          </div>
        </div>
      </section>

      {bio && <section className="card"><h2 className="mb-2 text-lg font-semibold">{t("about")}</h2><p className="whitespace-pre-line text-slate-700">{bio}</p></section>}

      {positions.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">{t("career")}</h2>
          <ul className="space-y-3">
            {positions.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <TagLink kind="job" tag={p.job} /><span className="text-sm text-slate-500">{t("at")}</span><TagLink kind="company" tag={p.company} />
                {p.is_current && <span className="text-xs font-medium text-emerald-700">{t("current")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {education.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">{t("education")}</h2>
          <ul className="space-y-3">
            {education.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <TagLink kind="school" tag={e.school} />
                {e.faculty && <TagLink kind="faculty" tag={e.faculty} />}
                {(e.degree || e.grad_year) && <span className="text-sm text-slate-600">{[e.degree, e.grad_year].filter(Boolean).join(" · ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(expertise.length > 0 || help.length > 0) && (
        <section className="card space-y-4">
          {expertise.length > 0 && <div><h2 className="mb-2 text-lg font-semibold">{t("expertise")}</h2><div className="flex flex-wrap gap-2">{expertise.map((x) => <TagLink key={x.slug} kind="expertise" tag={x} />)}</div></div>}
          {help.length > 0 && <div><h2 className="mb-2 text-lg font-semibold">{t("canHelp")}</h2><div className="flex flex-wrap gap-2">{help.map((x) => <TagLink key={x.slug} kind="help" tag={x} />)}</div></div>}
        </section>
      )}

      {!isSelf && (
        <section className="card" id="connect">
          <h2 className="mb-3 text-lg font-semibold">{t("connectTitle")}</h2>
          {!viewer && (
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">{t("loginToUnlock")}</p>
              <Link href={`/login?next=${next}`} className="btn-primary no-underline !text-white">{t("loginCta")}</Link>
            </div>
          )}
          {viewer && !viewerVerified && (
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">{viewer.member?.status === "pending" ? t("verifyPendingText") : t("verifyToUnlock")}</p>
              {viewer.member?.status !== "pending" && <Link href="/verify" className="btn-primary no-underline !text-white">{t("verifyNow")}</Link>}
            </div>
          )}
          {viewerVerified && verified && (
            <div className="space-y-4">
              {contacts && [contacts.email, contacts.phone, contacts.linkedin, contacts.facebook, contacts.zalo].some(Boolean) && (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {contacts.email && <div><dt className="text-slate-500">{t("c_email")}</dt><dd><a href={`mailto:${contacts.email}`}>{contacts.email}</a></dd></div>}
                  {contacts.phone && <div><dt className="text-slate-500">{t("c_phone")}</dt><dd><a href={`tel:${contacts.phone}`}>{contacts.phone}</a></dd></div>}
                  {contacts.linkedin && <div><dt className="text-slate-500">LinkedIn</dt><dd className="break-all"><a href={/^https?:\/\//.test(contacts.linkedin) ? contacts.linkedin : `https://${contacts.linkedin}`} rel="nofollow noopener" target="_blank">{contacts.linkedin}</a></dd></div>}
                  {contacts.facebook && <div><dt className="text-slate-500">Facebook</dt><dd className="break-all"><a href={/^https?:\/\//.test(contacts.facebook) ? contacts.facebook : `https://${contacts.facebook}`} rel="nofollow noopener" target="_blank">{contacts.facebook}</a></dd></div>}
                  {contacts.zalo && <div><dt className="text-slate-500">Zalo</dt><dd>{contacts.zalo}</dd></div>}
                </dl>
              )}
              {!conn && (
                <form action={sendConnect} className="space-y-3">
                  <input type="hidden" name="locale" value={locale} /><input type="hidden" name="to" value={m.id} /><input type="hidden" name="slug" value={slug} />
                  <label className="label" htmlFor="message">{t("introMessage")}</label>
                  <textarea id="message" name="message" maxLength={1000} className="input min-h-[96px]" placeholder={t("introHint")} />
                  <button className="btn-primary">{t("sendRequest")}</button>
                </form>
              )}
              {conn?.status === "pending" && conn.from_id === viewer!.id && <p className="text-sm text-slate-600">{t("requestSent")}</p>}
              {conn?.status === "pending" && conn.to_id === viewer!.id && (
                <form action={respondConnect} className="flex flex-wrap gap-2">
                  <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={conn.id} />
                  <button name="accept" value="1" className="btn-primary">{t("accept")}</button>
                  <button name="accept" value="0" className="btn-secondary">{t("decline")}</button>
                </form>
              )}
              {conn?.status === "accepted" && <Link href={`/connections/${conn.id}`} className="btn-primary no-underline !text-white">{t("openChat")}</Link>}
              {conn?.status === "declined" && <p className="text-sm text-slate-500">{t("declined")}</p>}
            </div>
          )}
        </section>
      )}

      {viewer && !isSelf && (
        <details className="text-sm text-slate-500">
          <summary className="cursor-pointer">{t("report")}</summary>
          <form action={reportMember} className="mt-2 space-y-2">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="member_id" value={m.id} /><input type="hidden" name="slug" value={slug} />
            <textarea name="reason" required maxLength={1000} className="input min-h-[80px]" placeholder={t("reportHint")} />
            <button className="btn-secondary">{t("reportSend")}</button>
          </form>
        </details>
      )}
    </div>
  );
}
