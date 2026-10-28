import type { MetadataRoute } from "next";

/** Lets phones add Den to the home screen as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Den: the student hangout for every college in India",
    short_name: "Den",
    description: "Your college's posts, notes, events, messages and live Spaces.",
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0E5E6F",
    categories: ["social", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
