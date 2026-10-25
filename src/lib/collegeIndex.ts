/**
 * Instant college search on the phone.
 *
 * The full India list (about 70,000 colleges, ~1 MB compressed) is downloaded once, the first time a student taps a
 * college search box, and then cached by the browser. Searching it takes a few milliseconds, so results show while
 * typing, even after two letters. Colleges added by students, and the student counts, come from /api/colleges/extra.
 * Until the list has loaded, CollegeSearch asks the database instead.
 * The list is built and searched in a background thread (collegeWorker.ts), so typing never stutters.
 */
import uFuzzy from "@leeoniya/ufuzzy";

export type IndexHit = { id: string; name: string; city: string; state: string; students: number };

type Row = [string, string, string, number, string?, number?];
type Extra = { aishe: number; remap: [string, string][]; extra: [string, string, string, string][]; counts: [string, number][] };

const LIST_URL = "/data/colleges-v1.json";

class CollegeIndex {
  private ids: string[] = [];
  private names: string[] = [];
  private lower: string[] = [];
  private cities: string[] = [];
  private states: string[] = [];
  private featured: Uint8Array;
  private hay: string[] = [];
  private alias = new Map<string, number[]>();
  private counts = new Map<string, number>();
  private uf = new uFuzzy({ intraMode: 1, intraIns: 1 });

  constructor(list: { states: string[]; rows: Row[] }, ex: Extra) {
    const remap = new Map(ex.remap);
    const n = list.rows.length + ex.extra.length;
    this.featured = new Uint8Array(n);
    const add = (id: string, name: string, city: string, state: string, short: string, featured: boolean) => {
      const i = this.ids.length;
      this.ids.push(id); this.names.push(name); this.lower.push(name.toLowerCase());
      this.cities.push(city); this.states.push(state);
      if (featured) this.featured[i] = 1;
      const shorts = short ? short.split("|") : [];
      for (const a of shorts) { const l = this.alias.get(a); if (l) l.push(i); else this.alias.set(a, [i]); }
      // What a student might type: the name with and without punctuation, the place, and short names.
      const plain = name.replace(/[^A-Za-z0-9 ]+/g, " ");
      this.hay.push(`${name} ${plain} ${city} ${state} ${shorts.join(" ")}${/government/i.test(name) ? " govt" : ""}${/engineering/i.test(name) ? " engg" : ""}`.toLowerCase());
    };
    for (const [code, name, district, si, short = "", feat = 0] of list.rows) {
      add(remap.get(code) || `aishe-${code.toLowerCase()}`, name, district, list.states[si] || "", short, feat === 1);
    }
    for (const [id, name, city, state] of ex.extra) add(id, name, city, state, "", false);
    this.counts = new Map(ex.counts);
  }

  get size() { return this.ids.length; }

  search(query: string, lim = 8): IndexHit[] {
    const q = query.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (q.length < 2) return [];
    const words = q.split(" ");
    // Every word must appear (in any order). uFuzzy also forgives one typo per word ("enginering").
    let idxs: number[] | null = null;
    for (const w of words) {
      const found = this.uf.filter(this.hay, w) || [];
      if (idxs === null) idxs = found;
      else { const set = new Set(found); idxs = idxs.filter((i) => set.has(i)); }
      if (!idxs.length) break;
    }
    const exact = this.alias.get(q) || [];
    const pool = new Set([...(idxs || []), ...exact]);
    const first = words[0];
    const wordStart = new RegExp(`(^|[^a-z0-9])${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    const scored: [number, number][] = [];
    pool.forEach((i) => {
      const nm = this.lower[i];
      let s = 0;
      const isExact = exact.includes(i);
      // A typed short name ("iitb", "vit") counts most for well-known colleges; very short ones ("cv") count less.
      if (isExact) s += this.featured[i] ? 1600 : q.length <= 3 ? 350 : 800;
      else if (this.featured[i]) s += 300;
      s += Math.min(this.counts.get(this.ids[i]) || 0, 500);
      if (nm.startsWith(q)) s += 400;
      else if (nm.includes(q)) s += 150;
      if (wordStart.test(nm)) s += 200;
      if (!this.hay[i].includes(first)) s -= 120; // matched only with a typo
      s -= nm.length * 0.4;
      scored.push([s, i]);
    });
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, lim).map(([, i]) => ({ id: this.ids[i], name: this.names[i], city: this.cities[i], state: this.states[i], students: this.counts.get(this.ids[i]) || 0 }));
  }
}

export { CollegeIndex };
export type { Row, Extra };
export const COLLEGE_LIST_URL = LIST_URL;
