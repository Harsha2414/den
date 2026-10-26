import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // The sign-in page saves where the student was headed in a short-lived cookie.
      const res = NextResponse.redirect(`${origin}${safeNext(readNext(request.cookies.get("den_next")?.value))}`);
      // Pressed "Sign up with Google" but already had a Den account: the app says so on the next page.
      if (request.cookies.get("den_auth_mode")?.value === "signup" && data.user) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
        if (profile) res.cookies.set("den_existing", "1", { path: "/", maxAge: 120, sameSite: "lax" });
      }
      res.cookies.set("den_next", "", { path: "/", maxAge: 0 });
      res.cookies.set("den_auth_mode", "", { path: "/", maxAge: 0 });
      return res;
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}

function readNext(v?: string) {
  try { return v ? decodeURIComponent(v) : undefined; } catch { return undefined; }
}
