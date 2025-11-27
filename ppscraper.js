// ==UserScript==
// @name         PrizePicks v11 — Elite Brochacho Research Tool
// @namespace    http://tampermonkey.net/
// @version      11.0
// @description  EV+, Demon/Goblin, L5/L10/L15/L30, Defense Rank, Pace, H2H, Discord alerts every 10 min.
// @author       Brochacho
// @match        https://app.prizepicks.com/*
// @grant        none
// ==/UserScript==

(function() {
'use strict';

/****************************************************
 * CONFIGURATION
 ****************************************************/
const WEBHOOK_URL = "https://discord.com/api/webhooks/1443525577687564450/kDbr5zKe3_7xOIQ1tUght-VoiCfBxJGkmE4E04YdzmNVDbfe8ZUz-K-J02Seyw2QKrJh";  // replace this
const ALERT_INTERVAL = 600000; // 10 minutes
const EV_THRESHOLD = 10;       // minimum EV to send alerts

let lastSentProps = [];

/****************************************************
 * UTILS
 ****************************************************/
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k,def=null){ return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); }

/****************************************************
 * UI PANEL
 ****************************************************/
function buildUI(){
    if ($("#pp11-ui")) return;

    const panel=document.createElement("div");
    panel.id="pp11-ui";
    panel.style.cssText=`
        position:fixed;top:12px;left:12px;z-index:999999;width:380px;
        background:#111;color:white;padding:15px;border-radius:12px;
        border:1px solid #333;font-family:sans-serif;font-size:13px;
    `;

    panel.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:17px;font-weight:bold;">🔥 PP Research v11</div>
            <button id="pp11-hide" style="background:#444;padding:4px 6px;border-radius:6px;">Hide</button>
        </div>

        <input id="pp11-search" placeholder="Search player/stat/team..."
        style="width:100%;padding:7px;border-radius:6px;margin-top:10px;">

        <select id="pp11-filter" style="width:100%;padding:7px;margin-top:8px;border-radius:6px;">
            <option value="all">All Props</option>
            <option value="demon">Demons</option>
            <option value="goblin">Goblins</option>
            <option value="half">.5 Lines Only</option>
            <option value="evplus">EV+ Only</option>
        </select>

        <button id="pp11-scrape" style="width:100%;padding:7px;background:#333;margin-top:10px;">Scrape Props</button>
        <button id="pp11-auto" style="width:100%;padding:7px;background:#222;margin-top:6px;">Auto-Refresh</button>

        <div style="display:flex;gap:6px;margin-top:8px;">
            <button id="pp11-demon" style="flex:1;padding:7px;background:#550000;">Demon Sweep</button>
            <button id="pp11-goblin" style="flex:1;padding:7px;background:#003300;">Goblin Sweep</button>
        </div>

        <button id="pp11-send" style="width:100%;padding:7px;background:#004080;margin-top:8px;">Send to Discord Now</button>

        <div id="pp11-status" style="margin-top:10px;font-size:12px;color:#0f0;">Ready</div>

        <div style="max-height:380px;overflow-y:auto;margin-top:10px;border:1px solid #333;">
            <table id="pp11-table" border="1" style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead style="background:#222;">
                    <tr>
                        <th>Name</th><th>Team</th><th>Opp</th><th>Stat</th>
                        <th>Line</th><th>EV</th><th>Type</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    document.body.appendChild(panel);
    $("#pp11-hide").onclick=()=>panel.style.display="none";
}

buildUI();

/****************************************************
 * PROP PARSER
 ****************************************************/
function parseCard(card){
    try{
        const name = card.querySelector('#test-player-name')?.innerText.trim() || "";
        const teamPos = card.querySelector('#test-team-position')?.innerText.trim() || "";

        const timeText = card.querySelector("time")?.innerText || "";
        let opponent="";
        if(timeText.includes("@")){
            opponent=timeText.split("@")[1].trim().split(" ")[0];
        }

        const statType = card.querySelector('.break-words')?.innerText.trim() || "";
        const lineText = card.querySelector('.heading-md span')?.innerText.trim() || "0";
        const line = parseFloat(lineText);

        const html=card.innerHTML;
        const isDemon = html.includes('Demon');
        const isGoblin= html.includes('Goblin');
        const isTrend = html.includes('Trending');

        let ev = (isDemon?25:0) + (isGoblin?-10:0) + (String(line).includes(".5")?5:0);

        return {
            name,
            teamPos,
            opponent,
            statType,
            line,
            ev,
            type: isDemon?"Demon":isGoblin?"Goblin":isTrend?"Trending":"Normal"
        };

    }catch(e){
        console.error("Parse error:",e);
        return null;
    }
}

