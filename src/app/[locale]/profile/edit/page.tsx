import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { uploadAvatar } from "@/app/actions";
import ProfileForm from "@/components/ProfileForm";
import Avatar from "@/components/Avatar";
import type { ProfilePayload } from "@/lib/profile-types";

export const metadata: Metadata = { robots: { index: false } };

export default async function EditProfile({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer(locale, "/profile/edit");
  const t = await getTranslations({ locale, namespace: "profileForm" });
  const supabase = await createClient();

  const [{ data: m }, edu, pos, tags, contacts] = await Promise.all([
    supabase.from("members").select("*, location:tags!members_location_tag_id_fkey(name)").eq("id", viewer.id).single(),
    supabase.from("education").select("degree,grad_year,school:tags!education_school_tag_id_fkey(name),faculty:tags!education_faculty_tag_id_fkey(name)").eq("member_id", viewer.id).order("created_at"),
    supabase.from("positions").select("is_current,company:tags!positions_company_tag_id_fkey(name),job:tags!positions_job_tag_id_fkey(name)").eq("member_id", viewer.id).order("created_at"),
    supabase.from("member_tags").select("tag:tags(kind,name)").eq("member_id", viewer.id),
    supabase.from("member_contacts").select("*").eq("member_id", viewer.id).maybeSingle(),
  ]);
  if (!m) return null;
  const tg = ((tags.data ?? []) as any[]).map((r) => r.tag).filter(Boolean);
  const c = (contacts.data ?? {}) as any;
  const initial: ProfilePayload = {
    full_name: m.full_name, headline: m.headline, bio_vi: m.bio_vi, bio_en: m.bio_en,
    current_country: m.current_country, study_status: m.study_status ?? "", location: (m as any).location?.name ?? "",
    public_profile: m.public_profile,
    expertise: tg.filter((x) => x.kind === "expertise").map((x) => x.name),
    help: tg.filter((x) => x.kind === "help").map((x) => x.name),
    education: ((edu.data ?? []) as any[]).map((e) => ({ school: e.school.name, faculty: e.faculty?.name ?? "", degree: e.degree, grad_year: e.grad_year ? String(e.grad_year) : "" })),
    positions: ((pos.data ?? []) as any[]).map((p) => ({ company: p.company.name, job: p.job.name, is_current: p.is_current })),
    contacts: { email: c.email ?? viewer.email ?? "", phone: c.phone ?? "", linkedin: c.linkedin ?? "", facebook: c.facebook ?? "", zalo: c.zalo ?? "" },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <form action={uploadAvatar} className="card flex flex-wrap items-center gap-4">
        <input type="hidden" name="locale" value={locale} />
        <Avatar name={m.full_name} url={m.avatar_url} size={72} />
        <div className="min-w-0 flex-1 space-y-2">
          <label className="label" htmlFor="avatar">{t("avatar")}</label>
          <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" required />
          {sp.avatar === "ok" && <p className="text-sm text-emerald-700">{t("avatarOk")}</p>}
          {(sp.avatar === "invalid" || sp.avatar === "error") && <p className="text-sm text-red-700">{t("avatarError")}</p>}
        </div>
        <button className="btn-secondary">{t("upload")}</button>
      </form>
      <ProfileForm initial={initial} />
    </div>
  );
}
