import { getTranslations } from "next-intl/server";
import MemberCard from "@/components/MemberCard";
import Pagination from "@/components/Pagination";
import type { MemberCardData } from "@/lib/data";

export default async function Results({
  members, total, page, pageSize, href,
}: { members: MemberCardData[]; total: number; page: number; pageSize: number; href: (page: number) => string }) {
  const t = await getTranslations("common");
  if (!members.length) return <p className="card text-center text-slate-500">{t("noResults")}</p>;
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">{t("resultCount", { count: total })}</p>
      <div className="grid gap-3 md:grid-cols-2">{members.map((m) => <MemberCard key={m.id} m={m} />)}</div>
      <Pagination page={page} total={total} pageSize={pageSize} href={href} />
    </>
  );
}
