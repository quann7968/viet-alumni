import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function Pagination({
  page, total, pageSize, href,
}: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const t = await getTranslations("common");
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      {page > 1 ? <Link className="btn-secondary" href={href(page - 1)} rel="prev">{t("prev")}</Link> : <span />}
      <span className="text-sm text-slate-500">{t("pageOf", { page, pages })}</span>
      {page < pages ? <Link className="btn-secondary" href={href(page + 1)} rel="next">{t("next")}</Link> : <span />}
    </nav>
  );
}
