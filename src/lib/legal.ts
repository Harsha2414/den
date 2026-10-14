/**
 * Details shown on the Privacy Policy, Terms and Guidelines pages.
 * Fill these in from Vercel > Settings > Environment Variables (then redeploy),
 * so you never need to edit code to change them.
 */
export const LEGAL = {
  appName: "Den",
  operator: process.env.NEXT_PUBLIC_LEGAL_OPERATOR || "[Operator name — set NEXT_PUBLIC_LEGAL_OPERATOR]",
  city: process.env.NEXT_PUBLIC_LEGAL_CITY || "[City, State — set NEXT_PUBLIC_LEGAL_CITY]",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[contact email — set NEXT_PUBLIC_CONTACT_EMAIL]",
  grievanceOfficer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || "[Grievance Officer name — set NEXT_PUBLIC_GRIEVANCE_OFFICER]",
  grievanceEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || "[grievance email — set NEXT_PUBLIC_GRIEVANCE_EMAIL]",
  effectiveDate: "14 October 2026",
  minimumAge: 18,
};

export const legalConfigured = () =>
  !!(process.env.NEXT_PUBLIC_LEGAL_OPERATOR && process.env.NEXT_PUBLIC_CONTACT_EMAIL &&
     process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER && process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL);
