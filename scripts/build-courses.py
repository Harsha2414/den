"""Build Den's list of degrees, branches and streams (public/data/courses-v1.json).

Covers the common programmes at Indian colleges: engineering (B.Tech/B.E./M.Tech/M.E./diploma), sciences, arts and
languages, commerce, management, computers, medicine and allied health, pharmacy, law, architecture and design,
education, media, agriculture, hospitality, social work, professional courses (CA/CS/CMA), vocational and PhD.
Students can still type their own if theirs isn't listed.

Run: python3 -I scripts/build-courses.py
Output: {"v":1,"rows":[[label, keywords, weight], ...]}   label <= 60 characters (the profile limit)
"""
import json

rows = {}  # label -> [keywords set, weight]


def add(label, kw="", w=0):
    label = " ".join(label.split())
    assert len(label) <= 60, label
    k = rows.setdefault(label, [set(), 0])
    k[0].update(x for x in kw.lower().split() if x)
    k[1] = max(k[1], w)


# ---------- degree words people type ----------
UG = "bachelor bachelors ug undergraduate degree"
PG = "master masters pg postgraduate post graduate"
DEG = {
    "B.Tech": "btech b.tech bachelor of technology engineering " + UG,
    "B.E.": "be b.e bachelor of engineering " + UG,
    "M.Tech": "mtech m.tech master of technology engineering " + PG,
    "M.E.": "me m.e master of engineering " + PG,
    "Diploma": "diploma polytechnic poly dme dece deee",
    "B.Sc": "bsc b.sc bachelor of science " + UG,
    "B.Sc (Hons)": "bsc hons honours honors bachelor of science " + UG,
    "M.Sc": "msc m.sc master of science " + PG,
    "B.A.": "ba b.a bachelor of arts " + UG,
    "B.A. (Hons)": "ba hons honours honors bachelor of arts " + UG,
    "M.A.": "ma m.a master of arts " + PG,
    "B.Com": "bcom b.com bachelor of commerce " + UG,
    "M.Com": "mcom m.com master of commerce " + PG,
    "BBA": "bba bachelor of business administration management " + UG,
    "MBA": "mba master of business administration management " + PG,
    "PGDM": "pgdm post graduate diploma in management mba " + PG,
    "PhD": "phd ph.d doctorate doctoral research doctor of philosophy",
    "M.Phil": "mphil m.phil master of philosophy research",
}

