import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/auth";
import { submitVerification } from "@/app/actions";
import TagInput from "@/components/TagInput";

export const metadata: Metadata = { robots: { index: false } };

export default async function Verify({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer(locale, "/verify");
  const t = await getTranslations({ locale, namespace: "verify" });
  const status = viewer.member?.status ?? "unverified";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {status === "verified" && (
        <div className="card border-emerald-300 bg-emerald-50">{t("verifiedText")} <Link href="/directory" className="font-semibold">{t("goDirectory")} →</Link></div>
      )}
      {status === "pending" && <div className="card border-amber-300 bg-amber-50">{sp.submitted ? t("submitted") : t("pending")}</div>}
      {status === "rejected" && <div className="card border-red-300 bg-red-50">{t("rejected")}</div>}

      {(status === "unverified" || status === "rejected") && (
        <form action={submitVerification} className="card space-y-4">
          <p className="text-sm text-slate-600">{t("lead")}</p>
          {sp.error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm">{t("error")}</div>}
          <input type="hidden" name="locale" value={locale} />
          <div><label className="label">{t("school")} *</label><TagInput kind="school" single name="school" value={[]} placeholder={t("schoolHint")} /></div>
          <div><label className="label" htmlFor="grad_year">{t("gradYear")}</label>
            <input id="grad_year" name="grad_year" inputMode="numeric" maxLength={4} className="input" /></div>
          <div><label className="label" htmlFor="evidence">{t("evidence")}</label>
            <input id="evidence" name="evidence" maxLength={500} className="input" placeholder="https://linkedin.com/in/…" />
            <p className="mt-1 text-xs text-slate-500">{t("evidenceHint")}</p></div>
          <div><label className="label" htmlFor="note">{t("note")}</label>
            <textarea id="note" name="note" maxLength={1000} className="input min-h-[96px]" placeholder={t("noteHint")} /></div>
          <button className="btn-primary w-full sm:w-auto">{t("submit")}</button>
        </form>
      )}
      <p className="text-sm text-slate-500">{t("invitePrompt")}</p>
    </div>
  );
}