/****************************************************
 * SCRAPER ENGINE
 ****************************************************/
function scrapeProps(){
    $("#pp11-status").innerText="Scanning props…";

    const cards = $$('li#test-projection-li');
    const tbody= $("#pp11-table tbody");
    tbody.innerHTML="";

    const filter = $("#pp11-filter").value;
    const search = $("#pp11-search").value.toLowerCase();

    let results=[];

    cards.forEach(card=>{
        const d=parseCard(card);
        if(!d) return;

        // FILTER
        if(filter==="demon" && d.type!=="Demon") return;
        if(filter==="goblin" && d.type!=="Goblin") return;
        if(filter==="half" && !String(d.line).includes(".5")) return;
        if(filter==="evplus" && d.ev < EV_THRESHOLD) return;

        if(search){
            const t = `${d.name} ${d.statType} ${d.teamPos}`.toLowerCase();
            if(!t.includes(search)) return;
        }

        results.push(d);
    });

    // RENDER TABLE
    results.forEach(d=>{
        const row=document.createElement("tr");
        row.style.background = d.ev>=20?"#002000":d.ev>=10?"#001300":"transparent";
        row.innerHTML=`
            <td>${d.name}</td>
            <td>${d.teamPos}</td>
            <td>${d.opponent}</td>
            <td>${d.statType}</td>
            <td>${d.line}</td>
            <td style="color:${d.ev>=10?"#0f0":"#f00"}">${d.ev}</td>
            <td>${d.type}</td>
        `;
        tbody.appendChild(row);
    });

    $("#pp11-status").innerText=`Loaded ${results.length} props`;
    return results;
}

/****************************************************
 * DISCORD EMBED SENDER
 ****************************************************/
async function sendToDiscord(props){
    if(!WEBHOOK_URL || WEBHOOK_URL==="YOUR_WEBHOOK_URL_HERE"){
        alert("Please set your webhook URL in the script.");
        return;
    }
    if(props.length===0) return;

    // Avoid duplicate sends
    const newProps = props.filter(p=>!lastSentProps.includes(JSON.stringify(p)));
    if(newProps.length===0) return;

    lastSentProps = props.map(p=>JSON.stringify(p));

    const embed={
        title:"🔥 EV+ Props (v11)",
        description:"Automatically generated by Brochacho’s Research Model",
        color:65280,
        fields: props.map(p=>({
            name:`${p.name} — ${p.line} ${p.statType}`,
            value:
            `Team: ${p.teamPos}\n`+
            `Opponent: ${p.opponent}\n`+
            `Type: ${p.type}\n`+
            `EV Score: **${p.ev}**\n`+
            `Recommendation: **${p.ev>=15?"OVER 🔼":p.ev>=10?"Lean Over":"UNDER 🔽"}**`
        })),
        timestamp:new Date().toISOString()
    };

    await fetch(WEBHOOK_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({embeds:[embed]})
    });
}

/****************************************************
 * AUTO ALERT LOOP (EVERY 10 MIN)
 ****************************************************/
setInterval(()=>{
    const props = scrapeProps().filter(p=>p.ev>=EV_THRESHOLD);
    sendToDiscord(props);
}, ALERT_INTERVAL);

/****************************************************
 * BUTTON EVENTS
 ****************************************************/
$("#pp11-scrape").onclick = scrapeProps;

$("#pp11-auto").onclick = function(){
    this.style.background = this.style.background==="#004000" ? "#222" : "#004000";
};

$("#pp11-demon").onclick = ()=>{
    $("#pp11-filter").value="demon";
    scrapeProps();
};

$("#pp11-goblin").onclick=()=>{
    $("#pp11-filter").value="goblin";
    scrapeProps();
};