# ---------- engineering ----------
ENG = [
    ("Computer Science and Engineering", "cse cs computer science comp sci software coding", 10),
    ("CSE (Artificial Intelligence and Machine Learning)", "cse aiml ai ml artificial intelligence machine learning computer science", 8),
    ("CSE (Data Science)", "cse ds data science computer science", 8),
    ("CSE (Cyber Security)", "cse cyber security cs computer science", 6),
    ("CSE (Internet of Things)", "cse iot internet of things computer science", 5),
    ("Artificial Intelligence and Data Science", "ai ds aids artificial intelligence data science", 7),
    ("Artificial Intelligence and Machine Learning", "ai ml aiml artificial intelligence machine learning", 7),
    ("Computer Science and Business Systems", "csbs computer science business systems", 5),
    ("Computer Engineering", "ce computer engineering", 5),
    ("Information Technology", "it information technology", 9),
    ("Electronics and Communication Engineering", "ece ec electronics communication", 9),
    ("Electrical and Electronics Engineering", "eee electrical electronics", 8),
    ("Electrical Engineering", "ee electrical", 7),
    ("Electronics and Telecommunication Engineering", "entc etc extc electronics telecommunication", 6),
    ("Electronics and Instrumentation Engineering", "eie ei electronics instrumentation", 5),
    ("Electronics Engineering (VLSI Design)", "vlsi electronics chip design", 5),
    ("Instrumentation and Control Engineering", "ice instrumentation control", 4),
    ("Mechanical Engineering", "mech me mechanical", 9),
    ("Mechatronics Engineering", "mechatronics", 4),
    ("Robotics and Automation", "robotics automation rai", 4),
    ("Automobile Engineering", "auto automobile automotive", 4),
    ("Aeronautical Engineering", "aero aeronautical aviation", 5),
    ("Aerospace Engineering", "aerospace aero space", 5),
    ("Civil Engineering", "civil ce construction", 8),
    ("Environmental Engineering", "environmental", 3),
    ("Chemical Engineering", "chemical che", 6),
    ("Biotechnology", "biotech bt biotechnology", 6),
    ("Biomedical Engineering", "bme biomedical medical electronics", 4),
    ("Agricultural Engineering", "agri agricultural agriculture", 4),
    ("Food Technology", "food tech technology", 4),
    ("Dairy Technology", "dairy", 2),
    ("Textile Engineering", "textile", 3),
    ("Production Engineering", "production", 3),
    ("Industrial Engineering", "industrial ie", 3),
    ("Manufacturing Engineering", "manufacturing", 2),
    ("Metallurgical and Materials Engineering", "metallurgy metallurgical materials mme", 4),
    ("Mining Engineering", "mining", 3),
    ("Petroleum Engineering", "petroleum oil gas", 3),
    ("Marine Engineering", "marine ship merchant navy", 3),
    ("Naval Architecture and Ocean Engineering", "naval ocean ship", 2),
    ("Ceramic Engineering", "ceramic", 2),
    ("Polymer Engineering", "polymer plastics", 2),
    ("Printing Technology", "printing", 1),
    ("Engineering Physics", "ep engineering physics", 3),
    ("Software Engineering", "software se", 4),
    ("Geoinformatics", "geo gis remote sensing", 2),
    ("Fire and Safety Engineering", "fire safety", 2),
    ("Nanotechnology", "nano nanotechnology", 2),
    ("Energy Engineering", "energy renewable", 2),
    ("Pharmaceutical Engineering", "pharmaceutical", 1),
    ("Mathematics and Computing", "mnc math maths mathematics computing", 4),
]
MTECH_SPECS = [
    "Structural Engineering", "Transportation Engineering", "Geotechnical Engineering", "Water Resources Engineering",
    "Construction Engineering and Management", "VLSI Design", "Embedded Systems", "Power Systems", "Power Electronics",
    "Communication Systems", "Signal Processing", "Thermal Engineering", "Machine Design", "CAD/CAM",
    "Manufacturing Technology", "Industrial Safety", "Computer Networks", "Cloud Computing", "Data Science",
    "Artificial Intelligence", "Cyber Security", "Remote Sensing and GIS", "Environmental Engineering", "Energy Systems",
]
for name, kw, w in ENG:
    add(f"B.Tech {name}", DEG["B.Tech"] + " " + kw, w + 20)
    add(f"B.E. {name}", DEG["B.E."] + " " + kw, w + 12)
    add(f"M.Tech {name}", DEG["M.Tech"] + " " + kw, w + 4)
    if len(f"Diploma in {name}") <= 60:
        add(f"Diploma in {name}", DEG["Diploma"] + " " + kw, w + 2)
    add(f"PhD {name}", DEG["PhD"] + " " + kw, 0)
for s in MTECH_SPECS:
    add(f"M.Tech {s}", DEG["M.Tech"] + " " + s, 3)
    add(f"M.E. {s}", DEG["M.E."] + " " + s, 1)
add("B.Tech + M.Tech (Dual Degree)", "dual degree integrated btech mtech", 4)
add("BS (4-year) Data Science and Applications", "bs data science iit madras online degree", 4)
add("BS-MS (Integrated)", "bs ms bsms iiser integrated science", 3)

# ---------- sciences ----------
SCI = [
    ("Physics", "physics", 6), ("Chemistry", "chemistry", 6), ("Mathematics", "maths math mathematics", 6),
    ("Statistics", "stats statistics", 4), ("Computer Science", "cs computer science", 8), ("Information Technology", "it", 5),
    ("Data Science", "ds data science", 5), ("Artificial Intelligence", "ai", 3), ("Biotechnology", "biotech", 6),
    ("Microbiology", "micro microbiology", 5), ("Biochemistry", "biochem biochemistry", 4), ("Botany", "botany plants", 3),
    ("Zoology", "zoology", 3), ("Genetics", "genetics", 3), ("Life Sciences", "life science biology", 4),
    ("Environmental Science", "evs environment", 3), ("Geology", "geology earth", 3), ("Geography", "geography", 3),
    ("Electronics", "electronics", 3), ("Forensic Science", "forensic", 4), ("Food Science and Technology", "food", 3),
    ("Nutrition and Dietetics", "nutrition diet dietetics", 3), ("Home Science", "home science", 2),
    ("Psychology", "psychology", 4), ("Bioinformatics", "bioinformatics", 3), ("Biophysics", "biophysics", 1),
    ("Applied Physics", "applied physics", 1), ("Applied Chemistry", "applied chemistry", 1),
    ("Applied Mathematics", "applied maths", 1), ("Actuarial Science", "actuarial", 1), ("Cyber Security", "cyber", 2),
    ("Animation and Multimedia", "animation multimedia vfx", 3), ("Visual Communication", "viscom visual communication", 3),
    ("Interior Design", "interior", 2), ("Fashion Design", "fashion", 2), ("Marine Biology", "marine", 1),
    ("Anthropology", "anthropology", 1), ("Sports Science", "sports", 1), ("Earth Sciences", "earth", 1),
    ("Polymer Science", "polymer", 1), ("Electronics and Communication", "ece", 1),
]
for name, kw, w in SCI:
    add(f"B.Sc {name}", DEG["B.Sc"] + " " + kw, w + 12)
    add(f"M.Sc {name}", DEG["M.Sc"] + " " + kw, w + 3)
    add(f"PhD {name}", DEG["PhD"] + " " + kw, 0)
