import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="text-xl font-bold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-slate-600">{t("notFoundText")}</p>
      <Link href="/directory" className="btn-primary mt-4 no-underline !text-white">{t("backToDirectory")}</Link>
    </div>
  );
}
