import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";

export type Viewer = {
  id: string;
  email: string | undefined;
  member: {
    id: string; slug: string; full_name: string; status: string; role: string;
    avatar_url: string | null; headline: string; slug_locked: boolean;
  } | null;
};

/** Current signed-in user + their member row (null when anonymous). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const { data: member } = await supabase
      .from("members")
      .select("id,slug,full_name,status,role,avatar_url,headline,slug_locked")
      .eq("id", data.user.id)
      .maybeSingle();
    return { id: data.user.id, email: data.user.email, member };
  } catch {
    return null;
  }
});

export async function requireViewer(locale: string, next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale });
  return viewer!;
}

export async function requireAdmin(locale: string): Promise<Viewer> {
  const viewer = await requireViewer(locale, "/admin");
  if (viewer.member?.role !== "admin") redirect({ href: "/", locale });
  return viewer;
}