for name in ["Physics", "Chemistry", "Mathematics", "Statistics", "Computer Science", "Botany", "Zoology", "Microbiology", "Biochemistry", "Environmental Science", "Geology", "Electronics"]:
    add(f"B.Sc (Hons) {name}", DEG["B.Sc (Hons)"] + " " + name, 6)
# Subject combinations (common in AP, Telangana, Karnataka and other states)
for code, full in [("MPC", "Maths Physics Chemistry"), ("MPCs", "Maths Physics Computer Science"), ("MSCs", "Maths Statistics Computer Science"),
                   ("MECs", "Maths Electronics Computer Science"), ("BZC", "Botany Zoology Chemistry"), ("CBZ", "Chemistry Botany Zoology"),
                   ("PCM", "Physics Chemistry Maths"), ("PCB", "Physics Chemistry Biology"), ("PMCs", "Physics Maths Computer Science"),
                   ("MSDs", "Maths Statistics Data Science"), ("BBC", "Biotechnology Biochemistry Chemistry"), ("MBC", "Microbiology Biotechnology Chemistry")]:
    add(f"B.Sc {code} ({full})", DEG["B.Sc"] + " " + code + " " + full, 7)

# ---------- arts, languages, social sciences ----------
ARTS = [
    ("English", "english literature", 8), ("Hindi", "hindi", 3), ("Telugu", "telugu", 2), ("Tamil", "tamil", 2), ("Kannada", "kannada", 2),
    ("Malayalam", "malayalam", 2), ("Marathi", "marathi", 2), ("Bengali", "bengali bangla", 2), ("Gujarati", "gujarati", 1),
    ("Punjabi", "punjabi", 1), ("Odia", "odia oriya", 1), ("Urdu", "urdu", 1), ("Sanskrit", "sanskrit", 1), ("Assamese", "assamese", 1),
    ("French", "french", 1), ("German", "german", 1), ("Japanese", "japanese", 1), ("Spanish", "spanish", 1),
    ("Linguistics", "linguistics", 1), ("History", "history", 6), ("Political Science", "polsci pol sci politics political", 6),
    ("Economics", "eco economics", 7), ("Sociology", "sociology", 5), ("Psychology", "psychology", 6), ("Philosophy", "philosophy", 3),
    ("Geography", "geography", 3), ("Anthropology", "anthropology", 3), ("Public Administration", "public administration pub ad", 3),
    ("International Relations", "ir international relations", 3), ("Journalism and Mass Communication", "jmc journalism mass communication media", 6),
    ("Mass Communication", "mass comm media", 5), ("Journalism", "journalism", 3), ("Education", "education", 2),
    ("Music", "music", 2), ("Dance", "dance", 1), ("Theatre and Performing Arts", "theatre drama performing", 1),
    ("Archaeology", "archaeology", 1), ("Ancient Indian History", "ancient history", 1), ("Women's Studies", "women gender", 1),
    ("Development Studies", "development", 1), ("Rural Development", "rural", 1), ("Criminology", "criminology", 1),
    ("Defence and Strategic Studies", "defence", 1), ("Liberal Arts", "liberal arts", 4), ("Physical Education", "pe physical education sports", 2),
    ("Yoga", "yoga", 1), ("Film Studies", "film cinema", 1), ("Media Studies", "media", 1), ("Social Work", "social work", 2),
    ("Mathematics", "maths", 2), ("Statistics", "stats", 1), ("Comparative Literature", "literature", 1), ("Islamic Studies", "islamic", 1),
    ("Buddhist Studies", "buddhist", 1), ("Gandhian Studies", "gandhian", 1), ("Library Science", "library", 1), ("Home Science", "home science", 1),
]
for name, kw, w in ARTS:
    add(f"B.A. {name}", DEG["B.A."] + " " + kw, w + 10)
    add(f"M.A. {name}", DEG["M.A."] + " " + kw, w + 3)
    add(f"PhD {name}", DEG["PhD"] + " " + kw, 0)
