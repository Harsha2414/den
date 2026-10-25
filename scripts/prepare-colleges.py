"""Turn the AISHE institutions list into Den's college list.

Source: github.com/BrahmjotSingh0/aishe-institutions-list (MIT), data from dashboard.aishe.gov.in/hedirectory.
Run:  python3 -I scripts/prepare-colleges.py <institutions.json> admin/public/data/aishe-colleges.json
Output rows: [aishe_code, name, district, state, kind, aliases, featured (1 = a well-known national institute)]
"""
import json, re, sys

SMALL = {"of", "and", "the", "for", "in", "at", "to", "by", "on", "&"}
ACRONYMS = {"IIT", "NIT", "IIIT", "IIM", "IISC", "IISER", "AIIMS", "BITS", "VIT", "SRM", "KIIT", "MIT", "PES", "RV", "BMS", "JNTU",
            "BHU", "AMU", "JNU", "DAV", "SVKM", "NMIMS", "MGM", "KLE", "JSS", "NSS", "SNDT", "ITI", "ICFAI", "LPU", "GLA", "ABES", "KIET",
            "IMS", "IPS", "SGT", "GD", "MS", "SR", "KL", "RNS", "BNM", "CMR", "MVJ", "PSG", "SSN", "NIFT", "NID", "IIFT", "XLRI", "TISS",
            "ISBM", "NCERT", "SCERT", "DIET", "ANM", "GNM", "BSC", "MSC", "BBA", "MBA", "MCA", "BCA", "BHMS", "BAMS", "BUMS", "LLB",
            "PG", "UG", "IT", "CSE", "ECE", "EEE", "ME", "SVU", "DDU", "MDU", "CCS", "RTM", "SPPU", "GTU", "AKTU", "RGPV", "VTU", "KTU", "IGNOU"}
ROMAN = re.compile(r"^(I|II|III|IV|V|VI|VII|VIII|IX|X)$")

def fix_word(w, first):
    core = w.strip("(),.-/'\"")
    if not core:
        return w
    up = core.upper()
    if up in ACRONYMS or ROMAN.match(up) or (len(core) <= 4 and not re.search(r"[AEIOUY]", up) and core.isalpha()):
        return w.upper()
    if "." in core and len(core) <= 8:  # B.ED, D.EL.ED, DR., GOVT.
        return ".".join(p[:1].upper() + p[1:].lower() for p in w.split("."))
    low = w.lower()
    if not first and low in SMALL:
        return low
    # Capitalise after a leading bracket/quote, and after hyphens/apostrophes inside a word
    out = re.sub(r"(^|[-(/])([a-z])", lambda m: m.group(1) + m.group(2).upper(), low)
    return out

def tidy(name):
    n = re.sub(r"\s+", " ", name).strip().strip(",")
    n = re.sub(r"\s*,\s*", ", ", n)
    n = re.sub(r"\(\s*", "(", n); n = re.sub(r"\s*\)", ")", n)
    letters = [c for c in n if c.isalpha()]
    upper_share = sum(c.isupper() for c in letters) / max(1, len(letters))
    if upper_share > 0.75:  # ALL CAPS: make it Title Case, keeping acronyms and bracketed short forms
        parts = re.split(r"(\([^)]*\))", n)
        fixed = []
        for p in parts:
            if p.startswith("(") and p.endswith(")") and len(p) <= 14:
                fixed.append(p.upper())
            else:
                ws = p.split(" ")
                fixed.append(" ".join(fix_word(w, i == 0 and not fixed) for i, w in enumerate(ws)))
        n = "".join(fixed)
    return n[:200]

STOP = {"of", "and", "the", "for", "in", "at", "&", "-", "to"}
def initials(name):
    base = re.split(r"[,(]", name)[0]
    words = [w for w in re.split(r"[\s\-/]+", base) if w and w.lower() not in STOP]
    if len(words) < 2:
        return None
    s = "".join(w[0] for w in words if w[0].isalnum()).lower()
    return s if 2 <= len(s) <= 8 else None

