"use server";

import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { escapeHtml, sendEmail, connectionsUrl } from "@/lib/notify";
import { isTagKind, slugify, type TagKind } from "@/lib/tags";
import { STUDY_STATUSES, type ProfilePayload, type SaveResult } from "@/lib/profile-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
const loc = (f: FormData) => (str(f, "locale", 2) === "en" ? "en" : "vi");
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "");
const cleanName = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);

/* ---------------------------------------------------------------- auth */

export async function signIn(formData: FormData) {
  const locale = loc(formData);
  const email = str(formData, "email", 200).toLowerCase();
  const next = safeNext(str(formData, "next", 300));
  const invite = str(formData, "invite", 40).replace(/[^a-z0-9]/gi, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect({ href: "/login?error=email", locale });

  const supabase = await createClient();
  const qs = new URLSearchParams({ locale });
  if (next) qs.set("next", next);
  if (invite) qs.set("invite", invite);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?${qs}`, shouldCreateUser: true },
  });
  if (error) redirect({ href: "/login?error=send", locale });
  redirect({ href: "/login?sent=1", locale });
}

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale: loc(formData) });
}

/* ---------------------------------------------------------------- tags */

export async function searchTags(kind: string, q: string): Promise<string[]> {
  if (!isTagKind(kind)) return [];
  const term = q.trim().replace(/[%_,()\\]/g, " ").slice(0, 60);
  const supabase = await createClient();
  let query = supabase.from("tags").select("name").eq("kind", kind).limit(8);
  query = term ? query.ilike("name", `%${term}%`).order("name") : query.order("created_at", { ascending: false });
  const { data } = await query;
  return (data ?? []).map((r: { name: string }) => r.name);
}

/** Find-or-create tags (unique by kind+slug, so "Data Science" and "data  science" collapse to one). */
async function ensureTags(supabase: SupabaseClient, userId: string, wanted: { kind: TagKind; name: string }[]) {
  const rows = new Map<string, { kind: TagKind; name: string; slug: string; created_by: string }>();
  for (const w of wanted) {
    const name = cleanName(w.name);
    const slug = slugify(name);
    if (name && slug) rows.set(`${w.kind}:${slug}`, { kind: w.kind, name, slug, created_by: userId });
  }
  if (!rows.size) return new Map<string, string>();
  await supabase.from("tags").upsert([...rows.values()], { onConflict: "kind,slug", ignoreDuplicates: true });
  const ids = new Map<string, string>();
  const byKind = new Map<TagKind, string[]>();
  for (const r of rows.values()) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.slug]);
  await Promise.all(
    [...byKind].map(async ([kind, slugs]) => {
      const { data } = await supabase.from("tags").select("id,slug").eq("kind", kind).in("slug", slugs);
      (data ?? []).forEach((t: { id: string; slug: string }) => ids.set(`${kind}:${t.slug}`, t.id));
    }),
  );
  return ids;
}
const tagKey = (kind: TagKind, name: string) => `${kind}:${slugify(cleanName(name))}`;

/* ------------------------------------------------------------- profile */

export async function saveProfile(p: ProfilePayload): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: "unauth" };

  const full_name = p.full_name.trim();
  if (!full_name) return { ok: false, error: "nameRequired" };
  if (full_name.length > 100 || p.headline.length > 160 || p.bio_en.length > 3000 || p.bio_vi.length > 3000) {
    return { ok: false, error: "tooLong" };
  }

  const education = p.education.filter((e) => e.school.trim()).slice(0, 10);
  const positions = p.positions.filter((x) => x.company.trim() && x.job.trim()).slice(0, 15);
  const expertise = [...new Set(p.expertise.map(cleanName).filter(Boolean))].slice(0, 20);
  const help = [...new Set(p.help.map(cleanName).filter(Boolean))].slice(0, 12);

  const wanted: { kind: TagKind; name: string }[] = [
    ...expertise.map((name) => ({ kind: "expertise" as const, name })),
    ...help.map((name) => ({ kind: "help" as const, name })),
    ...education.flatMap((e) => [
      { kind: "school" as const, name: e.school },
      ...(e.faculty.trim() ? [{ kind: "faculty" as const, name: e.faculty }] : []),
    ]),
    ...positions.flatMap((x) => [
      { kind: "company" as const, name: x.company },
      { kind: "job" as const, name: x.job },
    ]),
    ...(p.location.trim() ? [{ kind: "location" as const, name: p.location }] : []),
  ];
  const ids = await ensureTags(supabase, user.id, wanted);

  const { data: current } = await supabase.from("members").select("slug,slug_locked").eq("id", user.id).single();
  if (!current) return { ok: false, error: "generic" };

  const update: Record<string, unknown> = {
    full_name,
    headline: p.headline.trim(),
    bio_vi: p.bio_vi.trim(),
    bio_en: p.bio_en.trim(),
    current_country: p.current_country.trim().slice(0, 80),
    study_status: (STUDY_STATUSES as readonly string[]).includes(p.study_status) ? p.study_status : null,
    location_tag_id: p.location.trim() ? ids.get(tagKey("location", p.location)) ?? null : null,
    public_profile: !!p.public_profile,
  };

  // The URL slug is derived from the name on the first save, then stays stable.
  let slug = current.slug as string;
  if (!current.slug_locked) {
    const base = slugify(full_name) || "member";
    for (let i = 0; i < 4; i++) {
      const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("members").update({ ...update, slug: candidate, slug_locked: true }).eq("id", user.id);
      if (!error) { slug = candidate; break; }
      if (error.code !== "23505") return { ok: false, error: "generic" };
      if (i === 3) return { ok: false, error: "generic" };
    }
  } else {
    const { error } = await supabase.from("members").update(update).eq("id", user.id);
    if (error) return { ok: false, error: "generic" };
  }

  // Replace dependent rows.
  await Promise.all([
    supabase.from("education").delete().eq("member_id", user.id),
    supabase.from("positions").delete().eq("member_id", user.id),
    supabase.from("member_tags").delete().eq("member_id", user.id),
  ]);
  const eduRows = education.flatMap((e) => {
    const school = ids.get(tagKey("school", e.school));
    if (!school) return [];
    const year = parseInt(e.grad_year, 10);
    return [{
      member_id: user.id, school_tag_id: school,
      faculty_tag_id: e.faculty.trim() ? ids.get(tagKey("faculty", e.faculty)) ?? null : null,
      degree: e.degree.trim().slice(0, 80),
      grad_year: year >= 1950 && year <= 2100 ? year : null,
    }];
  });
  const posRows = positions.flatMap((x) => {
    const company = ids.get(tagKey("company", x.company));
    const job = ids.get(tagKey("job", x.job));
    return company && job ? [{ member_id: user.id, company_tag_id: company, job_tag_id: job, is_current: !!x.is_current }] : [];
  });
  const tagRows = [
    ...expertise.map((n) => ids.get(tagKey("expertise", n))),
    ...help.map((n) => ids.get(tagKey("help", n))),
  ].filter(Boolean).map((tag_id) => ({ member_id: user.id, tag_id }));

  await Promise.all([
    eduRows.length ? supabase.from("education").insert(eduRows) : null,
    posRows.length ? supabase.from("positions").insert(posRows) : null,
    tagRows.length ? supabase.from("member_tags").insert(tagRows) : null,
    supabase.from("member_contacts").upsert({
      member_id: user.id,
      email: p.contacts.email.trim().slice(0, 200),
      phone: p.contacts.phone.trim().slice(0, 40),
      linkedin: p.contacts.linkedin.trim().slice(0, 300),
      facebook: p.contacts.facebook.trim().slice(0, 300),
      zalo: p.contacts.zalo.trim().slice(0, 100),
    }),
  ]);
  return { ok: true, slug };
}

export async function uploadAvatar(formData: FormData) {
  const locale = loc(formData);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: "/login", locale });
  const file = formData.get("avatar");
  const ok = file instanceof File && file.size > 0 && file.size <= 2 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!ok) redirect({ href: "/profile/edit?avatar=invalid", locale });
  const f = file as File;
  const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.user!.id}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true, contentType: f.type });
  if (error) redirect({ href: "/profile/edit?avatar=error", locale });
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await supabase.from("members").update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` }).eq("id", auth.user!.id);
  redirect({ href: "/profile/edit?avatar=ok", locale });
}

