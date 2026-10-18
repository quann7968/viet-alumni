import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { respondConnect } from "@/app/actions";
import Avatar from "@/components/Avatar";

export const metadata: Metadata = { robots: { index: false } };

export default async function Connections({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireViewer(locale, "/connections");
  const t = await getTranslations({ locale, namespace: "connections" });
  const supabase = await createClient();
  const { data } = await supabase.from("connections").select("id,from_id,to_id,status,intro_message,created_at").order("created_at", { ascending: false });
  const rows = (data ?? []) as any[];
  const otherIds = [...new Set(rows.map((r) => (r.from_id === viewer.id ? r.to_id : r.from_id)))];
  const { data: ms } = otherIds.length
    ? await supabase.from("members").select("id,slug,full_name,headline,avatar_url").in("id", otherIds)
    : { data: [] };
  const byId = new Map(((ms ?? []) as any[]).map((m) => [m.id, m]));
  const other = (r: any) => byId.get(r.from_id === viewer.id ? r.to_id : r.from_id);

  const incoming = rows.filter((r) => r.status === "pending" && r.to_id === viewer.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.from_id === viewer.id);
  const accepted = rows.filter((r) => r.status === "accepted");

  const Person = ({ r }: { r: any }) => {
    const m = other(r);
    return m ? (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={m.full_name} url={m.avatar_url} size={44} />
        <div className="min-w-0"><Link href={`/m/${m.slug}`} className="font-semibold text-slate-900 no-underline">{m.full_name}</Link>
          {m.headline && <p className="truncate text-sm text-slate-600">{m.headline}</p>}</div>
      </div>
    ) : null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("incoming")} ({incoming.length})</h2>
        {incoming.length === 0 && <p className="text-sm text-slate-500">{t("noneIncoming")}</p>}
        {incoming.map((r) => (
          <div key={r.id} className="card space-y-3">
            <Person r={r} />
            {r.intro_message && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{r.intro_message}</p>}
            <form action={respondConnect} className="flex flex-wrap gap-2">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} />
              <button name="accept" value="1" className="btn-primary">{t("accept")}</button>
              <button name="accept" value="0" className="btn-secondary">{t("decline")}</button>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("chats")} ({accepted.length})</h2>
        {accepted.length === 0 && <p className="text-sm text-slate-500">{t("noneChats")}</p>}
        {accepted.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
            <Person r={r} />
            <Link href={`/connections/${r.id}`} className="btn-secondary no-underline">{t("open")}</Link>
          </div>
        ))}
      </section>

      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("outgoing")} ({outgoing.length})</h2>
          {outgoing.map((r) => <div key={r.id} className="card flex items-center justify-between gap-3"><Person r={r} /><span className="text-sm text-slate-500">{t("waiting")}</span></div>)}
        </section>
      )}
    </div>
  );
}