# Well-known short names, matched on the cleaned name (lowercase contains).
FAMOUS = [
    ("indian institute of technology bombay", ["iitb", "iit bombay", "iit mumbai"]),
    ("indian institute of technology delhi", ["iitd", "iit delhi"]),
    ("indian institute of technology madras", ["iitm", "iit madras", "iit chennai"]),
    ("indian institute of technology kanpur", ["iitk", "iit kanpur"]),
    ("indian institute of technology kharagpur", ["iitkgp", "iit kharagpur", "kgp"]),
    ("indian institute of technology roorkee", ["iitr", "iit roorkee"]),
    ("indian institute of technology guwahati", ["iitg", "iit guwahati"]),
    ("indian institute of technology hyderabad", ["iith", "iit hyderabad"]),
    ("indian institute of technology (banaras hindu university)", ["iit bhu", "iitbhu"]),
    ("indian institute of science", ["iisc", "iisc bangalore"]),
    ("university of delhi", ["du", "delhi university"]),
    ("jawaharlal nehru university", ["jnu"]),
    ("banaras hindu university", ["bhu"]),
    ("aligarh muslim university", ["amu"]),
    ("jamia millia islamia", ["jmi", "jamia"]),
    ("jadavpur university", ["ju", "jadavpur"]),
    ("birla institute of technology and science pilani", ["bits", "bits pilani"]),
    ("vellore institute of technology vellore", ["vit", "vit vellore"]),
    ("srm institute of science and technology", ["srm", "srmist"]),
    ("manipal academy of higher education", ["manipal", "mahe", "mit manipal"]),
    ("anna university", ["au"]),
    ("osmania university", ["ou", "osmania"]),
    ("university of mumbai", ["mu", "mumbai university"]),
    ("savitribai phule pune university", ["sppu", "pune university"]),
    ("university of calcutta", ["cu", "calcutta university"]),
    ("national institute of technology tiruchirappalli", ["nitt", "nit trichy"]),
    ("national institute of technology karnataka", ["nitk", "nit surathkal"]),
    ("national institute of technology warangal", ["nitw", "nit warangal"]),
    ("national institute of technology calicut", ["nitc", "nit calicut"]),
    ("national institute of technology rourkela", ["nitr", "nit rourkela"]),
    ("delhi technological university", ["dtu", "dce"]),
    ("netaji subhas university of technology", ["nsut", "nsit"]),
    ("all india institute of medical sciences new delhi", ["aiims", "aiims delhi"]),
    ("lovely professional university", ["lpu"]),
    ("amity university", ["amity"]),
    ("christ university", ["christ"]),
    ("kalinga institute of industrial technology", ["kiit"]),
    ("indian statistical institute", ["isi"]),
    ("tata institute of social sciences", ["tiss"]),
]

KIND = {"U": "university", "C": "college", "S": "standalone"}

def main(src, dst):
    rows = json.load(open(src))
    groups = {}
    for r in rows:
        code = r["aishe_code"].strip().upper()
        k = KIND.get(code.split("-")[0])
        if not k:
            continue  # R- research centres are not student colleges
        groups.setdefault(code, []).append({"name": tidy(r["name"]), "district": (r.get("district") or "").strip()[:60], "state": (r.get("state") or "").strip()[:60], "kind": k})
    best = {}
    for code, g in groups.items():
        # A code listed twice usually has a better-known name on the copy without a district
        # ("Indian Institute of Technology Bombay" vs "Indian Institute of Technology, Mumbai").
        named = [x for x in g if not x["district"]] or g
        name = max(named, key=lambda x: len(x["name"]))["name"]
        district = next((x["district"] for x in g if x["district"]), "")
        others = sorted({x["name"].lower() for x in g if x["name"].lower() != name.lower()})
        best[code] = {"code": code, "name": name, "district": district, "state": g[0]["state"], "kind": g[0]["kind"], "other": others}
    out = []
    for c in best.values():
        lname = c["name"].lower()
        al = set()
        famous = 0
        ini = initials(c["name"])
        famous_family = re.match(r"(indian institute of|national institute of technology)", lname)
        if ini and c["kind"] == "university" and not famous_family:
            al.add(ini)
        al.update(c["other"])
        for m in re.findall(r"\(([A-Za-z.\- ]{2,12})\)", c["name"]):
            al.add(m.replace(".", "").replace(" ", "").lower())
        m = re.match(r"(indian institute of technology|national institute of technology|indian institute of information technology|indian institute of management|indian institute of science education and research)[ ,]+(.+)", lname)
        if m:
            famous = 1
            short = {"indian institute of technology": "iit", "national institute of technology": "nit", "indian institute of information technology": "iiit", "indian institute of management": "iim", "indian institute of science education and research": "iiser"}[m.group(1)]
            place = re.split(r"[,(]", m.group(2))[0].strip()
            if place:
                al.add(f"{short} {place}")
            al.add(short)
        flats = [re.sub(r"[^a-z0-9]", "", x) for x in [lname, *c["other"]]]
        for key, names in FAMOUS:
            k = re.sub(r"[^a-z0-9]", "", key)
            if any(f == k or (f.startswith(k) and c["kind"] == "university" and len(f) - len(k) <= 12) for f in flats):
                al.update(names); famous = 1
        al = sorted(a for a in al if a and a != lname)[:10]
        out.append([c["code"], c["name"], c["district"], c["state"], c["kind"], al, famous])
    out.sort(key=lambda r: (r[3], r[1]))
    json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
    print(len(rows), "in →", len(out), "out")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
