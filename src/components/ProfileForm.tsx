"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveProfile } from "@/app/actions";
import TagInput from "@/components/TagInput";
import { STUDY_STATUSES, type ProfilePayload } from "@/lib/profile-types";
import { Link } from "@/i18n/navigation";

const emptyEdu = { school: "", faculty: "", degree: "", grad_year: "" };
const emptyPos = { company: "", job: "", is_current: true };

export default function ProfileForm({ initial }: { initial: ProfilePayload }) {
  const t = useTranslations("profileForm");
  const ts = useTranslations("studyStatus");
  const [p, setP] = useState<ProfilePayload>({
    ...initial,
    education: initial.education.length ? initial.education : [{ ...emptyEdu }],
    positions: initial.positions.length ? initial.positions : [{ ...emptyPos }],
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; slug?: string } | null>(null);

  const set = <K extends keyof ProfilePayload>(k: K, v: ProfilePayload[K]) => setP((s) => ({ ...s, [k]: v }));
  const setRow = <K extends "education" | "positions">(k: K, i: number, patch: Partial<ProfilePayload[K][number]>) =>
    setP((s) => ({ ...s, [k]: s[k].map((r, j) => (j === i ? { ...r, ...patch } : r)) as ProfilePayload[K] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveProfile(p);
      if (res.ok) setMsg({ ok: true, text: t("saved"), slug: res.slug });
      else setMsg({ ok: false, text: t(`err_${res.error}`) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {msg && (
        <div role="status" className={`card ${msg.ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          {msg.text}{" "}
          {msg.slug && <Link href={`/m/${msg.slug}`} className="font-semibold">{t("viewProfile")} →</Link>}
        </div>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t("basics")}</h2>
        <div><label className="label">{t("fullName")} *</label>
          <input className="input" required maxLength={100} value={p.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
        <div><label className="label">{t("headline")}</label>
          <input className="input" maxLength={160} placeholder={t("headlineHint")} value={p.headline} onChange={(e) => set("headline", e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">{t("location")}</label>
            <TagInput kind="location" single value={p.location ? [p.location] : []} onChange={(v) => set("location", v[0] ?? "")} placeholder={t("locationHint")} /></div>
          <div><label className="label">{t("country")}</label>
            <input className="input" maxLength={80} value={p.current_country} onChange={(e) => set("current_country", e.target.value)} /></div>
        </div>
        <div><label className="label">{t("studyStatus")}</label>
          <select className="input" value={p.study_status} onChange={(e) => set("study_status", e.target.value)}>
            <option value="">—</option>
            {STUDY_STATUSES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
          </select></div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t("about")}</h2>
        <div><label className="label">{t("bioVi")}</label>
          <textarea className="input min-h-[120px]" maxLength={3000} value={p.bio_vi} onChange={(e) => set("bio_vi", e.target.value)} /></div>
        <div><label className="label">{t("bioEn")}</label>
          <textarea className="input min-h-[120px]" maxLength={3000} value={p.bio_en} onChange={(e) => set("bio_en", e.target.value)} /></div>
        <p className="text-xs text-slate-500">{t("bioHint")}</p>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t("education")}</h2>
        {p.education.map((e, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">{t("school")}</label>
                <TagInput kind="school" single value={e.school ? [e.school] : []} onChange={(v) => setRow("education", i, { school: v[0] ?? "" })} placeholder={t("schoolHint")} /></div>
              <div><label className="label">{t("faculty")}</label>
                <TagInput kind="faculty" single value={e.faculty ? [e.faculty] : []} onChange={(v) => setRow("education", i, { faculty: v[0] ?? "" })} placeholder={t("facultyHint")} /></div>
              <div><label className="label">{t("degree")}</label>
                <input className="input" maxLength={80} value={e.degree} onChange={(ev) => setRow("education", i, { degree: ev.target.value })} /></div>
              <div><label className="label">{t("gradYear")}</label>
                <input className="input" inputMode="numeric" maxLength={4} value={e.grad_year} onChange={(ev) => setRow("education", i, { grad_year: ev.target.value.replace(/\D/g, "") })} /></div>
            </div>
            {p.education.length > 1 && <button type="button" className="btn-danger" onClick={() => set("education", p.education.filter((_, j) => j !== i))}>{t("remove")}</button>}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => set("education", [...p.education, { ...emptyEdu }])}>+ {t("addEducation")}</button>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t("career")}</h2>
        {p.positions.map((x, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">{t("jobTitle")}</label>
                <TagInput kind="job" single value={x.job ? [x.job] : []} onChange={(v) => setRow("positions", i, { job: v[0] ?? "" })} placeholder={t("jobHint")} /></div>
              <div><label className="label">{t("company")}</label>
                <TagInput kind="company" single value={x.company ? [x.company] : []} onChange={(v) => setRow("positions", i, { company: v[0] ?? "" })} placeholder={t("companyHint")} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={x.is_current} onChange={(ev) => setRow("positions", i, { is_current: ev.target.checked })} />
              {t("currentRole")}
            </label>
            {p.positions.length > 1 && <button type="button" className="btn-danger" onClick={() => set("positions", p.positions.filter((_, j) => j !== i))}>{t("remove")}</button>}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => set("positions", [...p.positions, { ...emptyPos }])}>+ {t("addPosition")}</button>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t("expertiseAndHelp")}</h2>
        <div><label className="label">{t("expertise")}</label>
          <TagInput kind="expertise" value={p.expertise} onChange={(v) => set("expertise", v)} placeholder={t("expertiseHint")} /></div>
        <div><label className="label">{t("help")}</label>
          <TagInput kind="help" value={p.help} onChange={(v) => set("help", v)} max={12} placeholder={t("helpHint")} /></div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t("contact")}</h2>
        <p className="text-sm text-slate-600">{t("contactHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["email", "phone", "linkedin", "facebook", "zalo"] as const).map((k) => (
            <div key={k}><label className="label">{t(`c_${k}`)}</label>
              <input className="input" maxLength={300} value={p.contacts[k]} onChange={(e) => set("contacts", { ...p.contacts, [k]: e.target.value })} /></div>
          ))}
        </div>
      </section>

      <section className="card">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={p.public_profile} onChange={(e) => set("public_profile", e.target.checked)} />
          <span><b>{t("publicProfile")}</b><br /><span className="text-slate-600">{t("publicProfileHint")}</span></span>
        </label>
      </section>

      <button className="btn-primary w-full sm:w-auto" disabled={pending}>{pending ? t("saving") : t("save")}</button>
    </form>
  );
}
