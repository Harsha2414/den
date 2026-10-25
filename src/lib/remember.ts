/**
 * "Keep me signed in" on the sign-in page.
 * Ticked: Den remembers the sign-in on this device (the usual long-lived login).
 * Not ticked: the sign-in lasts until the browser is closed, and at most 12 hours.
 */
export const REMEMBER_COOKIE = "den_remember";
export const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;

type CookieOpts = { maxAge?: number; expires?: Date | string | number; [k: string]: unknown };

/** "1" = remember. "0:<time signed in>" = this browser session only. */
export function readRemember(raw: string | undefined | null): { remember: boolean; since: number } {
  if (!raw || raw === "1") return { remember: true, since: 0 };
  const [flag, at] = decodeURIComponent(raw).split(":");
  return flag === "0" ? { remember: false, since: Number(at) || 0 } : { remember: true, since: 0 };
}

/** For a session-only sign-in, drop the lifetime so the browser forgets the login cookie when it closes. */
export function withRemember<T extends CookieOpts | undefined>(options: T, raw: string | undefined | null): T {
  if (!options || readRemember(raw).remember) return options;
  const { maxAge: _m, expires: _e, ...rest } = options as CookieOpts;
  void _m; void _e;
  return rest as T;
}

/** A short sign-in that has outlived 12 hours should end, even if the browser kept its cookies. */
export function shortSessionExpired(raw: string | undefined | null, now = Date.now()) {
  const r = readRemember(raw);
  return !r.remember && r.since > 0 && now - r.since > SHORT_SESSION_MS;
}

/** Called on the sign-in page, before sending the student to Google or checking the email code. */
export function setRememberChoice(remember: boolean) {
  document.cookie = remember
    ? `${REMEMBER_COOKIE}=1; path=/; max-age=${400 * 24 * 3600}; samesite=lax`
    : `${REMEMBER_COOKIE}=${encodeURIComponent(`0:${Date.now()}`)}; path=/; samesite=lax`;
}

export function clearRememberChoice() {
  document.cookie = `${REMEMBER_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
