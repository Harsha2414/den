"use client";
/**
 * Every common degree, branch and stream at Indian colleges (public/data/courses-v1.json, ~10 KB),
 * searched on the phone so results show as you type. "bachelors computer science" finds B.Tech CSE,
 * B.Sc Computer Science and BCA; "masters cs" finds M.Tech, M.Sc and MCA.
 */
import uFuzzy from "@leeoniya/ufuzzy";

type Row = [string, string, number];
let loading: Promise<Courses | null> | null = null;

const STOP = new Set(["in", "of", "and", "the", "with", "a", "&", "degree", "course", "my"]);
const SYN: Record<string, string> = { bachelors: "bachelor", masters: "master", engg: "engineering", eng: "engineering", comp: "computer", sci: "science", hons: "hons", honours: "hons", honors: "hons", phd: "phd", "ph.d": "phd", farm: "pharm", pharmacy: "pharm", bfarm: "bpharm", dfarm: "dpharm", mfarm: "mpharm", "b.farm": "bpharm", "d.farm": "dpharm" };

class Courses {
  private labels: string[];
  private hay: string[];
  private weight: number[];
  private lowerLabels: string[];
  private uf = new uFuzzy({ intraMode: 1, intraIns: 1 });
  constructor(rows: Row[]) {
    this.labels = rows.map((r) => r[0]);
    this.lowerLabels = this.labels.map((l) => l.toLowerCase());
    this.hay = rows.map((r) => `${r[0]} ${r[0].replace(/[.()]/g, "")} ${r[1]}`.toLowerCase());
    this.weight = rows.map((r) => r[2]);
  }
  search(query: string, lim = 8): string[] {
    // "b farm" → "bpharm", "b tech" → "btech", "m sc" → "msc"
    const joined = query.toLowerCase().replace(/\bfarm/g, "pharm")
      .replace(/\b([bmd])\.?\s+(tech|sc|com|ed|pharm|arch|des|voc|plan|phil|e|a)\b/g, "$1$2");
    const words = joined.replace(/[^a-z0-9.&+/ ]+/g, " ").split(/\s+/)
      .map((w) => SYN[w] || w.replace(/'s$/, "")).filter((w) => w && !STOP.has(w));
    if (!words.length || query.trim().length < 2) return [];
    let idxs: number[] | null = null;
    for (const w of words) {
      const found = this.uf.filter(this.hay, w.replace(/\./g, "")) || [];
      const set = new Set(found);
      idxs = idxs === null ? found : idxs.filter((i) => set.has(i));
      if (!idxs.length) return [];
    }
    const q = words.join(" ");
    const ranked = (idxs || [])
      .map((i) => {
        const l = this.lowerLabels[i];
        const flat = l.replace(/[.]/g, "");
        let s = this.weight[i] * 10;
        if (l.startsWith(q) || flat.startsWith(q)) s += 300;
        if (words.every((w) => l.includes(w) || flat.includes(w))) s += 60;
        if (l.includes("(")) s -= 80; // the plain branch before its specialisations
        s -= l.length * 0.5;
        return [s, i] as [number, number];
      })
      .sort((a, b) => b[0] - a[0]);
    // Show a mix of degrees: at most 3 from the same one (B.Tech, B.Sc, BCA...) unless nothing else matches.
    const out: number[] = [], per = new Map<string, number>(), spare: number[] = [];
    for (const [, i] of ranked) {
      const deg = this.lowerLabels[i].split(" ")[0];
      const n = per.get(deg) || 0;
      if (n < 3) { out.push(i); per.set(deg, n + 1); } else spare.push(i);
      if (out.length >= lim) break;
    }
    for (const i of spare) { if (out.length >= lim) break; out.push(i); }
    return out.map((i) => this.labels[i]);
  }
}

export function loadCourses(): Promise<Courses | null> {
  if (!loading) {
    loading = fetch("/data/courses-v1.json").then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? new Courses(j.rows as Row[]) : null))
      .catch(() => { loading = null; return null; });
  }
  return loading;
}