for name in ["English", "History", "Political Science", "Economics", "Sociology", "Psychology", "Philosophy", "Geography", "Hindi", "Journalism"]:
    add(f"B.A. (Hons) {name}", DEG["B.A. (Hons)"] + " " + name, 6)
for code, full in [("HEP", "History Economics Politics"), ("HPS", "History Politics Sociology"), ("EPP", "Economics Politics Psychology"),
                   ("HEC", "History Economics Commerce"), ("JPE", "Journalism Psychology English")]:
    add(f"B.A. {code} ({full})", DEG["B.A."] + " " + code + " " + full, 5)
add("B.A. (General)", DEG["B.A."] + " general pass", 6)
add("B.Sc (General)", DEG["B.Sc"] + " general pass", 5)

# ---------- commerce ----------
add("B.Com", DEG["B.Com"] + " general", 18)
add("B.Com (Hons)", DEG["B.Com"] + " hons honours", 12)
for s, kw in [("Computer Applications", "ca computers"), ("Accounting and Finance", "accounts finance"), ("Banking and Insurance", "banking insurance"),
              ("Taxation", "tax"), ("Business Analytics", "analytics"), ("Professional (CA/CS/ACCA)", "professional ca cs acca"),
              ("International Business", "ib"), ("Corporate Secretaryship", "cs secretaryship"), ("Financial Markets", "markets stock")]:
    add(f"B.Com {s}", DEG["B.Com"] + " " + kw + " " + s, 8)
add("M.Com", DEG["M.Com"], 8)
add("M.Com Finance", DEG["M.Com"] + " finance", 3)
add("PhD Commerce", DEG["PhD"] + " commerce", 0)

# ---------- management ----------
add("BBA", DEG["BBA"] + " general", 16)
for s, kw in [("Business Analytics", "analytics"), ("Finance", "finance"), ("Marketing", "marketing"), ("Human Resources", "hr"),
              ("International Business", "ib"), ("Aviation Management", "aviation airport"), ("Hospital Management", "hospital healthcare"),
              ("Digital Marketing", "digital"), ("Logistics", "logistics supply chain"), ("Entrepreneurship", "startup entrepreneur")]:
    add(f"BBA {s}", DEG["BBA"] + " " + kw + " " + s, 6)
add("BMS (Bachelor of Management Studies)", "bms management studies " + UG, 6)
add("BBM (Bachelor of Business Management)", "bbm business management " + UG, 4)
add("MBA", DEG["MBA"] + " general", 15)
for s, kw in [("Finance", "finance"), ("Marketing", "marketing"), ("Human Resources", "hr hrm"), ("Operations", "operations ops"),
              ("Business Analytics", "analytics ba"), ("Information Technology", "it systems"), ("International Business", "ib"),
              ("Healthcare Management", "hospital healthcare"), ("Agribusiness", "agri"), ("Rural Management", "rural"), ("Retail", "retail"),
              ("Logistics and Supply Chain", "logistics scm supply chain"), ("Banking and Finance", "banking"), ("Entrepreneurship", "startup"),
              ("Digital Marketing", "digital"), ("Tourism and Travel", "tourism travel"), ("Pharma Management", "pharma"),
              ("Media Management", "media"), ("Sports Management", "sports"), ("Fintech", "fintech")]:
    add(f"MBA {s}", DEG["MBA"] + " " + kw + " " + s, 6)
add("PGDM", DEG["PGDM"], 8)
for s in ["Finance", "Marketing", "Human Resources", "Business Analytics"]:
    add(f"PGDM {s}", DEG["PGDM"] + " " + s, 3)
add("Executive MBA", "emba executive mba " + PG, 2)
add("Integrated MBA (IPM)", "ipm integrated mba bba", 3)
add("PhD Management", DEG["PhD"] + " management", 0)