/* -------------------------------------------------------- verification */

export async function submitVerification(formData: FormData) {
  const locale = loc(formData);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: "/login?next=/verify", locale });
  const school = cleanName(str(formData, "school", 80));
  if (!school) redirect({ href: "/verify?error=school", locale });
  const ids = await ensureTags(supabase, auth.user!.id, [{ kind: "school", name: school }]);
  const year = parseInt(str(formData, "grad_year", 4), 10);
  const { error } = await supabase.rpc("submit_verification", {
    p_school: ids.get(tagKey("school", school)) ?? null,
    p_year: year >= 1950 && year <= 2100 ? year : null,
    p_evidence: str(formData, "evidence", 500),
    p_note: str(formData, "note", 1000),
  });
  redirect({ href: error ? "/verify?error=generic" : "/verify?submitted=1", locale });
}

export async function adminReview(formData: FormData) {
  const locale = loc(formData);
  const memberId = str(formData, "member_id", 40);
  const approve = str(formData, "approve", 1) === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review", { p_member: memberId, p_approve: approve });
  if (!error) {
    await sendEmail(
      memberId,
      approve ? "Your alumni profile is verified" : "Your alumni verification was not approved",
      approve
        ? `<p>You are now verified and can connect with other alumni.</p><p><a href="${siteUrl}/${locale}/directory">Open the directory</a></p>`
        : `<p>We could not verify your claim. You can submit it again with more details.</p><p><a href="${siteUrl}/${locale}/verify">Try again</a></p>`,
    );
  }
  redirect({ href: "/admin", locale });
}

