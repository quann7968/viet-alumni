import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key";

/** Supabase client bound to the visitor's session cookie (RLS applies). */
export async function createClient() {
  const store = await cookies();
  return createServerClient(url(), anon(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component: middleware refreshes cookies instead */
        }
      },
    },
  });
}

/** Service-role client. Server only, bypasses RLS. Returns null when not configured. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createJsClient(url(), key, { auth: { persistSession: false } });
}
