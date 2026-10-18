import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { createInvite } from "@/app/actions";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { robots: { index: false } };

export default async function Invite({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer(locale, "/invite");
  const t = await getTranslations({ locale, namespace: "invite" });
  const supabase = await createClient();
  const { data } = await supabase.from("invites").select("code,uses,max_uses,expires_at")
    .eq("created_by", viewer.id).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  const verified = viewer.member?.status === "verified";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-slate-600">{t("lead")}</p>
      {!verified ? <div className="card border-amber-300 bg-amber-50 text-sm">{t("needVerified")}</div> : (
        <>
          {sp.error && <div role="alert" className="card border-red-300 bg-red-50 text-sm">{t("error")}</div>}
          <form action={createInvite}><input type="hidden" name="locale" value={locale} /><button className="btn-primary">{t("create")}</button></form>
          <ul className="space-y-2">
            {(data ?? []).map((i: any) => (
              <li key={i.code} className="card space-y-1">
                <input readOnly className="input font-mono text-xs" value={`${siteUrl}/${locale}/join/${i.code}`} aria-label={t("link")} />
                <p className="text-xs text-slate-500">{t("uses", { uses: i.uses, max: i.max_uses })} · {t("expires", { date: new Date(i.expires_at).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US") })}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
