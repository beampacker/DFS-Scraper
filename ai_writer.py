# ai_writer.py
# ----------------------------
# MODULE 3 — AI Writer Engine
# Creates human-readable analysis, risk notes,
# and Discord webhook embeds for each prop.
# ----------------------------
import json
import requests
from datetime import datetime


DISCORD_WEBHOOK = "YOUR_WEBHOOK_HERE"   # <-- replace with your webhook

COLOR_GREEN = 0x00FF00
COLOR_RED = 0xFF0000
COLOR_YELLOW = 0xFFFF00

def format_stat_model(model):
    return (
        f"L5: {round(model['L5'], 2)} | "
        f"L10: {round(model['L10'], 2)} | "
        f"L15: {round(model['L15'], 2)} | "
        f"L30: {round(model['L30'], 2)} | "
        f"Season Avg: {round(model['season_avg'], 2)}"
    )

def confidence_from_ev(ev_score):
    if ev_score >= 2.5:
        return "🔥 CASH (High Confidence)", COLOR_GREEN
    elif ev_score >= 1:
        return "👍 Should Hit (Medium)", COLOR_YELLOW
    elif ev_score >= 0:
        return "⚠️ Risky, but Lean OVER", COLOR_YELLOW
    else:
        return "❌ CHALKED (Lean UNDER)", COLOR_RED

def build_analysis_text(player, stat_type, line, matchup, tier, model, ev_score):
    direction = "OVER" if ev_score > 0 else "UNDER"

    return (
        f"**{player} — {stat_type} {line}**\n"
        f"**Recommended:** {direction}\n\n"
        f"**Tier:** {tier.capitalize()} (line adjustment)\n"
        f"**Matchup:** {matchup}\n"
        f"**EV Score:** {round(ev_score, 2)}\n\n"
        f"**Stat Model:** {format_stat_model(model)}\n\n"
        f"**Reasoning:**\n"
        f"- L10 vs line difference suggests a {direction.lower()}\n"
        f"- Tier multiplier applied ({tier})\n"
        f"- Weighted averages indicate trend toward {direction.lower()}\n"
        f"- EV score reflects overall expected value\n\n"
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

def send_discord_embed(player, stat_type, line, analysis_text, confidence_text, color):
    embed = {
        "embeds": [
            {
                "title": f"{player} — {stat_type} {line}",
                "description": analysis_text,
                "color": color,
                "footer": {"text": confidence_text}
            }
        ]
    }

    try:
        requests.post(DISCORD_WEBHOOK, json=embed)
    except Exception as e:
        print(f"[AI_WRITER] Failed to send to Discord: {e}")

def create_writeup(result_dict):
    player = result_dict["player"]
    stat_type = result_dict["stat_type"]
    line = result_dict["line"]
    matchup = result_dict["matchup"]
    tier = result_dict["tier"]
    model = result_dict["model"]
    ev = result_dict["ev_score"]

    # Build human-readable breakdown
    analysis_text = build_analysis_text(player, stat_type, line, matchup, tier, model, ev)

    # Confidence rating
    confidence_text, color = confidence_from_ev(ev)

    print(f"[AI_WRITER] {player} | {confidence_text}")

    # Send to Discord
    send_discord_embed(player, stat_type, line, analysis_text, confidence_text, color)
