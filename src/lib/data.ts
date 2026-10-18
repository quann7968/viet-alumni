import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE } from "@/lib/site";
import { TAG_KINDS, fold, type TagKind, type TagRef } from "@/lib/tags";

export type Filters = Partial<Record<TagKind, string>>;

export type MemberCardData = {
  id: string; slug: string; full_name: string; headline: string; avatar_url: string | null;
  location: TagRef | null; current_country: string;
  position: { company: TagRef; job: TagRef } | null;
  school: TagRef | null;
};

type Sp = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseSearchParams(sp: Sp) {
  const filters: Filters = {};
  for (const k of TAG_KINDS) {
    const v = first(sp[k]);
    if (v) filters[k] = v;
  }
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(first(sp.page) ?? "1", 10) || 1);
  return { filters, q, page };
}

export function buildQuery(base: { filters: Filters; q?: string; page?: number }, patch: Record<string, string | null>) {
  const p = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...base.filters, q: base.q || undefined };
  for (const [k, v] of Object.entries(patch)) merged[k] = v ?? undefined;
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const POSITIONS = `member_id,is_current,
  company:tags!positions_company_tag_id_fkey(name,slug),
  job:tags!positions_job_tag_id_fkey(name,slug)`;
const EDUCATION = `member_id,school:tags!education_school_tag_id_fkey(name,slug)`;

/** Resolve filter slugs to tag rows. `missing` is true when a slug matches no tag. */
export async function resolveFilters(supabase: SupabaseClient, filters: Filters) {
  const entries = Object.entries(filters) as [TagKind, string][];
  const tags: { id: string; kind: TagKind; name: string; slug: string }[] = [];
  let missing = false;
  await Promise.all(
    entries.map(async ([kind, slug]) => {
      const { data } = await supabase.from("tags").select("id,kind,name,slug").eq("kind", kind).eq("slug", slug).maybeSingle();
      if (data) tags.push(data); else missing = true;
    }),
  );
  return { tags, missing };
}

export async function searchMembers(
  supabase: SupabaseClient,
  opts: { filters: Filters; q: string; page: number },
) {
  const { tags, missing } = await resolveFilters(supabase, opts.filters);
  const empty = { members: [] as MemberCardData[], total: 0, tags, pageSize: PAGE_SIZE };
  if (missing) return empty;

  let ids: string[] | null = null;
  if (tags.length) {
    const { data } = await supabase.rpc("members_with_tags", { tag_ids: tags.map((t) => t.id) });
    ids = (data as string[] | null) ?? [];
    if (!ids.length) return empty;
  }

  let query = supabase
    .from("members")
    .select(
      "id,slug,full_name,headline,avatar_url,current_country,location:tags!members_location_tag_id_fkey(name,slug)",
      { count: "exact" },
    )
    .eq("status", "verified")
    .eq("public_profile", true);
  if (ids) query = query.in("id", ids);
  if (opts.q) {
    const term = fold(opts.q).replace(/[%_,()\\]/g, " ").trim();
    if (term) query = query.ilike("search_text", `%${term}%`);
  }
  const from = (opts.page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("full_name").range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as any[];
  return { members: await attachCardData(supabase, rows), total: count ?? 0, tags, pageSize: PAGE_SIZE };
}

export async function attachCardData(supabase: SupabaseClient, rows: any[]): Promise<MemberCardData[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [pos, edu] = await Promise.all([
    supabase.from("positions").select(POSITIONS).in("member_id", ids).order("is_current", { ascending: false }),
    supabase.from("education").select(EDUCATION).in("member_id", ids),
  ]);
  return rows.map((r) => {
    const p = (pos.data as any[] | null)?.find((x) => x.member_id === r.id);
    const e = (edu.data as any[] | null)?.find((x) => x.member_id === r.id);
    return {
      id: r.id, slug: r.slug, full_name: r.full_name, headline: r.headline, avatar_url: r.avatar_url,
      location: r.location ?? null, current_country: r.current_country,
      position: p ? { company: p.company, job: p.job } : null,
      school: e?.school ?? null,
    };
  });
}

export type Facet = { kind: TagKind; name: string; slug: string; member_count: number };

/** Most-used tags per kind, for the filter sidebar. */
export async function topFacets(supabase: SupabaseClient, perKind = 10) {
  const { data } = await supabase
    .from("tag_stats").select("kind,name,slug,member_count")
    .gt("member_count", 0).order("member_count", { ascending: false }).limit(300);
  const out: Partial<Record<TagKind, Facet[]>> = {};
  for (const f of (data ?? []) as Facet[]) {
    const list = (out[f.kind] ??= []);
    if (list.length < perKind) list.push(f);
  }
  return out;
}
