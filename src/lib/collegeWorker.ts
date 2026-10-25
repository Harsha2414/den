/// <reference lib="webworker" />
// Background thread for instant college search: downloads the India list once, builds the index, answers searches.
import { CollegeIndex, COLLEGE_LIST_URL, type Extra } from "./collegeIndex";

let index: CollegeIndex | null = null;

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: "load"; origin: string } | { type: "search"; id: number; q: string; lim: number };
  if (m.type === "load") {
    try {
      const [list, ex] = await Promise.all([
        fetch(m.origin + COLLEGE_LIST_URL).then((r) => (r.ok ? r.json() : null)),
        fetch(m.origin + "/api/colleges/extra").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      // Until the India list is imported into the database, its colleges can't be chosen: keep asking the database.
      if (!list || !ex || (ex as Extra).aishe < 1000) { postMessage({ type: "ready", ok: false }); return; }
      index = new CollegeIndex(list, ex as Extra);
      postMessage({ type: "ready", ok: true });
    } catch {
      postMessage({ type: "ready", ok: false });
    }
  } else if (m.type === "search") {
    postMessage({ type: "result", id: m.id, hits: index ? index.search(m.q, m.lim) : null });
  }
};
