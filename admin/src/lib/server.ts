import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* server component */ } },
    },
  });
}

/** Optional extra lock: a comma-separated list of admin emails in ADMIN_EMAILS. */
export function emailAllowed(email: string | undefined | null) {
  const list = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !list.length || (!!email && list.includes(email.toLowerCase()));
}

/**
 * True only for a signed-in Den admin. The panel layout already shows "not an admin" to everyone else,
 * but Next.js renders pages alongside their layout, so server pages with private content check again.
 */
export async function isAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !emailAllowed(user.email)) return false;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle<{ is_admin: boolean }>();
  return !!data?.is_admin;
}
