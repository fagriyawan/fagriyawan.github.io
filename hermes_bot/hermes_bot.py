#!/usr/bin/env python3
"""
HERMES TRADING ANALYST - Autonomous Paper Trading Bot
======================================================
Deploy anywhere (VPS, Replit, Railway, GitHub Actions, cron).
Polls Binance market data, evaluates setups against rule book,
executes paper trades, sends Telegram alerts.

Usage:
    export TG_TOKEN="your_token"
    export TG_CHAT_ID="your_chat_id"
    python3 hermes_bot.py             # one cycle
    python3 hermes_bot.py --loop      # forever (polls every 10 min)
    python3 hermes_bot.py --startup-msg --loop   # send hello + loop

State files (in same dir):
    state.json           - portfolio, open positions, pending setups
    trade_history.json   - all closed trades
    snapshots/           - periodic market snapshots
"""

import os
import sys
import json
import time
import urllib.request
import ssl
from datetime import datetime, timezone
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================
TG_TOKEN   = os.environ.get("TG_TOKEN", "8894045436:AAHuFSPIrF--BTxc84t2bRg-ZSp3QcdlhZs")
TG_CHAT_ID = int(os.environ.get("TG_CHAT_ID", "989563434"))

POLL_INTERVAL_SEC = 600          # 10 minutes
DAILY_REPORT_HOUR_UTC = 0        # 00:00 UTC = 07:00 WIB
SYMBOLS = ["SOLUSDT"]            # bisa expand ke ["BTCUSDT", "ETHUSDT", ...]

DATA_DIR = Path(__file__).parent
STATE_FILE = DATA_DIR / "state.json"
HISTORY_FILE = DATA_DIR / "trade_history.json"
SNAP_DIR = DATA_DIR / "snapshots"
SNAP_DIR.mkdir(exist_ok=True)

BASE_SPOT = "https://data-api.binance.vision"
BASE_WWW  = "https://www.binance.com"
CTX = ssl.create_default_context()


# ============================================================
# UTILITIES
# ============================================================
def utcnow():
    return datetime.now(timezone.utc)

def log(msg):
    print(f"[{utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC] {msg}", flush=True)