# ---------- computers ----------
add("BCA", "bca bachelor of computer applications computer science " + UG, 16)
for s in ["Data Science", "Artificial Intelligence", "Cloud Computing", "Cyber Security"]:
    add(f"BCA {s}", "bca bachelor of computer applications " + s + " " + UG, 5)
add("MCA", "mca master of computer applications computer science " + PG, 12)
add("PGDCA (PG Diploma in Computer Applications)", "pgdca computer applications diploma", 2)
add("DCA (Diploma in Computer Applications)", "dca computer applications diploma", 1)

# ---------- medicine and allied health ----------
for label, kw, w in [
    ("MBBS", "mbbs bachelor of medicine surgery doctor medical", 15), ("BDS", "bds bachelor of dental surgery dentist dental", 10),
    ("BAMS (Ayurveda)", "bams ayurveda", 6), ("BHMS (Homoeopathy)", "bhms homoeopathy homeopathy", 6), ("BUMS (Unani)", "bums unani", 3),
    ("BSMS (Siddha)", "bsms siddha", 2), ("BNYS (Naturopathy and Yoga)", "bnys naturopathy yoga", 2),
    ("BPT (Physiotherapy)", "bpt physiotherapy physio", 7), ("MPT (Physiotherapy)", "mpt physiotherapy physio " + PG, 3),
    ("BOT (Occupational Therapy)", "bot occupational therapy", 2), ("B.Sc Nursing", "bsc nursing nurse", 10),
    ("Post Basic B.Sc Nursing", "pbbsc nursing", 2), ("M.Sc Nursing", "msc nursing " + PG, 3), ("GNM (General Nursing and Midwifery)", "gnm nursing", 4),
    ("ANM (Auxiliary Nurse Midwife)", "anm nursing", 2), ("BASLP (Audiology and Speech-Language)", "baslp audiology speech", 2),
    ("B.Optom (Optometry)", "optometry optom eye", 3), ("BMLT (Medical Lab Technology)", "bmlt mlt lab technology", 4),
    ("DMLT (Diploma in Medical Lab Technology)", "dmlt mlt lab diploma", 3), ("B.Sc Radiology and Imaging Technology", "radiology imaging x ray", 3),
    ("B.Sc Anaesthesia Technology", "anaesthesia anesthesia ott", 2), ("B.Sc Operation Theatre Technology", "ott operation theatre", 2),
    ("B.Sc Cardiac Technology", "cardiac heart", 1), ("B.Sc Dialysis Technology", "dialysis renal", 1), ("B.Sc Respiratory Therapy", "respiratory", 1),
    ("B.Sc Physician Assistant", "physician assistant", 1), ("B.Sc Medical Laboratory Technology", "mlt bmlt lab", 3),
    ("B.V.Sc & AH (Veterinary)", "bvsc vet veterinary animal husbandry", 5), ("M.V.Sc (Veterinary)", "mvsc vet veterinary " + PG, 1),
    ("MPH (Public Health)", "mph public health " + PG, 2), ("BPH (Public Health)", "bph public health " + UG, 1),
    ("B.Sc Clinical Psychology", "clinical psychology", 1), ("DNB", "dnb diplomate national board", 1),
]:
    add(label, kw, w)
for s in ["General Medicine", "Paediatrics", "Dermatology", "Psychiatry", "Radiodiagnosis", "Anaesthesiology", "Pathology", "Pharmacology",
          "Microbiology", "Community Medicine", "Physiology", "Anatomy", "Biochemistry", "Forensic Medicine", "Emergency Medicine",
          "Respiratory Medicine", "Radiation Oncology", "Family Medicine", "Sports Medicine"]:
    add(f"MD {s}", "md doctor of medicine pg medical " + s, 3)
for s in ["General Surgery", "Orthopaedics", "ENT (Otorhinolaryngology)", "Ophthalmology", "Obstetrics and Gynaecology"]:
    add(f"MS {s}", "ms master of surgery pg medical " + s, 3)
for s in ["Cardiology", "Neurology", "Gastroenterology", "Nephrology", "Endocrinology", "Medical Oncology"]:
    add(f"DM {s}", "dm super speciality medical " + s, 1)
for s in ["Neurosurgery", "Cardiothoracic Surgery", "Plastic Surgery", "Urology", "Paediatric Surgery"]:
    add(f"MCh {s}", "mch super speciality surgery " + s, 1)
