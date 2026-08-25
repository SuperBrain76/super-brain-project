"""
generate-crests.py — regenerate lib/leagues/crests.ts from the paid data feeds.

Two steps. First cache the feeds into ./.crest-cache/ (needs the two API keys
from .env.local — football-data.org covers the football leagues, TheSportsDB
covers the hockey + Swedish leagues football-data doesn't):

  mkdir -p .crest-cache
  # football-data.org (space calls ~7s apart; free tier = 10 req/min):
  for c in PL PD BL1 SA FL1 CL; do
    curl -s -H "X-Auth-Token: $FOOTBALL_DATA_TOKEN" \
      "https://api.football-data.org/v4/competitions/$c/teams" -o ".crest-cache/fd_$c.json"; sleep 7; done
  # TheSportsDB (league name, URL-encoded):
  for L in "NHL" "Swedish Hockey League" "Swedish Allsvenskan"; do
    enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$L")
    curl -s "https://www.thesportsdb.com/api/v1/json/$THESPORTSDB_API_KEY/search_all_teams.php?l=$enc" \
      -o ".crest-cache/tsdb_$(echo $L | tr ' ' '_').json"; sleep 2; done

Then run this script from the repo root:  python3 scripts/generate-crests.py
It matches every club in our TS club maps to a feed crest and writes
lib/leagues/crests.ts (with a coloured-monogram fallback in ClubCrest for any
miss). OVERRIDE below patches the rare code that doesn't match by tla or name.
"""
import json, re, os, unicodedata, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP   = os.path.join(ROOT, ".crest-cache")

FILES = [
  ("lib/premierLeague/clubs.ts", "football"),
  ("lib/leagues/laLiga.ts",      "football"),
  ("lib/leagues/bundesliga.ts",  "football"),
  ("lib/leagues/serieA.ts",      "football"),
  ("lib/leagues/ligue1.ts",      "football"),
  ("lib/leagues/allsvenskan.ts", "football"),
  ("lib/hockey/shl.ts",          "hockey"),
  ("lib/hockey/nhl.ts",          "hockey"),
  # rugby uses the same TheSportsDB name-matcher as hockey (names are feed-exact)
  ("lib/rugby/prem.ts",          "hockey"),
]

GENERIC = {"fc","cf","afc","ac","ssc","ss","us","as","rc","rcd","cd","ud","ca","sc","sv",
           "bsc","vfb","vfl","tsv","tsg","ogc","calcio","club","de","the","1","fk","if",
           "bk","hc","sk","hf","il","ff","ik","aik"}  # note: keep for hockey some are names

def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

def norm(s, drop_generic=True):
    s = strip_accents(s or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = [t for t in s.split() if t]
    if drop_generic:
        toks = [t for t in toks if t not in GENERIC] or toks
    return " ".join(toks)

# --- parse our clubs ---
ours = []
for rel, sport in FILES:
    txt = open(os.path.join(ROOT, rel)).read()
    for m in re.finditer(r'code:\s*"([^"]+)"\s*,\s*name:\s*"([^"]+)"', txt):
        ours.append({"code": m.group(1), "name": m.group(2), "sport": sport, "file": rel})

# --- load football-data teams (pool) ---
fd = []
for f in glob.glob(os.path.join(SP, "fd_*.json")):
    d = json.load(open(f))
    for t in d.get("teams", []):
        if t.get("crest"):
            fd.append({"tla": (t.get("tla") or "").upper(),
                       "short": t.get("shortName") or "",
                       "name": t.get("name") or "",
                       "crest": t["crest"]})
# dedupe by tla+crest
seen=set(); fd=[x for x in fd if (x["tla"],x["crest"]) not in seen and not seen.add((x["tla"],x["crest"]))]

# --- load TheSportsDB hockey teams ---
hk = []
for f in glob.glob(os.path.join(SP, "tsdb_*.json")):
    d = json.load(open(f)) or {}
    for t in (d.get("teams") or []):
        badge = t.get("strBadge") or t.get("strTeamBadge")
        if badge:
            hk.append({"name": t.get("strTeam") or "", "alt": t.get("strTeamShort") or "", "crest": badge})

OVERRIDE = { "NFO": "https://crests.football-data.org/351.png" }

def match_hk_pool(club):
    nm = norm(club["name"])
    for t in hk:
        if norm(t["name"]) == nm: return t["crest"], "tsdb="
    for t in hk:
        nt = norm(t["name"])
        if nm and (nm in nt or nt in nm): return t["crest"], "tsdb~"
    return None, None

def match_football(club):
    if club["code"] in OVERRIDE: return OVERRIDE[club["code"]], "override"
    c = club["code"].upper(); nm = norm(club["name"])
    for t in fd:                      # 1. tla == code
        if t["tla"] and t["tla"] == c: return t["crest"], "tla"
    for t in fd:                      # 2. exact normalized shortName/name
        if norm(t["short"]) == nm or norm(t["name"]) == nm: return t["crest"], "name="
    for t in fd:                      # 3. containment
        ns, nn = norm(t["short"]), norm(t["name"])
        if nm and (nm in ns or ns in nm or nm in nn): return t["crest"], "contains"
    return match_hk_pool(club)       # 4. TheSportsDB pool (e.g. Allsvenskan)

def match_hockey(club):
    nm = norm(club["name"])
    for t in hk:
        if norm(t["name"]) == nm: return t["crest"], "name="
    for t in hk:
        nt = norm(t["name"])
        if nm and (nm in nt or nt in nm): return t["crest"], "contains"
    return None, None

crest_map = {}; unmatched = []
for club in ours:
    crest, how = (match_football if club["sport"]=="football" else match_hockey)(club)
    if crest: crest_map[club["code"]] = crest
    else: unmatched.append(club)

# emit
lines = ['/**',
 ' * lib/leagues/crests.ts — club crest image URLs, keyed by club code.',
 ' *',
 ' * GENERATED from the paid data feeds (football-data.org crests + TheSportsDB',
 ' * badges), matched to our club codes. ClubCrest renders the image and falls',
 ' * back to the coloured monogram for any code missing here, so nothing breaks.',
 ' * Regenerate with scripts (do not hand-edit individual URLs).',
 ' */',
 '',
 'export const CREST_BY_CODE: Record<string, string> = {']
for code in sorted(crest_map):
    lines.append('  ' + json.dumps(code) + ': ' + json.dumps(crest_map[code]) + ',')
lines.append('};')
open(os.path.join(ROOT, "lib/leagues/crests.ts"), "w").write("\n".join(lines)+"\n")

print(f"matched {len(crest_map)}/{len(ours)} clubs")
print("UNMATCHED:")
for u in unmatched:
    print(f"  {u['code']:5} {u['name']:26} [{u['file'].split('/')[-1]}]")
