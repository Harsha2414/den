import type { Metadata } from "next";
import Landing, { type EditionCollege } from "@/components/Landing";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Den: the student hangout for every college in India",
  description: "Notes and PYQs, placement stories, events with QR passes, voice Spaces, live debates and messages. Every college in India gets its own home on Den. Free, students only.",
};

// The college list changes rarely; rebuild this page at most once an hour.
export const revalidate = 3600;

async function loadColleges(): Promise<EditionCollege[]> {
  try {
    // Suggestions before typing: colleges that already have students. Typing searches all of India.
    const { data, error } = await supabaseAdmin().rpc("active_colleges");
    if (error) return [];
    return ((data || []) as EditionCollege[]).slice(0, 8);
  } catch {
    return [];
  }
}

/** Signed-out visitors to "/" see this page (the middleware shows it in place of the app). */
export default async function Welcome() {
  const colleges = await loadColleges();
  return (
    <>
      {/* The handwriting font is only needed on this page. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap" precedence="default" />
      <Landing colleges={colleges} />
    </>
  );
}
