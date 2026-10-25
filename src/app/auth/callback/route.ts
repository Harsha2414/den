import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // The sign-in page saves where the student was headed in a short-lived cookie.
      const res = NextResponse.redirect(`${origin}${safeNext(readNext(request.cookies.get("den_next")?.value))}`);
      res.cookies.set("den_next", "", { path: "/", maxAge: 0 });
      return res;
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}

function readNext(v?: string) {
  try { return v ? decodeURIComponent(v) : undefined; } catch { return undefined; }
}
