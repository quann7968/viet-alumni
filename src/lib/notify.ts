import { createAdminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

/** Best-effort email via Resend. Silently skipped when not configured. */
export async function sendEmail(toMemberId: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const admin = createAdminClient();
  if (!key || !admin) return;
  try {
    const { data } = await admin.auth.admin.getUserById(toMemberId);
    const to = data.user?.email;
    if (!to) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Alumni Connect <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("sendEmail failed", e);
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const connectionsUrl = (locale: string) => `${siteUrl}/${locale}/connections`;