for s in ["Orthodontics", "Prosthodontics", "Periodontics", "Conservative Dentistry and Endodontics", "Oral and Maxillofacial Surgery",
          "Paediatric Dentistry", "Oral Medicine and Radiology", "Oral Pathology", "Public Health Dentistry"]:
    add(f"MDS {s}", "mds master of dental surgery dental pg " + s, 2)

# ---------- pharmacy ----------
add("B.Pharm", "bpharm b.pharm bachelor of pharmacy pharma " + UG, 12)
add("D.Pharm", "dpharm d.pharm diploma in pharmacy pharma", 8)
add("Pharm.D", "pharmd pharm.d doctor of pharmacy pharma", 6)
for s in ["Pharmaceutics", "Pharmacology", "Pharmaceutical Chemistry", "Pharmacognosy", "Pharmaceutical Analysis", "Quality Assurance",
          "Regulatory Affairs", "Pharmacy Practice", "Industrial Pharmacy"]:
    add(f"M.Pharm {s}", "mpharm m.pharm master of pharmacy pharma " + PG + " " + s, 3)
add("PhD Pharmacy", DEG["PhD"] + " pharmacy pharma", 0)

# ---------- law ----------
for label, kw, w in [("LLB (3 years)", "llb law bachelor of laws", 9), ("BA LLB (5 years)", "ba llb law integrated", 10),
                     ("BBA LLB (5 years)", "bba llb law integrated", 6), ("B.Com LLB (5 years)", "bcom llb law integrated", 3),
                     ("B.Sc LLB (5 years)", "bsc llb law integrated", 2), ("LLM", "llm master of laws law " + PG, 5), ("PhD Law", DEG["PhD"] + " law", 0)]:
    add(label, kw, w)
for s in ["Constitutional Law", "Corporate Law", "Criminal Law", "Intellectual Property Law", "International Law", "Human Rights Law",
          "Cyber Law", "Tax Law", "Environmental Law", "Family Law"]:
    add(f"LLM {s}", "llm master of laws law " + PG + " " + s, 2)

# ---------- architecture, planning, design, fine arts ----------
for label, kw, w in [("B.Arch", "barch b.arch bachelor of architecture", 8), ("M.Arch", "march m.arch master of architecture " + PG, 2),
                     ("B.Plan", "bplan planning urban", 3), ("M.Plan", "mplan planning urban " + PG, 1),
                     ("BFA (Bachelor of Fine Arts)", "bfa fine arts painting art", 4), ("MFA (Master of Fine Arts)", "mfa fine arts " + PG, 2)]:
    add(label, kw, w)
for s in ["Painting", "Applied Arts", "Sculpture", "Photography", "Animation"]:
    add(f"BFA {s}", "bfa fine arts " + s, 2)
for s in ["Fashion Design", "Communication Design", "Product Design", "Interior Design", "Textile Design", "UX/UI Design", "Animation",
          "Accessory Design", "Industrial Design", "Game Design", "Jewellery Design"]:
    add(f"B.Des {s}", "bdes b.des bachelor of design design nift nid " + s, 5)
    add(f"M.Des {s}", "mdes m.des master of design design " + PG + " " + s, 1)
add("B.Des", "bdes b.des bachelor of design design nift nid", 6)

# ---------- education ----------
for label, kw, w in [("B.Ed", "bed b.ed bachelor of education teacher teaching", 9), ("M.Ed", "med m.ed master of education " + PG, 3),
                     ("D.El.Ed", "deled d.el.ed diploma elementary education teacher", 4), ("B.El.Ed", "beled elementary education", 2),
                     ("B.P.Ed (Physical Education)", "bped physical education sports", 3), ("M.P.Ed (Physical Education)", "mped physical education " + PG, 1),
                     ("B.A. B.Ed (Integrated)", "ba bed integrated teacher", 3), ("B.Sc B.Ed (Integrated)", "bsc bed integrated teacher", 3),
                     ("PhD Education", DEG["PhD"] + " education", 0)]:
    add(label, kw, w)

# ---------- media ----------
for label, kw, w in [("BJMC (Journalism and Mass Communication)", "bjmc journalism mass communication media", 7),
                     ("MJMC (Journalism and Mass Communication)", "mjmc journalism mass communication media " + PG, 3),
                     ("BMM (Bachelor of Mass Media)", "bmm mass media", 4), ("B.Sc Media and Communication", "media communication", 2),
                     ("PG Diploma in Journalism", "journalism diploma pgdj", 1)]:
    add(label, kw, w)

