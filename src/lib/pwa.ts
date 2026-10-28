"use client";
/** "Install Den": the browser's install prompt (Android, Chrome, Edge), kept for when the student taps Install. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((f) => f()); });
}

export const canPrompt = () => !!deferred;
export const onInstallChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const isInstalled = () => typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; listeners.forEach((f) => f());
  return outcome;
}

/** Register the service worker (live site only, so local testing never gets cached files). */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
  if (location.hostname === "localhost" && !location.search.includes("sw=1")) return;
  const go = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* not critical */ }); };
  // React runs this after the page has loaded, so register straight away in that case.
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
}