def http_get_json(url, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': 'HermesBot/1.0'})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return json.loads(r.read().decode())

def http_post_json(url, payload, timeout=15):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
                                  headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return json.loads(r.read().decode())


# ============================================================
# TELEGRAM
# ============================================================
def tg_send(text, parse_mode="Markdown"):
    if not TG_TOKEN or not TG_CHAT_ID:
        log("TG token/chat_id missing, skip send")
        return
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    try:
        http_post_json(url, {
            "chat_id": TG_CHAT_ID,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        })
        log(f"TG sent ({len(text)} chars)")
    except Exception as e:
        log(f"TG send FAIL: {e}")


# ============================================================
# DATA FETCH
# ============================================================
def fetch_market(symbol):
    """Fetch full market snapshot for a symbol."""
    urls = {
        "ticker":    f"{BASE_SPOT}/api/v3/ticker/24hr?symbol={symbol}",
        "k4h":       f"{BASE_SPOT}/api/v3/klines?symbol={symbol}&interval=4h&limit=30",
        "k1h":       f"{BASE_SPOT}/api/v3/klines?symbol={symbol}&interval=1h&limit=24",
        "k15m":      f"{BASE_SPOT}/api/v3/klines?symbol={symbol}&interval=15m&limit=8",
        "oi":        f"{BASE_WWW}/futures/data/openInterestHist?symbol={symbol}&period=1h&limit=24",
        "ls_global": f"{BASE_WWW}/futures/data/globalLongShortAccountRatio?symbol={symbol}&period=1h&limit=12",
        "ls_topPos": f"{BASE_WWW}/futures/data/topLongShortPositionRatio?symbol={symbol}&period=1h&limit=12",
        "taker":     f"{BASE_WWW}/futures/data/takerlongshortRatio?symbol={symbol}&period=1h&limit=12",
    }
    out = {}
    for k, u in urls.items():
        try:
            out[k] = http_get_json(u)
        except Exception as e:
            log(f"fetch {symbol}/{k} FAIL: {e}")
            out[k] = None
    return out


def summarize_market(symbol, raw):
    """Extract key metrics from raw fetch."""
    if not raw or not raw.get("ticker"):
        return None
    t = raw["ticker"]
    s = {
        "symbol": symbol,
        "price": float(t["lastPrice"]),
        "change_24h": float(t["priceChangePercent"]),
        "high_24h": float(t["highPrice"]),
        "low_24h": float(t["lowPrice"]),
        "vol_quote_usd": float(t["quoteVolume"]),
    }
    if raw.get("oi"):
        oi_last = raw["oi"][-1]
        s["oi_usd"] = float(oi_last["sumOpenInterestValue"])
        s["oi_units"] = float(oi_last["sumOpenInterest"])
        oi_first = float(raw["oi"][0]["sumOpenInterestValue"])
        s["oi_change_24h_pct"] = (s["oi_usd"] - oi_first) / oi_first * 100
    if raw.get("ls_global"):
        s["ls_retail_long_pct"] = float(raw["ls_global"][-1]["longAccount"]) * 100
    if raw.get("ls_topPos"):
        s["ls_smart_long_pct"] = float(raw["ls_topPos"][-1]["longAccount"]) * 100
    if "ls_retail_long_pct" in s and "ls_smart_long_pct" in s:
        s["divergence_pp"] = s["ls_retail_long_pct"] - s["ls_smart_long_pct"]
    if raw.get("taker"):
        s["taker_latest"] = float(raw["taker"][-1]["buySellRatio"])
        s["taker_avg_3h"] = sum(float(r["buySellRatio"]) for r in raw["taker"][-3:]) / 3
    if raw.get("k15m"):
        last_15 = raw["k15m"][-1]
        s["k15m_open"]  = float(last_15[1])
        s["k15m_high"]  = float(last_15[2])
        s["k15m_low"]   = float(last_15[3])
        s["k15m_close"] = float(last_15[4])
    return s


# ============================================================
# STATE
# ============================================================
DEFAULT_STATE = {
    "version": "1.1",
    "started_at": None,
    "modal_awal": 10000.00,
    "cash": 10000.00,
    "open_positions": [],
    "pending_setups": {},
    "last_snapshot": {},
    "last_daily_report_date": None,
    "trade_counter": 0,
}

def bootstrap_setups():
    """Initial setups from TRADE_LOG_SOL_003."""
    return {
        "SOLUSDT": [
            {
                "id": "SOL_SETUP_A",
                "side": "SHORT",
                "entry_zone": [85.20, 85.60],
                "sl": 86.10,
                "tp1": 83.50,
                "tp2": 81.63,
                "size_usd": 300,
                "trigger": "rejection",
                "active": True,
                "note": "Short on bounce rejection",
            },
            {
                "id": "SOL_SETUP_B",
                "side": "SHORT",
                "entry_trigger_below": 83.45,
                "sl": 84.30,
                "tp1": 81.63,
                "tp2": 80.80,
                "tp3": 76.70,
                "size_usd": 400,
                "trigger": "breakdown",
                "active": True,
                "note": "Short on breakdown (cluster cascade target)",
            },
            {
                "id": "SOL_SETUP_C",
                "side": "SHORT",
                "entry_zone": [84.70, 84.90],
                "sl": 85.30,
                "tp1": 83.50,
                "tp2": 81.63,
                "size_usd": 150,
                "trigger": "scout",
                "active": True,
                "note": "Scout short, small size",
            },
        ]
    }

def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    s = dict(DEFAULT_STATE)
    s["started_at"] = utcnow().isoformat()
    s["pending_setups"] = bootstrap_setups()
    save_state(s)
    return s

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))

def load_history():
    if HISTORY_FILE.exists():
        try: return json.loads(HISTORY_FILE.read_text())
        except: pass
    return []

def save_history(h):
    HISTORY_FILE.write_text(json.dumps(h, indent=2, default=str))


