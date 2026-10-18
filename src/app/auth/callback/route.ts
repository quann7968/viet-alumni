import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

/** Magic-link landing: exchanges the code for a session, redeems an invite, then redirects. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const locale = p.get("locale") === "en" ? "en" : "vi";
  const code = p.get("code");
  const tokenHash = p.get("token_hash");
  const invite = (p.get("invite") ?? "").replace(/[^a-z0-9]/gi, "");
  const rawNext = p.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "";

  const supabase = await createClient();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash) ok = !(await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash })).error;
  if (!ok) return NextResponse.redirect(`${siteUrl}/${locale}/login?error=link`);

  if (invite) await supabase.rpc("redeem_invite", { p_code: invite });

  const { data: auth } = await supabase.auth.getUser();
  const { data: member } = auth.user
    ? await supabase.from("members").select("slug_locked").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  // First-time users land on the profile editor.
  const dest = member && !member.slug_locked ? "/profile/edit" : next || "/";
  return NextResponse.redirect(`${siteUrl}/${locale}${dest === "/" ? "" : dest}`);
}
