"use client";
/** Print, or "Save as PDF" in the print window, to share a document outside Den Admin. */
export default function PrintButton() {
  return <button className="btn small" onClick={() => window.print()}>Print or save as PDF</button>;
}
