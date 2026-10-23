"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { THEME_KEY as KEY } from "@/lib/theme";
type Theme = "light" | "dark";

/** What the page looks like right now: the student's pick, or the phone's setting. */
function current(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-fade");
  root.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* storage unavailable: still works until reload */ }
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", t === "dark" ? "#0F171D" : "#FFFFFF"));
  window.setTimeout(() => root.classList.remove("theme-fade"), 350);
}

/** A row with a switch: Dark mode on/off. */
export default function ThemeToggle({ className = "side-link" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    setTheme(current());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(current());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const dark = theme === "dark";
  return (
    <button type="button" role="switch" aria-checked={dark} className={`${className} theme-row`}
      onClick={() => { const next = dark ? "light" : "dark"; applyTheme(next); setTheme(next); }}>
      <Icon name={dark ? "moon" : "sun"} size={21} />
      <span>Dark mode</span>
      <span className={`switch ${dark ? "on" : ""}`} aria-hidden="true" />
    </button>
  );
}