# ============================================================
# TRADE EXECUTION (paper)
# ============================================================
def open_position(state, setup, entry_price, reason):
    state["trade_counter"] += 1
    tp_levels = [v for v in [setup.get("tp1"), setup.get("tp2"), setup.get("tp3")] if v]
    pos = {
        "trade_id": f"TRADE_{state['trade_counter']:04d}",
        "setup_id": setup["id"],
        "symbol": "SOLUSDT",
        "side": setup["side"],
        "entry_price": round(entry_price, 4),
        "size_usd": setup["size_usd"],
        "qty": round(setup["size_usd"] / entry_price, 4),
        "sl": setup["sl"],
        "tp_levels": tp_levels,
        "opened_at": utcnow().isoformat(),
        "reason": reason,
        "status": "OPEN",
    }
    state["open_positions"].append(pos)
    state["cash"] -= setup["size_usd"]
    for s in state["pending_setups"]["SOLUSDT"]:
        if s["id"] == setup["id"]:
            s["active"] = False
    save_state(state)
    return pos

def close_position(state, pos, exit_price, reason):
    if pos["side"] == "SHORT":
        pnl_pct = (pos["entry_price"] - exit_price) / pos["entry_price"]
    else:
        pnl_pct = (exit_price - pos["entry_price"]) / pos["entry_price"]
    pnl_usd = round(pos["size_usd"] * pnl_pct, 2)
    pos["exit_price"] = round(exit_price, 4)
    pos["pnl_usd"] = pnl_usd
    pos["pnl_pct"] = round(pnl_pct * 100, 3)
    pos["closed_at"] = utcnow().isoformat()
    pos["close_reason"] = reason
    pos["status"] = "CLOSED"
    state["cash"] += pos["size_usd"] + pnl_usd
    state["open_positions"] = [p for p in state["open_positions"] if p["trade_id"] != pos["trade_id"]]
    h = load_history()
    h.append(pos)
    save_history(h)
    save_state(state)
    return pos


# ============================================================
# DECISION ENGINE
# ============================================================
def evaluate_triggers(state, summary, raw):
    """Check pending setups; return list of (setup, entry_price, reason)."""
    triggers = []
    if summary["symbol"] != "SOLUSDT":
        return triggers
    setups = state["pending_setups"].get("SOLUSDT", [])
    price = summary["price"]
    last_15m = raw["k15m"][-1] if raw.get("k15m") else None
    if not last_15m:
        return triggers

    k_open  = float(last_15m[1])
    k_high  = float(last_15m[2])
    k_low   = float(last_15m[3])
    k_close = float(last_15m[4])
    is_bearish_15m = k_close < k_open

    for s in setups:
        if not s.get("active"):
            continue

        if s["trigger"] == "rejection":
            zlow, zhigh = s["entry_zone"]
            # Wick into zone, then close back below + bearish
            if k_high >= zlow and k_close < zlow and is_bearish_15m:
                triggers.append((s, k_close, f"15m wick to ${k_high:.2f} into zone, closed ${k_close:.2f}"))

        elif s["trigger"] == "breakdown":
            thr = s["entry_trigger_below"]
            # 15m close below threshold, opened above (fresh break)
            if k_close < thr and k_open >= thr * 0.998:
                triggers.append((s, k_close, f"15m close ${k_close:.2f} below ${thr:.2f}"))

        elif s["trigger"] == "scout":
            zlow, zhigh = s["entry_zone"]
            if zlow <= price <= zhigh and is_bearish_15m:
                triggers.append((s, price, f"Price ${price:.2f} in scout zone + bearish 15m"))

    return triggers


def evaluate_open_positions(state, summary):
    """Check SL/TP for open positions. Returns list of (pos, exit_price, reason)."""
    closes = []
    price = summary["price"]
    high_24h = summary.get("high_24h", price)
    low_24h  = summary.get("low_24h", price)
    for pos in list(state["open_positions"]):
        if pos["symbol"] != summary["symbol"]:
            continue
        if pos["side"] == "SHORT":
            # SL hit if price reached sl since open
            if high_24h >= pos["sl"] and price >= pos["sl"] * 0.999:
                closes.append((pos, pos["sl"], "STOP LOSS hit"))
                continue
            # TP hit if price reached tp (use lowest tp first that was hit)
            for tp in pos["tp_levels"]:
                if low_24h <= tp and price <= tp * 1.005:
                    closes.append((pos, tp, f"TP @ ${tp:.2f} hit"))
                    break
        else:  # LONG
            if low_24h <= pos["sl"] and price <= pos["sl"] * 1.001:
                closes.append((pos, pos["sl"], "STOP LOSS hit"))
                continue
            for tp in pos["tp_levels"]:
                if high_24h >= tp and price >= tp * 0.995:
                    closes.append((pos, tp, f"TP @ ${tp:.2f} hit"))
                    break
    return closes


