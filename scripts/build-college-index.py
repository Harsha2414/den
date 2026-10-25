"""Build the small college list the app searches on the phone (public/data/colleges-v1.json).

Input: admin/public/data/aishe-colleges.json (made by prepare-colleges.py).
Output: {"v":1, "states":[...], "rows":[[code, name, district, state_index, short_names, featured], ...]}
Short names (joined with "|") are only the short forms (IITB, DU, NIT Trichy), not long alternative names, to keep the file small.
"""
import json, sys

src = sys.argv[1] if len(sys.argv) > 1 else "admin/public/data/aishe-colleges.json"
dst = sys.argv[2] if len(sys.argv) > 2 else "public/data/colleges-v1.json"
rows = json.load(open(src))
states = sorted({r[3] for r in rows})
si = {s: i for i, s in enumerate(states)}
out = []
for code, name, district, state, kind, aliases, featured in rows:
    short = "|".join(a for a in aliases if len(a) <= 18)
    row = [code, name, district, si[state]]
    if short or featured:
        row.append(short)
    if featured:
        row.append(1)
    out.append(row)
json.dump({"v": 1, "states": states, "rows": out}, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "colleges")
