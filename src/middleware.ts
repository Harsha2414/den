import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, shortSessionExpired, withRemember } from "@/lib/remember";

const PUBLIC_PATHS = ["/welcome", "/opengraph-image", "/twitter-image", "/login", "/auth", "/privacy", "/terms", "/guidelines"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, withRemember(options, request.cookies.get(REMEMBER_COOKIE)?.value)));
        },
      },
    },
  );

  const path = request.nextUrl.pathname;
  // "Keep me signed in" was not ticked and 12 hours have passed: sign out on this device.
  if (shortSessionExpired(request.cookies.get(REMEMBER_COOKIE)?.value) && !path.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login"; url.search = "?expired=1";
    const out = NextResponse.redirect(url);
    request.cookies.getAll().filter((c) => c.name.startsWith("sb-")).forEach((c) => out.cookies.set(c.name, "", { path: "/", maxAge: 0 }));
    out.cookies.set(REMEMBER_COOKIE, "", { path: "/", maxAge: 0 });
    return out;
  }

  const { data } = await supabase.auth.getUser();
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  // Signed-out visitors to the home address see the landing page (the address stays "/").
  if (!data.user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    const page = NextResponse.rewrite(url, { request });
    response.cookies.getAll().forEach((c) => page.cookies.set(c));
    return page;
  }
  if (data.user && path === "/welcome") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!data.user && !isPublic && !path.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were going (a shared event or post link), so sign-in can bring them back.
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|data/|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
