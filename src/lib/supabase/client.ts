"use client";
import { createBrowserClient } from "@supabase/ssr";
import { REMEMBER_COOKIE, withRemember } from "@/lib/remember";

let client: ReturnType<typeof createBrowserClient> | null = null;

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return m ? m[1] : undefined;
}

type Opts = { path?: string; domain?: string; maxAge?: number; expires?: Date; sameSite?: string | boolean; secure?: boolean };
function writeCookie(name: string, value: string, o: Opts = {}) {
  let s = `${name}=${encodeURIComponent(value)}; path=${o.path || "/"}`;
  if (o.domain) s += `; domain=${o.domain}`;
  if (typeof o.maxAge === "number") s += `; max-age=${Math.floor(o.maxAge)}`;
  if (o.expires) s += `; expires=${new Date(o.expires).toUTCString()}`;
  const ss = o.sameSite === true ? "strict" : o.sameSite || "lax";
  s += `; samesite=${ss}`;
  if (o.secure || location.protocol === "https:") s += "; secure";
  document.cookie = s;
}

export function supabaseBrowser() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => document.cookie.split("; ").filter(Boolean).map((c) => {
            const i = c.indexOf("=");
            const raw = c.slice(i + 1);
            let value = raw;
            try { value = decodeURIComponent(raw); } catch { /* leave as is */ }
            return { name: c.slice(0, i), value };
          }),
          // Respect "Keep me signed in": a session-only sign-in gets cookies that end when the browser closes.
          setAll: (list) => list.forEach(({ name, value, options }) =>
            writeCookie(name, value, withRemember(options as Opts, readCookie(REMEMBER_COOKIE)))),
        },
      },
    );
  }
  return client;
}
