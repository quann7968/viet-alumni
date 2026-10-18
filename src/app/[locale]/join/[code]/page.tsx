import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/auth";
import { redeemInvite, signIn } from "@/app/actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function Join({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  const t = await getTranslations({ locale, namespace: "join" });
  const viewer = await getViewer();
  const safe = code.replace(/[^a-z0-9]/gi, "");
  if (code === "invalid") return <div className="card mx-auto max-w-md text-center">{t("invalid")}</div>;

  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-slate-600">{t("lead")}</p>
        {viewer ? (
          <form action={redeemInvite}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="code" value={safe} />
            <button className="btn-primary w-full">{t("accept")}</button>
          </form>
        ) : (
          <form action={signIn} className="space-y-3">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="invite" value={safe} />
            <label className="label" htmlFor="email">{t("email")}</label>
            <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" />
            <button className="btn-primary w-full">{t("submit")}</button>
          </form>
        )}
      </div>
    </div>
  );
}
