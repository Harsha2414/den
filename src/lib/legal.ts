/**
 * Details shown on the Privacy Policy, Terms and Guidelines pages.
 * Set them in Vercel > Settings > Environment Variables (Production and Preview), then redeploy.
 *
 * They're read when the page loads (not baked in at build time), using a dynamic key so
 * Next.js doesn't inline them. Extra spaces around values are ignored.
 */
const read = (key: string, fallback: string) => ((process.env as Record<string, string | undefined>)[key] || "").trim() || fallback;

export const LEGAL = {
  appName: "Den",
  get operator() { return read("NEXT_PUBLIC_LEGAL_OPERATOR", "[Operator name — set NEXT_PUBLIC_LEGAL_OPERATOR]"); },
  get city() { return read("NEXT_PUBLIC_LEGAL_CITY", "[City, State — set NEXT_PUBLIC_LEGAL_CITY]"); },
  get contactEmail() { return read("NEXT_PUBLIC_CONTACT_EMAIL", "[contact email — set NEXT_PUBLIC_CONTACT_EMAIL]"); },
  get grievanceOfficer() { return read("NEXT_PUBLIC_GRIEVANCE_OFFICER", "[Grievance Officer name — set NEXT_PUBLIC_GRIEVANCE_OFFICER]"); },
  get grievanceEmail() { return read("NEXT_PUBLIC_GRIEVANCE_EMAIL", "[grievance email — set NEXT_PUBLIC_GRIEVANCE_EMAIL]"); },
  effectiveDate: "14 October 2026",
  minimumAge: 18,
};
