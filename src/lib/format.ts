export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export const isUrl = (u: string | null | undefined) => /^https?:\/\//i.test(u || "");

export const rupees = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

export const YEARS = ["1st year", "2nd year", "3rd year", "4th year", "5th year", "Postgrad", "Alumni"] as const;

/** Same rule as public.is_academic_email in the database (minus admin-added domains). */
export const looksAcademic = (email: string) =>
  /(^|\.)(ac\.in|edu\.in|edu)$/i.test(email.split("@")[1] || "");

export const AUTHOR_COLS = "id,name,branch,year,verified,college_id";

/** Turn a Supabase error into a sentence a student can act on. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined, fallback = "Something went wrong. Try again."): string {
  if (!e) return fallback;
  const m = e.message || "";
  if (/row-level security|permission denied/i.test(m)) return "You can't do that. If you haven't verified your student account yet, verify it first (menu → Get your blue tick).";
  if (/violates check constraint/i.test(m)) return "Some details are missing or too long. Check the form and try again.";
  if (/duplicate key/i.test(m)) return "That already exists.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
  if (m && m.length < 140 && !/[{}]/.test(m)) return m;
  return fallback;
}
