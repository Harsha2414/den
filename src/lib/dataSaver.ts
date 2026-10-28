"use client";
import { useSyncExternalStore } from "react";

/** Data saver: photos load only when tapped. On by default when the phone asks to save data. */
const KEY = "den_datasaver";
const EVT = "den:datasaver";

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* storage unavailable */ }
  return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
}

export function setDataSaver(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVT));
}

export function useDataSaver(): boolean {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; },
    read,
    () => false,
  );
}