# ============================================================
# ALERTS
# ============================================================
def fmt_summary(s):
    div = s.get("divergence_pp")
    div_str = f"{div:+.1f}pp" if div is not None else "N/A"
    return (
        f"💰 *{s['symbol']}*: `${s['price']:.2f}` ({s['change_24h']:+.2f}%)\n"
        f"📊 OI: `${s.get('oi_usd', 0)/1e6:.0f}M` | LS: `{s.get('ls_retail_long_pct', 0):.1f}%`\n"
        f"🐋 Smart: `{s.get('ls_smart_long_pct', 0):.1f}%` | Div: `{div_str}`\n"
        f"⚡ Taker: `{s.get('taker_latest', 0):.2f}` (3h `{s.get('taker_avg_3h', 0):.2f}`)"
    )

def alert_trigger(pos, reason, summary):
    side_emoji = "📉" if pos["side"] == "SHORT" else "📈"
    tps = " / ".join(f"${tp:.2f}" for tp in pos["tp_levels"])
    msg = (
        f"🔥 *TRIGGER - {pos['setup_id']}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"{side_emoji} *{pos['side']} {pos['symbol']}*\n"
        f"Trade  : `{pos['trade_id']}`\n"
        f"Entry  : `${pos['entry_price']:.2f}`\n"
        f"Size   : `${pos['size_usd']}` ({pos['qty']:.3f} unit)\n"
        f"SL     : `${pos['sl']:.2f}`\n"
        f"TPs    : `{tps}`\n"
        f"Reason : _{reason}_\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"{fmt_summary(summary)}"
    )
    tg_send(msg)

def alert_close(pos, reason, equity):
    pnl_emoji = "✅" if pos["pnl_usd"] > 0 else "❌"
    msg = (
        f"{pnl_emoji} *CLOSE - {pos['trade_id']}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"{pos['symbol']} {pos['side']}\n"
        f"Entry  : `${pos['entry_price']:.2f}`\n"
        f"Exit   : `${pos['exit_price']:.2f}`\n"
        f"P&L    : `${pos['pnl_usd']:+.2f}` ({pos['pnl_pct']:+.2f}%)\n"
        f"Reason : _{reason}_\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 Equity: `${equity:.2f}`"
    )
    tg_send(msg)

def alert_periodic(state, summaries):
    parts = ["🟡 *HERMES PULSE*", "━━━━━━━━━━━━━━━━━━━━"]
    for s in summaries.values():
        parts.append(fmt_summary(s))
        parts.append("")
    open_count = len(state["open_positions"])
    pending = sum(1 for ss in state["pending_setups"].values() for x in ss if x["active"])
    parts.append(f"📌 Open: `{open_count}` | Pending: `{pending}` | Cash: `${state['cash']:.0f}`")
    tg_send("\n".join(parts))

