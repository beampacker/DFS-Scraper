# ev_engine.py
# ----------------------------
# MODULE 2 — Full EV Engine
# Hybrid NBA Stats + Multi-Source Fetcher
# PP Integration + Matchup Modeling
# ----------------------------
from ai_writer import create_writeup
import json
import os
import time
import requests
from datetime import datetime
from statistics import mean

# ----------------------------
# CONFIG
# ----------------------------

INCOMING_FOLDER = r"C:\pp_ev_model\incoming"
RESULTS_FOLDER = r"C:\pp_ev_model\results"

os.makedirs(INCOMING_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

NBA_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json"
}

BALDONTLIE = "https://api.balldontlie.io/v1"
STATMUSE = "https://www.statmuse.com/api/answer"

def watch_for_new_files():
    """Continuously monitors the folder for new PrizePicks JSON drops."""
    seen = set()
    while True:
        files = [f for f in os.listdir(INCOMING_FOLDER) if f.endswith(".json")]
        files.sort()

        for fname in files:
            full = os.path.join(INCOMING_FOLDER, fname)
            if full not in seen:
                print(f"\n[ENGINE] New file detected → {fname}")
                seen.add(full)
                process_file(full)

        time.sleep(3)

def process_file(path):
    with open(path, "r") as f:
        props = json.load(f)

    print(f"[ENGINE] Loaded {len(props)} props from {path}")

    for prop in props:
        try:
            analyze_prop(prop)
        except Exception as e:
            print(f"[ENGINE] Error analyzing prop: {e}")

def get_player_id_balldontlie(name):
    url = f"{BALDONTLIE}/players?search={name}"
    r = requests.get(url)
    data = r.json()
    if data["data"]:
        return data["data"][0]["id"]
    return None


def get_game_logs_balldontlie(player_id):
    url = f"{BALDONTLIE}/stats?per_page=40&player_ids[]={player_id}"
    r = requests.get(url)
    data = r.json()
    return data["data"]


def statmuse_query(query):
    payload = {"query": query, "player": None, "team": None}
    r = requests.post(STATMUSE, json=payload)
    return r.json()

def build_stat_model(logs, field):
    values = [g.get(field, 0) for g in logs]
    if not values:
        return {}

    return {
        "L5": mean(values[:5]),
        "L10": mean(values[:10]),
        "L15": mean(values[:15]),
        "L30": mean(values[:30]),
        "season_avg": mean(values)
    }

def analyze_prop(prop):
    name = prop["name"]
    stat_type = prop["stat"]
    line = float(prop["line"])
    matchup = prop["matchup"]
    tier = prop["tier"]

    print(f"\n[ENGINE] Analyzing {name} — {stat_type} {line}")

    # 1. Get player ID
    pid = get_player_id_balldontlie(name)
    if not pid:
        print("[ENGINE] Could not find player ID (balldontlie)")
        return

    # 2. Game logs
    logs = get_game_logs_balldontlie(pid)

    # 3. Build stat model
    model = build_stat_model(logs, convert_field(stat_type))

    # 4. EV Calculation
    ev = calculate_ev_score(model, line, tier)

    # Save results
    save_analysis(name, stat_type, line, matchup, tier, model, ev)

def save_analysis(name, stat_type, line, matchup, tier, model, ev):
    out = {
        "player": name,
        "stat_type": stat_type,
        "line": line,
        "matchup": matchup,
        "tier": tier,
        "model": model,
        "ev_score": ev,
        "recommended": "OVER" if ev > 0 else "UNDER",
        "timestamp": datetime.now().isoformat()
    }

    fname = f"{RESULTS_FOLDER}/{name.replace(' ', '_')}_{stat_type}.json"
    with open(fname, "w") as f:
        json.dump(out, f, indent=4)

    print(f"[ENGINE] Saved → {fname}")

    # 💜 Call AI Writer module
    create_writeup(out)

def calculate_ev_score(model, line, tier):

    base = model["L10"]  # weighted mid-range average
    diff = base - line

    tier_boost = {
        "demon": 1.25,
        "goblin": 1.10,
        "neutral": 1.0
    }.get(tier, 1.0)

    return diff * tier_boost
if __name__ == "__main__":
    print("[ENGINE] Starting EV Engine…")
    watch_for_new_files()
