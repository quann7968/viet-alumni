import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { sendMessage } from "@/app/actions";
import Avatar from "@/components/Avatar";
import AutoRefresh from "@/components/AutoRefresh";

export const metadata: Metadata = { robots: { index: false } };

export default async function Thread({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const viewer = await requireViewer(locale, `/connections/${id}`);
  const t = await getTranslations({ locale, namespace: "connections" });
  const supabase = await createClient();
  const { data: c } = await supabase.from("connections").select("id,from_id,to_id,status").eq("id", id).maybeSingle();
  if (!c || c.status !== "accepted" || (c.from_id !== viewer.id && c.to_id !== viewer.id)) notFound();
  const otherId = c.from_id === viewer.id ? c.to_id : c.from_id;
  const [{ data: m }, { data: msgs }] = await Promise.all([
    supabase.from("members").select("slug,full_name,avatar_url,headline").eq("id", otherId).single(),
    supabase.from("messages").select("id,sender_id,body,created_at").eq("connection_id", id).order("created_at").limit(500),
  ]);
  const fmt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <AutoRefresh />
      <Link href="/connections" className="text-sm">← {t("title")}</Link>
      <div className="card flex items-center gap-3">
        <Avatar name={m?.full_name ?? "?"} url={m?.avatar_url} size={48} />
        <div><Link href={`/m/${m?.slug}`} className="font-semibold text-slate-900 no-underline">{m?.full_name}</Link>
          {m?.headline && <p className="text-sm text-slate-600">{m.headline}</p>}</div>
      </div>
      <div className="card min-h-[240px] space-y-3">
        {(msgs ?? []).length === 0 && <p className="text-center text-sm text-slate-500">{t("sayHi")}</p>}
        {(msgs ?? []).map((x: any) => (
          <div key={x.id} className={`flex ${x.sender_id === viewer.id ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${x.sender_id === viewer.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"}`}>
              <p className="whitespace-pre-wrap break-words">{x.body}</p>
              <p className={`mt-1 text-[10px] ${x.sender_id === viewer.id ? "text-brand-100" : "text-slate-500"}`}>{fmt.format(new Date(x.created_at))}</p>
            </div>
          </div>
        ))}
      </div>
      <form action={sendMessage} className="flex gap-2">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="connection_id" value={id} />
        <input name="body" required maxLength={4000} autoComplete="off" className="input" placeholder={t("messageHint")} />
        <button className="btn-primary">{t("send")}</button>
      </form>
    </div>
  );
}
