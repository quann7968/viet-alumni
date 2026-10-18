import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { signOut } from "@/app/actions";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default async function Header({ locale }: { locale: string }) {
  const t = await getTranslations("nav");
  const viewer = await getViewer();
  const status = viewer?.member?.status;
  const link = "whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-100";
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
        <Link href="/" className="mr-auto text-lg font-bold sm:mr-2 text-brand-700 no-underline">{t("brand")}</Link>
        <nav className="order-last flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1" aria-label="Main">
          <Link href="/directory" className={link}>{t("directory")}</Link>
          {viewer && status === "verified" && <Link href="/connections" className={link}>{t("connections")}</Link>}
          {viewer && status === "verified" && <Link href="/invite" className={link}>{t("invite")}</Link>}
          {viewer && status !== "verified" && <Link href="/verify" className={link}>{status === "pending" ? t("verifyPending") : t("verify")}</Link>}
          {viewer && <Link href="/profile/edit" className={link}>{t("editProfile")}</Link>}
          {viewer?.member?.role === "admin" && <Link href="/admin" className={link}>{t("admin")}</Link>}
        </nav>
        <LocaleSwitcher />
        {viewer ? (
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button className="btn-secondary !min-h-[36px] !px-3">{t("logout")}</button>
          </form>
        ) : (
          <Link href="/login" className="btn-primary !min-h-[36px] !px-3 no-underline !text-white">{t("login")}</Link>
        )}
      </div>
    </header>
  );
}
