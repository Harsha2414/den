import type { Metadata } from "next";
import Landing from "@/components/Landing";

export const metadata: Metadata = {
  title: "Den: the student hangout for every college in India",
  description: "Notes and PYQs, placement stories, events with QR passes, voice Spaces, live debates and messages. Every college in India gets its own home on Den. Free, students only.",
};

/** Signed-out visitors to "/" see this page (the middleware shows it in place of the app). */
export default function Welcome() {
  return <Landing />;
}