export async function adminRenameTag(formData: FormData) {
  const supabase = await createClient();
  const name = cleanName(str(formData, "name", 80));
  if (name) await supabase.from("tags").update({ name }).eq("id", str(formData, "id", 40));
  redirect({ href: `/admin?tq=${encodeURIComponent(str(formData, "tq", 60))}`, locale: loc(formData) });
}

export async function adminDeleteTag(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", str(formData, "id", 40));
  const tq = encodeURIComponent(str(formData, "tq", 60));
  redirect({ href: `/admin?tq=${tq}${error ? "&error=tagInUse" : ""}`, locale: loc(formData) });
}

export async function adminResolveReport(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("reports").update({ resolved: true }).eq("id", str(formData, "id", 40));
  redirect({ href: "/admin", locale: loc(formData) });
}

/* ------------------------------------------------- connect + messaging */

export async function sendConnect(formData: FormData) {
  const locale = loc(formData);
  const slug = str(formData, "slug", 80);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: `/login?next=/m/${slug}`, locale });
  const to = str(formData, "to", 40);
  const message = str(formData, "message", 1000);
  const { error } = await supabase.rpc("send_connect", { p_to: to, p_message: message });
  if (error) {
    const key = error.message.includes("limit") ? "limit" : error.message.includes("exists") ? "exists" : "generic";
    redirect({ href: `/m/${slug}?connect=${key}`, locale });
  }
  const { data: me } = await supabase.from("members").select("full_name").eq("id", auth.user!.id).single();
  await sendEmail(
    to,
    `${me?.full_name ?? "An alumnus"} wants to connect with you`,
    `<p><b>${escapeHtml(me?.full_name ?? "")}</b> sent you a connect request.</p>` +
      (message ? `<blockquote>${escapeHtml(message)}</blockquote>` : "") +
      `<p><a href="${connectionsUrl(locale)}">Review the request</a></p>`,
  );
  redirect({ href: `/m/${slug}?connect=sent`, locale });
}

export async function respondConnect(formData: FormData) {
  const locale = loc(formData);
  const supabase = await createClient();
  const accept = str(formData, "accept", 1) === "1";
  const id = str(formData, "id", 40);
  const { error } = await supabase.rpc("respond_connect", { p_id: id, p_accept: accept });
  if (!error && accept) {
    const { data: c } = await supabase.from("connections").select("from_id").eq("id", id).single();
    if (c) await sendEmail(c.from_id, "Your connect request was accepted", `<p>You can now message each other.</p><p><a href="${connectionsUrl(locale)}">Open messages</a></p>`);
  }
  redirect({ href: "/connections", locale });
}

export async function sendMessage(formData: FormData) {
  const locale = loc(formData);
  const id = str(formData, "connection_id", 40);
  const body = str(formData, "body", 4000);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: "/login", locale });
  if (body) await supabase.from("messages").insert({ connection_id: id, sender_id: auth.user!.id, body });
  redirect({ href: `/connections/${id}`, locale });
}

export async function reportMember(formData: FormData) {
  const locale = loc(formData);
  const slug = str(formData, "slug", 80);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: `/login?next=/m/${slug}`, locale });
  await supabase.from("reports").insert({
    reporter_id: auth.user!.id, member_id: str(formData, "member_id", 40), reason: str(formData, "reason", 1000),
  });
  redirect({ href: `/m/${slug}?reported=1`, locale });
}

/* -------------------------------------------------------------- invites */

export async function createInvite(formData: FormData) {
  const locale = loc(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invite");
  redirect({ href: error ? "/invite?error=1" : "/invite", locale });
}

export async function redeemInvite(formData: FormData) {
  const locale = loc(formData);
  const supabase = await createClient();
  const { data } = await supabase.rpc("redeem_invite", { p_code: str(formData, "code", 40) });
  redirect({ href: data ? "/profile/edit" : "/join/invalid", locale });
}
