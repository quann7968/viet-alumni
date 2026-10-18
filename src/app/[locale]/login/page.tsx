import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { signIn } from "@/app/actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function Login({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "login" });
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-slate-600">{t("lead")}</p>
        {sp.sent ? (
          <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">{t("sent")}</div>
        ) : (
          <form action={signIn} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={sp.next ?? ""} />
            <input type="hidden" name="invite" value={sp.invite ?? ""} />
            {sp.error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm">{t(`error_${sp.error === "email" || sp.error === "link" ? sp.error : "send"}`)}</div>}
            <label className="label" htmlFor="email">{t("email")}</label>
            <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="input" placeholder="you@example.com" />
            <button className="btn-primary w-full">{t("submit")}</button>
          </form>
        )}
        <p className="text-xs text-slate-500">{t("note")}</p>
      </div>
    </div>
  );
}