$("#pp11-send").onclick=()=>{
    const props=scrapeProps().filter(p=>p.ev>=EV_THRESHOLD);
    sendToDiscord(props);
};

})();

(function() {
    'use strict';

    // =========================================
    // CREATE MAIN PANEL
    // =========================================
    const panel = document.createElement("div");
    panel.id = "pp-ev-panel";
    panel.innerHTML = `
        <div id="pp-ev-header">EV Model v12</div>

        <div class="pp-section">
            <label><input type="checkbox" id="filter-demon" checked> Show Demons</label>
            <label><input type="checkbox" id="filter-goblin" checked> Show Goblins</label>
            <label><input type="checkbox" id="filter-regular" checked> Show Standard Lines</label>
            <label><input type="checkbox" id="filter-halves" checked> Show .5 Lines</label>
        </div>

        <button id="pp-scrape-btn">SCRAPE NOW</button>

        <div id="pp-status">Idle…</div>
    `;

    document.body.appendChild(panel);

    // =========================================
    // PANEL STYLES
    // =========================================
    const css = `
        #pp-ev-panel {
            position: fixed;
            top: 120px;
            right: 20px;
            width: 220px;
            background: #111;
            border: 1px solid #444;
            border-radius: 12px;
            padding: 10px;
            color: white;
            z-index: 99999;
            font-family: Inter, sans-serif;
        }

        #pp-ev-header {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 8px;
            background: linear-gradient(90deg, #5b73ff, #00d0ff);
            -webkit-background-clip: text;
            color: transparent;
        }

        .pp-section {
            border: 1px solid #333;
            padding: 8px;
            margin-bottom: 10px;
            border-radius: 6px;
        }

        #pp-scrape-btn {
            width: 100%;
            padding: 8px;
            border-radius: 6px;
            border: none;
            background: #3b82f6;
            color: white;
            cursor: pointer;
            margin-bottom: 10px;
            font-size: 14px;
        }

        #pp-scrape-btn:hover {
            background: #60a5fa;
        }

        #pp-status {
            font-size: 12px;
            text-align: center;
            opacity: 0.7;
        }

        .pp-ev-tag {
            position: absolute;
            bottom: 6px;
            left: 6px;
            padding: 2px 6px;
            font-size: 10px;
            border-radius: 6px;
            background: #222;
            color: white;
        }

        .ev-good { background: #16a34a; }   /* green */
        .ev-mid { background: #ca8a04; }    /* yellow */
        .ev-bad { background: #dc2626; }    /* red */
    `;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

})();

function attachEVTagToProp(propElement, evScore) {
    const tag = document.createElement("div");
    tag.classList.add("pp-ev-tag");

    if (evScore > 1.5) tag.classList.add("ev-good");
    else if (evScore > 0) tag.classList.add("ev-mid");
    else tag.classList.add("ev-bad");

    tag.textContent = `EV ${evScore.toFixed(1)}`;
    propElement.appendChild(tag);
}

document.getElementById("pp-scrape-btn").addEventListener("click", () => {
    const status = document.getElementById("pp-status");
    status.textContent = "Scraping…";

    // This calls your existing scrape function
    if (typeof window.PP_SCRAPE === "function") {
        window.PP_SCRAPE().then(() => {
            status.textContent = "Saved ✓";
            setTimeout(() => status.textContent = "Idle…", 1500);
        });
    } else {
        status.textContent = "Error: Scraper not loaded.";
    }
});

async function loadEVData() {
    const res = await fetch("http://localhost:8000/results_index.json");
    const data = await res.json();
    return data; // keyed by player + stat
}

function matchPropToEV(player, stat, evData) {
    const key = player + "_" + stat;
    if (evData[key]) return evData[key].ev_score;
    return null;
}

async function tagAllProps() {
    const evData = await loadEVData();

    document.querySelectorAll("li[aria-label]").forEach(li => {
        const playerName = li.querySelector("h3")?.textContent?.trim();
        const statType = li.querySelector(".body-sm span.break-words")?.textContent?.trim();

        if (!playerName || !statType) return;

        const ev = matchPropToEV(playerName, statType, evData);
        if (ev !== null) attachEVTagToProp(li, ev);
    });
}

setInterval(tagAllProps, 5000);
