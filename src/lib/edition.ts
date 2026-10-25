/** Cookie that carries the college a visitor picked on the landing page ("Pick your edition") into sign-up. */
export const EDITION_COOKIE = "den_edition";

export type Edition = { id: string; name: string };

export function writeEditionCookie(e: Edition | null) {
  document.cookie = e
    ? `${EDITION_COOKIE}=${encodeURIComponent(JSON.stringify({ id: e.id, name: e.name }))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    : `${EDITION_COOKIE}=; path=/; max-age=0`;
}

export function readEditionCookie(raw: string | undefined | null): Edition | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    if (v && typeof v.id === "string" && typeof v.name === "string" && /^[a-z0-9-]{2,60}$/.test(v.id)) return { id: v.id, name: v.name.slice(0, 200) };
  } catch { /* an old or broken cookie */ }
  return null;
}
