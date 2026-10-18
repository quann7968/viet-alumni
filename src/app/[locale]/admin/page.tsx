import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { adminDeleteTag, adminRenameTag, adminResolveReport, adminReview } from "@/app/actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function Admin({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin" });
  const supabase = await createClient();
  const tq = (sp.tq ?? "").replace(/[%_,()\\]/g, " ").trim().slice(0, 60);

  const [pending, reports, tagRows] = await Promise.all([
    supabase.from("verifications").select("id,member_id,grad_year,evidence_url,note,created_at,school:tags(name),member:members!verifications_member_id_fkey(slug,full_name,headline)")
      .eq("status", "pending").order("created_at"),
    supabase.from("reports").select("id,reason,created_at,member:members!reports_member_id_fkey(slug,full_name),reporter:members!reports_reporter_id_fkey(full_name)")
      .eq("resolved", false).order("created_at"),
    (tq ? supabase.from("tags").select("id,kind,name,slug").ilike("name", `%${tq}%`) : supabase.from("tags").select("id,kind,name,slug"))
      .order("kind").order("name").limit(100),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {sp.error && <div role="alert" className="card border-red-300 bg-red-50 text-sm">{t("tagInUse")}</div>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("pending")} ({pending.data?.length ?? 0})</h2>
        {(pending.data ?? []).length === 0 && <p className="text-sm text-slate-500">{t("nonePending")}</p>}
        {((pending.data ?? []) as any[]).map((v) => (
          <div key={v.id} className="card space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><Link href={`/m/${v.member?.slug}`} className="text-base font-semibold">{v.member?.full_name}</Link>
                {v.member?.headline && <p className="text-slate-600">{v.member.headline}</p>}</div>
              <span className="text-xs text-slate-500">{new Date(v.created_at).toLocaleDateString()}</span>
            </div>
            <p><b>{t("school")}:</b> {v.school?.name ?? "—"} {v.grad_year ? `(${v.grad_year})` : ""}</p>
            {v.evidence_url && <p className="break-all"><b>{t("evidence")}:</b> <a href={/^https?:\/\//.test(v.evidence_url) ? v.evidence_url : undefined} rel="nofollow noopener" target="_blank">{v.evidence_url}</a></p>}
            {v.note && <p className="rounded-lg bg-slate-50 p-2">{v.note}</p>}
            <form action={adminReview} className="flex gap-2">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="member_id" value={v.member_id} />
              <button name="approve" value="1" className="btn-primary">{t("approve")}</button>
              <button name="approve" value="0" className="btn-danger">{t("reject")}</button>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("reports")} ({reports.data?.length ?? 0})</h2>
        {(reports.data ?? []).length === 0 && <p className="text-sm text-slate-500">{t("noReports")}</p>}
        {((reports.data ?? []) as any[]).map((r) => (
          <div key={r.id} className="card space-y-2 text-sm">
            <p><Link href={`/m/${r.member?.slug}`} className="font-semibold">{r.member?.full_name}</Link> <span className="text-slate-500">← {r.reporter?.full_name}</span></p>
            <p className="rounded-lg bg-slate-50 p-2">{r.reason}</p>
            <form action={adminResolveReport}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} />
              <button className="btn-secondary">{t("resolve")}</button></form>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("tags")}</h2>
        <form className="flex gap-2" action={`/${locale}/admin`}>
          <input name="tq" defaultValue={tq} className="input" placeholder={t("tagSearch")} />
          <button className="btn-secondary">{t("search")}</button>
        </form>
        <ul className="space-y-2">
          {((tagRows.data ?? []) as any[]).map((g) => (
            <li key={g.id} className="card flex flex-wrap items-center gap-2 !p-3 text-sm">
              <span className="chip border-slate-200 bg-slate-50 text-slate-600">{g.kind}</span>
              <form action={adminRenameTag} className="flex min-w-0 flex-1 gap-2">
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={g.id} /><input type="hidden" name="tq" value={tq} />
                <input name="name" defaultValue={g.name} className="input !min-h-[36px]" maxLength={80} />
                <button className="btn-secondary !min-h-[36px]">{t("rename")}</button>
              </form>
              <form action={adminDeleteTag}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={g.id} /><input type="hidden" name="tq" value={tq} />
                <button className="btn-danger !min-h-[36px]">{t("delete")}</button></form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