# ---------- hotel, travel, aviation, maritime ----------
for label, kw, w in [("BHM (Hotel Management)", "bhm hotel management hospitality", 7), ("B.Sc Hospitality and Hotel Administration", "hha hotel hospitality ihm", 5),
                     ("BHMCT (Hotel Management and Catering Technology)", "bhmct hotel catering", 3), ("Diploma in Hotel Management", "hotel diploma", 2),
                     ("B.Sc Culinary Arts", "culinary chef cooking", 2), ("BTTM (Travel and Tourism Management)", "bttm travel tourism", 2),
                     ("B.Sc Aviation", "aviation pilot airline", 2), ("Commercial Pilot Licence (CPL)", "cpl pilot flying", 1),
                     ("B.Sc Nautical Science", "nautical merchant navy ship", 2), ("Diploma in Nautical Science (DNS)", "dns merchant navy", 1)]:
    add(label, kw, w)

# ---------- agriculture ----------
for label, kw, w in [("B.Sc (Hons) Agriculture", "agri agriculture bsc " + UG, 9), ("B.Sc Horticulture", "horti horticulture", 4),
                     ("B.Sc Forestry", "forestry forest", 3), ("B.F.Sc (Fisheries Science)", "bfsc fisheries fish", 2),
                     ("B.Sc Community Science", "community home science", 1), ("B.Sc Sericulture", "sericulture silk", 1),
                     ("Diploma in Agriculture", "agri diploma", 2), ("PhD Agriculture", DEG["PhD"] + " agriculture agri", 0)]:
    add(label, kw, w)
for s in ["Agronomy", "Plant Pathology", "Entomology", "Genetics and Plant Breeding", "Soil Science", "Agricultural Economics",
          "Horticulture", "Agricultural Extension", "Plant Physiology", "Seed Science and Technology"]:
    add(f"M.Sc Agriculture {s}", "msc agriculture agri " + PG + " " + s, 2)

# ---------- social work, library ----------
for label, kw, w in [("BSW (Bachelor of Social Work)", "bsw social work", 4), ("MSW (Master of Social Work)", "msw social work " + PG, 4),
                     ("BLIS (Library and Information Science)", "blis blisc library", 1), ("MLIS (Library and Information Science)", "mlis mlisc library " + PG, 1)]:
    add(label, kw, w)

# ---------- professional courses ----------
for label, kw, w in [("CA (Chartered Accountancy)", "ca chartered accountant icai", 7), ("CS (Company Secretary)", "cs company secretary icsi", 3),
                     ("CMA (Cost and Management Accountancy)", "cma icwa cost accountant", 3), ("ACCA", "acca accountancy", 2),
                     ("CFA", "cfa chartered financial analyst", 1), ("Actuarial Science", "actuary actuarial", 1)]:
    add(label, kw, w)

# ---------- vocational ----------
for s in ["Software Development", "Retail Management", "Banking and Finance", "Hospitality", "Healthcare", "Automobile", "Renewable Energy",
          "Media and Entertainment", "Food Processing", "Logistics", "Fashion Design", "Graphic Design"]:
    add(f"B.Voc {s}", "bvoc b.voc bachelor of vocation vocational " + s, 2)
for s in ["Electrician", "Fitter", "Welder", "Mechanic (Motor Vehicle)", "Computer Operator (COPA)", "Electronics Mechanic", "Draughtsman (Civil)", "Plumber"]:
    add(f"ITI {s}", "iti industrial training institute trade " + s, 2)

# ---------- research ----------
add("M.Phil", DEG["M.Phil"], 1)
add("Postdoctoral Research", "postdoc post doctoral research fellow", 0)
add("Integrated M.Sc (5 years)", "integrated msc 5 year", 3)
add("Integrated M.Tech (5 years)", "integrated mtech 5 year dual", 2)

out = []
for label, (kw, w) in rows.items():
    words = set(label.lower().replace("(", " ").replace(")", " ").replace(",", " ").split())
    extra = " ".join(sorted(k for k in kw if k not in words))
    out.append([label, extra, w])
out.sort(key=lambda r: (-r[2], r[0]))
json.dump({"v": 1, "rows": out}, open("public/data/courses-v1.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "courses")
