import { ImageResponse } from "next/og";

// The picture WhatsApp, Instagram and others show when someone shares a Den link: Den's newspaper front page.
export const alt = "Den: every campus in India now has a home of its own";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fonts come from Google Fonts at build time. If they can't be fetched, the image still renders in a plain font.
async function font(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch { return null; }
}

const HEAD = "Every campus in India now has a home of its own.";
const STRIP = "VOL. I · ALL INDIA EDITION · FREE FOR EVERY STUDENT";
const DECK = "Notes · PYQs · Placements · Events · Voice Spaces";
const PEN = "students only!";

export default async function OgImage() {
  const [serif, serifReg, hand] = await Promise.all([
    font("Fraunces:wght@900", "Den.PASSED" + HEAD),
    font("Fraunces:wght@400", STRIP + DECK),
    font("Kalam:wght@700", PEN),
  ]);
  const fonts = [
    serif && { name: "Serif", data: serif, weight: 900 as const, style: "normal" as const },
    serifReg && { name: "Serif", data: serifReg, weight: 400 as const, style: "normal" as const },
    hand && { name: "Hand", data: hand, weight: 700 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 900; style: "normal" }[];
  const ink = "#1B1A17";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#F4EFE4", color: ink, padding: "36px 64px", fontFamily: serif ? "Serif" : "serif", position: "relative" }}>
        <div style={{ position: "absolute", left: 40, top: 30, width: 130, height: 130, borderRadius: 999, border: "10px solid rgba(150,100,40,.16)", display: "flex" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, letterSpacing: 2, color: "#5B574D", borderBottom: `2px solid ${ink}`, paddingBottom: 10 }}>
          <span>{STRIP}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", fontSize: 150, fontWeight: 900, letterSpacing: -6, lineHeight: 1, marginTop: 18 }}>
          Den<span style={{ color: "#E08A1E" }}>.</span>
        </div>
        <div style={{ display: "flex", height: 2, background: ink, marginTop: 18 }} />
        <div style={{ display: "flex", height: 2, background: ink, marginTop: 4 }} />
        <div style={{ display: "flex", paddingTop: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: -2, lineHeight: 1.08, maxWidth: 1000 }}>{HEAD}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <span style={{ fontSize: 28, color: "#5B574D", fontWeight: 400 }}>{DECK}</span>
              <span style={{ fontSize: 34, color: "#1E3A9E", fontFamily: hand ? "Hand" : "serif", transform: "rotate(-4deg)" }}>{PEN}</span>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", right: 70, bottom: 54, display: "flex", flexDirection: "column", alignItems: "center", border: "6px solid #B42D38", color: "#B42D38", borderRadius: 14, padding: "6px 20px", transform: "rotate(-12deg)" }}>
          <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: 4 }}>PASSED</span>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