def daily_report(state, summaries):
    history = load_history()
    today = utcnow().strftime("%Y-%m-%d")
    closed_today = [t for t in history if t.get("closed_at", "").startswith(today)]
    wins = [t for t in history if t["pnl_usd"] > 0]
    losses = [t for t in history if t["pnl_usd"] <= 0]

    unreal = 0.0
    for pos in state["open_positions"]:
        sym = pos["symbol"]
        if sym in summaries:
            px = summaries[sym]["price"]
            if pos["side"] == "SHORT":
                unreal += (pos["entry_price"] - px) / pos["entry_price"] * pos["size_usd"]
            else:
                unreal += (px - pos["entry_price"]) / pos["entry_price"] * pos["size_usd"]

    equity = state["cash"] + sum(p["size_usd"] for p in state["open_positions"]) + unreal
    pnl_total = equity - state["modal_awal"]
    pnl_pct = pnl_total / state["modal_awal"] * 100

    win_rate = len(wins) / len(history) * 100 if history else 0
    skill = "ROOKIE"
    if len(history) >= 50 and win_rate >= 70: skill = "EXPERT"
    elif len(history) >= 25 and win_rate >= 60: skill = "ADVANCED"
    elif len(history) >= 10 and win_rate >= 50: skill = "INTERMEDIATE"

    lines = [
        f"📊 *HERMES DAILY REPORT*",
        f"_{utcnow().strftime('%Y-%m-%d %H:%M UTC')}_",
        "━━━━━━━━━━━━━━━━━━━━",
        f"💼 Equity     : `${equity:.2f}`",
        f"💰 P&L total  : `${pnl_total:+.2f}` ({pnl_pct:+.2f}%)",
        f"💵 Cash bebas : `${state['cash']:.2f}`",
        f"📈 Unrealized : `${unreal:+.2f}`",
        "",
        f"🎯 Total trades  : `{len(history)}`",
        f"✅ Wins / ❌ Losses : `{len(wins)}` / `{len(losses)}`",
        f"📊 Win rate      : `{win_rate:.1f}%`",
        f"🏆 Skill         : *{skill}*",
        "",
        f"📅 Closed hari ini : `{len(closed_today)}`",
        f"🔓 Posisi terbuka  : `{len(state['open_positions'])}`",
    ]
    for s in summaries.values():
        lines.append("")
        lines.append(fmt_summary(s))
    tg_send("\n".join(lines))
    state["last_daily_report_date"] = today
    save_state(state)


# ============================================================
# MAIN CYCLE
# ============================================================
def run_cycle():
    state = load_state()
    summaries = {}
    raws = {}

    for sym in SYMBOLS:
        raw = fetch_market(sym)
        s = summarize_market(sym, raw)
        if s:
            summaries[sym] = s
            raws[sym] = raw
            snap_path = SNAP_DIR / f"{sym}_{utcnow().strftime('%Y%m%d_%H%M')}.json"
            snap_path.write_text(json.dumps(s, indent=2, default=str))
            log(f"{sym} ${s['price']:.2f} | LS {s.get('ls_retail_long_pct',0):.1f}% | smart {s.get('ls_smart_long_pct',0):.1f}% | taker {s.get('taker_latest',0):.2f}")

    # Check open positions for SL/TP
    for sym, summary in summaries.items():
        for (pos, exit_price, reason) in evaluate_open_positions(state, summary):
            close_position(state, pos, exit_price, reason)
            equity = state["cash"] + sum(p["size_usd"] for p in state["open_positions"])
            alert_close(pos, reason, equity)

    # Check triggers
    for sym, summary in summaries.items():
        for (setup, entry_price, reason) in evaluate_triggers(state, summary, raws[sym]):
            pos = open_position(state, setup, entry_price, reason)
            alert_trigger(pos, reason, summary)

    # Periodic pulse if significant change
    last = state.get("last_snapshot", {})
    significant = False
    for sym, s in summaries.items():
        prev = last.get(sym, {})
        if not prev:
            significant = True
        else:
            if abs(s["price"] - prev.get("price", s["price"])) / s["price"] > 0.005:
                significant = True
            if abs(s.get("ls_retail_long_pct", 0) - prev.get("ls_retail_long_pct", 0)) > 1.0:
                significant = True
    state["last_snapshot"] = summaries
    save_state(state)

    if significant:
        alert_periodic(state, summaries)

    # Daily report
    today = utcnow().strftime("%Y-%m-%d")
    if utcnow().hour == DAILY_REPORT_HOUR_UTC and state.get("last_daily_report_date") != today:
        daily_report(state, summaries)


def main():
    loop = "--loop" in sys.argv
    log(f"HERMES bot start | loop={loop} | symbols={SYMBOLS} | poll={POLL_INTERVAL_SEC}s")
    if "--startup-msg" in sys.argv:
        tg_send("🟢 *HERMES BOT STARTED*\nAutonomous polling aktif.")
    try:
        while True:
            try:
                run_cycle()
            except Exception as e:
                log(f"CYCLE ERROR: {e}")
                tg_send(f"⚠️ *Hermes error*: `{str(e)[:200]}`")
            if not loop:
                break
            time.sleep(POLL_INTERVAL_SEC)
    except KeyboardInterrupt:
        log("Stopped by user")


if __name__ == "__main__":
    main()
