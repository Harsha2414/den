import { ImageResponse } from "next/og";

// The picture WhatsApp, Instagram and others show when someone shares a Den link.
export const alt = "Den: the student hangout for every college in India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Den's display font (Bricolage Grotesque, extra bold). If it can't be fetched, the image still renders in a plain font.
async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800")).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch { return null; }
}

export default async function OgImage() {
  const font = await displayFont();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0E5E6F", color: "#fff", padding: "72px 80px", position: "relative", fontFamily: font ? "Bricolage" : "sans-serif" }}>
        <div style={{ position: "absolute", right: -110, bottom: -110, width: 380, height: 380, borderRadius: 999, border: "44px solid #F4A340", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 120, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>
          Den<span style={{ color: "#F4A340" }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, maxWidth: 860 }}>The student hangout for every college in India.</div>
          <div style={{ fontSize: 30, opacity: 0.85 }}>Notes · PYQs · Placements · Events · Voice Spaces</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Bricolage", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
