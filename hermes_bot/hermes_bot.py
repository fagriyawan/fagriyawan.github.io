#!/usr/bin/env python3
"""
HERMES TRADING BOT v2 - Auto Git Sync Edition
==============================================
Autonomous paper trading bot with bidirectional Git sync.

Architecture:
  setups.json          ← Hermes (AI) writes, bot reads each cycle
  HERMES_RULE_BOOK.md  ← Hermes writes (human-readable reasoning)
  trade_history.json   ← Bot writes after every trade close
  state.json           ← Bot writes (portfolio, positions, last poll)
  snapshots/*.json     ← Bot writes (market data archives)
  lessons_log.md       ← Bot appends auto-lessons after each trade

Usage in Termux:
  pkg install python git
  git clone -b hermes-trading-bot https://github.com/fagriyawan/fagriyawan.github.io.git hermes
  cd hermes/hermes_bot
  cp .env.example .env
  # edit .env to set TG_TOKEN, TG_CHAT_ID, GITHUB_TOKEN
  bash setup_termux.sh
  python hermes_bot.py --loop

Required env vars (or set in .env):
  TG_TOKEN       - Telegram bot token
  TG_CHAT_ID     - Telegram chat id
  GITHUB_TOKEN   - GitHub Personal Access Token (repo write scope)
  GITHUB_REPO    - owner/name (default: fagriyawan/fagriyawan.github.io)
  GITHUB_BRANCH  - branch name (default: hermes-trading-bot)
"""

import os
import sys
import json
import time
import urllib.request
import ssl
import subprocess
from datetime import datetime, timezone
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================
def _env_or_dotenv():
    """Load .env file into os.environ if it exists."""
    here = Path(__file__).parent
    dotenv = here / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            if k.strip() and v:
                os.environ.setdefault(k.strip(), v)

_env_or_dotenv()

TG_TOKEN     = os.environ.get("TG_TOKEN", "")
TG_CHAT_ID   = int(os.environ.get("TG_CHAT_ID", "0") or "0")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO  = os.environ.get("GITHUB_REPO", "fagriyawan/fagriyawan.github.io")
GITHUB_BRANCH= os.environ.get("GITHUB_BRANCH", "hermes-trading-bot")

POLL_INTERVAL_SEC     = int(os.environ.get("POLL_INTERVAL_SEC", "180"))   # 3 min default
DAILY_REPORT_HOUR_UTC = int(os.environ.get("DAILY_REPORT_HOUR_UTC", "0"))
SNAPSHOT_KEEP_LAST    = int(os.environ.get("SNAPSHOT_KEEP_LAST", "240"))   # ~12h at 3min
HEARTBEAT_GIT_PUSH_MIN = int(os.environ.get("HEARTBEAT_GIT_PUSH_MIN", "30"))  # push state every 30min

BOT_DIR    = Path(__file__).parent.resolve()
REPO_ROOT  = BOT_DIR.parent
SETUPS_FILE   = BOT_DIR / "setups.json"
STATE_FILE    = BOT_DIR / "state.json"
HISTORY_FILE  = BOT_DIR / "trade_history.json"
LESSONS_FILE  = BOT_DIR / "lessons_log.md"
SNAP_DIR      = BOT_DIR / "snapshots"
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
    req = urllib.request.Request(url, headers={'User-Agent': 'HermesBot/2.0'})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return json.loads(r.read().decode())

def http_get_with_fallback(urls, timeout=10):
    """Try each URL in order, return (data, source) on first success."""
    last_err = None
    for url in urls:
        try:
            return http_get_json(url, timeout), url
        except Exception as e:
            last_err = e
            continue
    raise last_err if last_err else Exception("no urls provided")

def http_post_json(url, payload, timeout=15):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
                                  headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return json.loads(r.read().decode())


# ============================================================
# GIT SYNC
# ============================================================
def git(*args, check=False, capture=True):
    """Run git command in repo root. Returns CompletedProcess."""
    return subprocess.run(
        ["git"] + list(args),
        cwd=str(REPO_ROOT),
        check=check,
        capture_output=capture,
        text=True,
        timeout=60,
    )

def git_configure_remote():
    """Configure remote URL with token-based auth (Termux-friendly)."""
    if not GITHUB_TOKEN:
        log("GITHUB_TOKEN missing — git push will fail. Run in read-only mode.")
        return False
    url = f"https://x-access-token:{GITHUB_TOKEN}@github.com/{GITHUB_REPO}.git"
    try:
        git("remote", "set-url", "origin", url)
        git("config", "user.email", "hermes-bot@noreply.local")
        git("config", "user.name", "Hermes Bot")
        return True
    except Exception as e:
        log(f"git remote configure FAIL: {e}")
        return False

def git_pull():
    """Pull latest changes from remote (rules updates from Hermes)."""
    try:
        # Save local-only files first (state.json, snapshots, history)
        # These are committed by bot but might be ahead. Use rebase to resolve.
        result = git("pull", "--rebase", "--autostash", "origin", GITHUB_BRANCH)
        if result.returncode == 0:
            return True
        log(f"git pull stderr: {result.stderr}")
        return False
    except Exception as e:
        log(f"git pull FAIL: {e}")
        return False

def git_push_files(files, message):
    """Stage given files, commit, push."""
    if not GITHUB_TOKEN:
        log("git push skipped (no GITHUB_TOKEN)")
        return False
    try:
        for f in files:
            rel = str(Path(f).relative_to(REPO_ROOT))
            git("add", rel)
        # Check if anything staged
        st = git("diff", "--cached", "--quiet")
        if st.returncode == 0:
            log("git: no changes to commit")
            return True
        git("commit", "-m", message)
        result = git("push", "origin", GITHUB_BRANCH)
        if result.returncode == 0:
            log(f"git pushed: {message}")
            return True
        log(f"git push stderr: {result.stderr}")
        return False
    except Exception as e:
        log(f"git push FAIL: {e}")
        return False


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
def _gate_symbol(symbol):
    """Convert SOLUSDT -> SOL_USDT (Gate.io format)."""
    if symbol.endswith("USDT"):
        return symbol[:-4] + "_USDT"
    return symbol

def fetch_market(symbol):
    """Fetch market data — Gate.io PRIMARY, multi-source fallback.

    Priority (Indonesia-friendly, no Binance dependency):
      1. Gate.io contract_stats — gives OI + LS retail + LS top (smart) + taker
         in ONE call. Plus funding rate. Not geo-blocked.
      2. Bitget — fallback for ticker + LS account
      3. OKX — fallback for OI + LS account
      4. Binance (data-api.binance.vision) — spot ticker/klines (usually works)

    Adapts everything to Binance-equivalent schema for downstream code.
    """
    out = {"sources": {}}
    gate_sym = _gate_symbol(symbol)

    # =========================================================
    # 1. Gate.io contract_stats — JACKPOT endpoint
    # =========================================================
    try:
        stats = http_get_json(
            f"https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract={gate_sym}&interval=1h&limit=24"
        )
        if isinstance(stats, list) and stats:
            # Adapt to Binance schemas
            # OI history
            oi_hist = []
            ls_global_hist = []
            ls_top_hist = []
            taker_hist = []
            last_price_gate = float(stats[-1].get("mark_price", 0))
            for s in stats:
                ts = int(s["time"]) * 1000
                oi_units = float(s.get("open_interest", 0))
                oi_hist.append({
                    "symbol": symbol,
                    "sumOpenInterest": str(oi_units),
                    "sumOpenInterestValue": str(oi_units * last_price_gate),
                    "timestamp": ts,
                })
                # lsr_account = long/short ratio (e.g. 2.44 = 2.44 long per short)
                lsr_acc = float(s.get("lsr_account", 1))
                long_pct = lsr_acc / (1 + lsr_acc) if lsr_acc > 0 else 0.5
                ls_global_hist.append({
                    "symbol": symbol,
                    "longAccount": str(long_pct),
                    "shortAccount": str(1 - long_pct),
                    "longShortRatio": str(lsr_acc),
                    "timestamp": ts,
                })
                # top_lsr_size = top trader long/short ratio by size (smart money)
                lsr_top = float(s.get("top_lsr_size", 1))
                top_long_pct = lsr_top / (1 + lsr_top) if lsr_top > 0 else 0.5
                ls_top_hist.append({
                    "symbol": symbol,
                    "longAccount": str(top_long_pct),
                    "shortAccount": str(1 - top_long_pct),
                    "longShortRatio": str(lsr_top),
                    "timestamp": ts,
                })
                # lsr_taker = taker buy/sell ratio
                taker_ratio = float(s.get("lsr_taker", 1))
                taker_hist.append({
                    "buySellRatio": str(taker_ratio),
                    "buyVol": "0",
                    "sellVol": "0",
                    "timestamp": ts,
                })
            out["oi"] = oi_hist
            out["ls_global"] = ls_global_hist
            out["ls_topPos"] = ls_top_hist
            out["taker"] = taker_hist
            out["sources"]["oi"] = "gate.io"
            out["sources"]["ls_global"] = "gate.io"
            out["sources"]["ls_topPos"] = "gate.io"
            out["sources"]["taker"] = "gate.io"
            # BONUS: extract liquidation data
            last = stats[-1]
            out["liquidation_24h"] = {
                "long_usd": sum(float(s.get("long_liq_usd", 0)) for s in stats),
                "short_usd": sum(float(s.get("short_liq_usd", 0)) for s in stats),
            }
            log(f"Gate.io stats OK: OI={float(last['open_interest']):.0f}, "
                f"LS={float(last['lsr_account']):.2f}, top={float(last['top_lsr_size']):.2f}, "
                f"taker={float(last['lsr_taker']):.2f}")
    except Exception as e:
        log(f"Gate.io contract_stats FAIL: {e}")

    # =========================================================
    # 2. Funding rate (BONUS — Binance fapi was blocked)
    # =========================================================
    try:
        fr = http_get_json(
            f"https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract={gate_sym}&limit=8"
        )
        if isinstance(fr, list) and fr:
            out["funding"] = fr
            out["sources"]["funding"] = "gate.io"
    except Exception as e:
        log(f"Gate.io funding FAIL: {e}")

    # =========================================================
    # 3. Spot ticker — try Gate.io, Bitget, then Binance vision
    # =========================================================
    ticker_sources = [
        ("gate.io", f"https://api.gateio.ws/api/v4/spot/tickers?currency_pair={gate_sym}"),
        ("bitget",  f"https://api.bitget.com/api/v2/mix/market/ticker?symbol={symbol}&productType=USDT-FUTURES"),
        ("binance-vision", f"{BASE_SPOT}/api/v3/ticker/24hr?symbol={symbol}"),
    ]
    for src, url in ticker_sources:
        try:
            d = http_get_json(url)
            if src == "gate.io" and isinstance(d, list) and d:
                t = d[0]
                # Adapt Gate spot ticker to Binance ticker schema
                last = float(t["last"])
                out["ticker"] = {
                    "symbol": symbol,
                    "lastPrice": t["last"],
                    "priceChangePercent": t["change_percentage"],
                    "highPrice": t["high_24h"],
                    "lowPrice": t["low_24h"],
                    "openPrice": str(last / (1 + float(t["change_percentage"])/100)),
                    "volume": t["base_volume"],
                    "quoteVolume": t["quote_volume"],
                }
            elif src == "bitget" and d.get("code") == "00000" and d.get("data"):
                t = d["data"][0]
                last = float(t["lastPr"])
                high = float(t["high24h"])
                low = float(t["low24h"])
                change_pct = float(t.get("change24h", 0)) * 100
                out["ticker"] = {
                    "symbol": symbol,
                    "lastPrice": str(last),
                    "priceChangePercent": str(change_pct),
                    "highPrice": str(high),
                    "lowPrice": str(low),
                    "openPrice": str(last / (1 + change_pct/100)) if change_pct else str(last),
                    "volume": t.get("baseVolume", "0"),
                    "quoteVolume": t.get("quoteVolume", "0"),
                }
            elif src == "binance-vision":
                out["ticker"] = d
            out["sources"]["ticker"] = src
            break
        except Exception:
            continue
    if not out.get("ticker"):
        log(f"All ticker sources FAILED for {symbol}")

    # =========================================================
    # 4. Klines — Gate.io futures, then Binance spot
    # =========================================================
    def gate_klines(interval, limit):
        url = f"https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract={gate_sym}&interval={interval}&limit={limit}"
        d = http_get_json(url)
        # Adapt Gate kline schema to Binance schema [openTime, o, h, l, c, vol, ...]
        return [
            [int(k["t"])*1000, k["o"], k["h"], k["l"], k["c"], k["v"], 0, k.get("sum","0"), 0, 0, 0, 0]
            for k in d
        ]

    kline_specs = {"k4h": ("4h", 30), "k1h": ("1h", 24), "k15m": ("15m", 8)}
    for k, (interval, limit) in kline_specs.items():
        success = False
        # Try Gate.io first
        try:
            out[k] = gate_klines(interval, limit)
            out["sources"][k] = "gate.io"
            success = True
        except Exception as e:
            log(f"Gate klines {interval} FAIL: {str(e)[:60]}")
        if not success:
            try:
                out[k] = http_get_json(f"{BASE_SPOT}/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}")
                out["sources"][k] = "binance-vision"
            except Exception as e:
                log(f"Binance klines {interval} FAIL: {str(e)[:60]}")
                out[k] = None

    return out


def summarize_market(symbol, raw):
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
# STATE & SETUPS
# ============================================================
DEFAULT_STATE = {
    "version": "2.0",
    "started_at": None,
    "modal_awal": 10000.00,
    "cash": 10000.00,
    "open_positions": [],
    "consumed_setup_ids": [],
    "last_snapshot": {},
    "last_daily_report_date": None,
    "last_setups_hash": "",
    "trade_counter": 0,
}

def load_setups():
    if not SETUPS_FILE.exists():
        log("setups.json missing, no setups loaded")
        return {"setups": {}}
    try:
        return json.loads(SETUPS_FILE.read_text())
    except Exception as e:
        log(f"setups.json parse error: {e}")
        return {"setups": {}}

def setups_hash():
    if SETUPS_FILE.exists():
        import hashlib
        return hashlib.md5(SETUPS_FILE.read_bytes()).hexdigest()
    return ""

def load_state():
    if STATE_FILE.exists():
        try: return json.loads(STATE_FILE.read_text())
        except: pass
    s = dict(DEFAULT_STATE)
    s["started_at"] = utcnow().isoformat()
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
# AUTO-LESSONS (bot writes its own observations after trades)
# ============================================================
def append_lesson(trade, market_at_close):
    """After each closed trade, append a structured lesson entry."""
    won = trade["pnl_usd"] > 0
    tag = "LESSON_WIN" if won else "LESSON_LOSS"
    counter = len(load_history())
    entry = f"""
─────────────────────────────────────────
[{tag}_{counter:03d}] {trade['trade_id']}
Time     : {trade['closed_at']}
Symbol   : {trade['symbol']} {trade['side']}
Setup    : {trade['setup_id']}
Entry    : ${trade['entry_price']:.2f}
Exit     : ${trade['exit_price']:.2f}
Reason   : {trade['close_reason']}
P&L      : ${trade['pnl_usd']:+.2f} ({trade['pnl_pct']:+.2f}%)
Duration : {trade['opened_at']} -> {trade['closed_at']}

Market context at entry (saved in trade_history.json)
Market context at close:
  Price now    : ${market_at_close.get('price', 0):.2f}
  L/S retail   : {market_at_close.get('ls_retail_long_pct', 0):.2f}%
  L/S smart    : {market_at_close.get('ls_smart_long_pct', 0):.2f}%
  Divergence   : {market_at_close.get('divergence_pp', 0):+.2f}pp
  Taker        : {market_at_close.get('taker_latest', 0):.3f}
  OI           : ${market_at_close.get('oi_usd', 0)/1e6:.1f}M

Auto observation:
"""
    if won:
        entry += f"  Trade WIN. Setup '{trade['setup_id']}' valid in observed conditions.\n"
        entry += f"  Hermes review TODO: confirm pattern, possibly increase confidence/size.\n"
    else:
        entry += f"  Trade LOSS. Setup '{trade['setup_id']}' failed.\n"
        entry += f"  Hermes review TODO: identify what signal should have prevented entry.\n"
        entry += f"  Add to DAFTAR_SINYAL_BAHAYA after analysis.\n"

    # Append to lessons file
    if not LESSONS_FILE.exists():
        LESSONS_FILE.write_text("# HERMES Lessons Log (auto-appended by bot)\n\n_Hermes (AI) reviews this periodically and updates HERMES_RULE_BOOK.md_\n")
    with open(LESSONS_FILE, "a") as f:
        f.write(entry)
    return entry


# ============================================================
# TRADE EXECUTION
# ============================================================
def open_position(state, setup, entry_price, reason, market):
    state["trade_counter"] += 1
    tp_levels = [v for v in [setup.get("tp1"), setup.get("tp2"), setup.get("tp3")] if v]
    pos = {
        "trade_id": f"TRADE_{state['trade_counter']:04d}",
        "setup_id": setup["id"],
        "symbol": setup.get("_symbol", "SOLUSDT"),
        "side": setup["side"],
        "entry_price": round(entry_price, 4),
        "size_usd": setup["size_usd"],
        "qty": round(setup["size_usd"] / entry_price, 4),
        "sl": setup["sl"],
        "tp_levels": tp_levels,
        "opened_at": utcnow().isoformat(),
        "reason": reason,
        "status": "OPEN",
        "market_at_open": market,
    }
    state["open_positions"].append(pos)
    state["consumed_setup_ids"].append(setup["id"])
    state["cash"] -= setup["size_usd"]
    save_state(state)
    return pos

def close_position(state, pos, exit_price, reason, market_at_close):
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
    pos["market_at_close"] = market_at_close
    state["cash"] += pos["size_usd"] + pnl_usd
    state["open_positions"] = [p for p in state["open_positions"] if p["trade_id"] != pos["trade_id"]]
    h = load_history()
    h.append(pos)
    save_history(h)
    append_lesson(pos, market_at_close)
    save_state(state)
    return pos


# ============================================================
# DECISION ENGINE
# ============================================================
def has_critical_data_missing(summary, raw):
    """Returns list of missing data keys."""
    missing = []
    if not summary or not summary.get("price"):
        missing.append("price")
    if not raw.get("k15m"):
        missing.append("k15m")
    if not raw.get("oi") or summary.get("oi_usd") is None:
        missing.append("oi")
    if not raw.get("ls_global") or summary.get("ls_retail_long_pct") is None:
        missing.append("ls_global")
    if not raw.get("ls_topPos") or summary.get("ls_smart_long_pct") is None:
        missing.append("ls_smart")
    if not raw.get("taker") or summary.get("taker_latest") is None:
        missing.append("taker")
    return missing


def evaluate_triggers(state, summary, raw, setups_data):
    triggers = []
    sym = summary["symbol"]
    setups_for_sym = setups_data.get("setups", {}).get(sym, [])
    if not setups_for_sym:
        return triggers
    if not raw.get("k15m"):
        return triggers

    # Data quality gate
    missing = has_critical_data_missing(summary, raw)
    critical_missing = [m for m in missing if m in ("price", "k15m")]
    if critical_missing:
        log(f"BLOCKED: critical data missing {critical_missing}")
        return triggers

    sentiment_missing = [m for m in missing if m in ("oi", "ls_global", "ls_smart", "taker")]
    sentiment_blackout = len(sentiment_missing) >= 3
    if sentiment_blackout:
        log(f"WARN: sentiment blackout ({sentiment_missing}) — only scout setups allowed")

    last_15m = raw["k15m"][-1]
    k_open  = float(last_15m[1])
    k_high  = float(last_15m[2])
    k_low   = float(last_15m[3])
    k_close = float(last_15m[4])
    is_bearish_15m = k_close < k_open
    price = summary["price"]

    consumed = set(state.get("consumed_setup_ids", []))

    for s in setups_for_sym:
        if not s.get("active"):
            continue
        if s["id"] in consumed:
            continue
        s["_symbol"] = sym

        # During sentiment blackout, only allow small scout setups
        if sentiment_blackout and s["trigger"] != "scout":
            continue

        if s["trigger"] == "rejection":
            zlow, zhigh = s["entry_zone"]
            if k_high >= zlow and k_close < zlow and is_bearish_15m:
                triggers.append((s, k_close, f"15m wick to ${k_high:.2f} into rejection zone, closed ${k_close:.2f}"))

        elif s["trigger"] == "breakdown":
            thr = s["entry_trigger_below"]
            if k_close < thr and k_open >= thr * 0.998:
                triggers.append((s, k_close, f"15m close ${k_close:.2f} broke below ${thr:.2f}"))

        elif s["trigger"] == "scout":
            zlow, zhigh = s["entry_zone"]
            if zlow <= price <= zhigh and is_bearish_15m:
                triggers.append((s, price, f"Price ${price:.2f} in scout zone + bearish 15m"))

    return triggers


def evaluate_open_positions(state, summary):
    """Check SL/TP. Tracks max_high_seen and min_low_seen per position
    since open, updated each cycle. Avoids using 24h high/low which can
    span before position was opened.
    """
    closes = []
    price = summary["price"]
    high_15m = summary.get("k15m_high", price)
    low_15m  = summary.get("k15m_low", price)
    for pos in list(state["open_positions"]):
        if pos["symbol"] != summary["symbol"]:
            continue

        # Update high/low watermark since open
        prev_high = pos.get("max_high_since_open", pos["entry_price"])
        prev_low  = pos.get("min_low_since_open", pos["entry_price"])
        pos["max_high_since_open"] = max(prev_high, high_15m, price)
        pos["min_low_since_open"]  = min(prev_low,  low_15m,  price)

        if pos["side"] == "SHORT":
            # SL: price reached SL since open OR currently near SL
            if pos["max_high_since_open"] >= pos["sl"] or price >= pos["sl"]:
                closes.append((pos, pos["sl"], "STOP LOSS hit (price reached SL)"))
                continue
            # TP: only fire if price touched TP level since open or current at TP
            for tp in pos["tp_levels"]:
                if pos["min_low_since_open"] <= tp or price <= tp:
                    closes.append((pos, tp, f"TP @ ${tp:.2f} hit"))
                    break
        else:  # LONG
            if pos["min_low_since_open"] <= pos["sl"] or price <= pos["sl"]:
                closes.append((pos, pos["sl"], "STOP LOSS hit (price reached SL)"))
                continue
            for tp in pos["tp_levels"]:
                if pos["max_high_since_open"] >= tp or price >= tp:
                    closes.append((pos, tp, f"TP @ ${tp:.2f} hit"))
                    break
    return closes


# ============================================================
# ALERTS
# ============================================================
def fmt_summary(s):
    div = s.get("divergence_pp")
    div_str = f"{div:+.1f}pp" if div is not None else "N/A"
    oi_str = f"${s['oi_usd']/1e6:.0f}M" if s.get("oi_usd") else "N/A"
    ls_str = f"{s['ls_retail_long_pct']:.1f}%" if s.get("ls_retail_long_pct") is not None else "N/A"
    smart_str = f"{s['ls_smart_long_pct']:.1f}%" if s.get("ls_smart_long_pct") is not None else "N/A"
    taker_str = f"{s['taker_latest']:.2f}" if s.get("taker_latest") is not None else "N/A"
    taker_avg = f"{s['taker_avg_3h']:.2f}" if s.get("taker_avg_3h") is not None else "N/A"
    return (
        f"💰 *{s['symbol']}*: `${s['price']:.2f}` ({s['change_24h']:+.2f}%)\n"
        f"📊 OI: `{oi_str}` | LS: `{ls_str}`\n"
        f"🐋 Smart: `{smart_str}` | Div: `{div_str}`\n"
        f"⚡ Taker: `{taker_str}` (3h `{taker_avg}`)"
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

def alert_setups_updated():
    tg_send("📚 *RULES UPDATED*\nHermes pushed new setups. Bot now using updated `setups.json`.")

def alert_periodic(state, summaries):
    parts = ["🟡 *HERMES PULSE*", "━━━━━━━━━━━━━━━━━━━━"]
    for s in summaries.values():
        parts.append(fmt_summary(s))
        parts.append("")
    open_count = len(state["open_positions"])
    parts.append(f"📌 Open: `{open_count}` | Cash: `${state['cash']:.0f}`")
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
        f"🎯 Total trades : `{len(history)}`",
        f"✅ Wins/❌ Loss : `{len(wins)}` / `{len(losses)}`",
        f"📊 Win rate     : `{win_rate:.1f}%`",
        f"🏆 Skill        : *{skill}*",
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

    # 1. Pull latest rules from Hermes
    pulled = git_pull()
    new_hash = setups_hash()
    if pulled and state.get("last_setups_hash") and new_hash != state["last_setups_hash"]:
        log(f"setups.json changed (hash {state['last_setups_hash'][:8]} -> {new_hash[:8]})")
        alert_setups_updated()
    state["last_setups_hash"] = new_hash

    # 2. Fetch market data
    setups_data = load_setups()
    symbols = setups_data.get("symbols", ["SOLUSDT"])
    summaries, raws = {}, {}
    for sym in symbols:
        raw = fetch_market(sym)
        s = summarize_market(sym, raw)
        if s:
            summaries[sym] = s
            raws[sym] = raw
            snap_path = SNAP_DIR / f"{sym}_{utcnow().strftime('%Y%m%d_%H%M')}.json"
            snap_path.write_text(json.dumps(s, indent=2, default=str))
            log(f"{sym} ${s['price']:.2f} | LS {s.get('ls_retail_long_pct',0):.1f}% | smart {s.get('ls_smart_long_pct',0):.1f}% | taker {s.get('taker_latest',0):.2f}")

    # 3. Evaluate open positions (close on SL/TP)
    closed_any = False
    for sym, summary in summaries.items():
        for (pos, exit_price, reason) in evaluate_open_positions(state, summary):
            close_position(state, pos, exit_price, reason, summary)
            equity = state["cash"] + sum(p["size_usd"] for p in state["open_positions"])
            alert_close(pos, reason, equity)
            closed_any = True

    # 4. Evaluate triggers (open new)
    opened_any = False
    for sym, summary in summaries.items():
        for (setup, entry_price, reason) in evaluate_triggers(state, summary, raws[sym], setups_data):
            pos = open_position(state, setup, entry_price, reason, summary)
            alert_trigger(pos, reason, summary)
            opened_any = True

    # 5. Pulse if significant change
    last = state.get("last_snapshot", {})
    significant = False
    for sym, s in summaries.items():
        prev = last.get(sym, {})
        if not prev:
            significant = True
        else:
            if abs(s["price"] - prev.get("price", s["price"])) / max(s["price"], 1) > 0.005:
                significant = True
            if abs(s.get("ls_retail_long_pct", 0) - prev.get("ls_retail_long_pct", 0)) > 1.0:
                significant = True
    state["last_snapshot"] = summaries
    save_state(state)
    if significant and not opened_any and not closed_any:
        alert_periodic(state, summaries)

    # 6. Daily report
    today = utcnow().strftime("%Y-%m-%d")
    if utcnow().hour == DAILY_REPORT_HOUR_UTC and state.get("last_daily_report_date") != today:
        daily_report(state, summaries)

    # 7. Cleanup old snapshots (keep last N files)
    try:
        all_snaps = sorted(SNAP_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
        if len(all_snaps) > SNAPSHOT_KEEP_LAST:
            for old in all_snaps[:-SNAPSHOT_KEEP_LAST]:
                old.unlink()
    except Exception as e:
        log(f"snapshot cleanup FAIL: {e}")

    # 8. Push bot-owned files to git (throttled — not every cycle to avoid commit spam)
    bot_files = [STATE_FILE, HISTORY_FILE, LESSONS_FILE]
    bot_files = [f for f in bot_files if f.exists()]
    if closed_any or opened_any:
        # Always push immediately on trade events
        commit_msg = f"[bot] {utcnow().strftime('%Y-%m-%d %H:%M')} - {('opened' if opened_any else '')+('+closed' if closed_any else '')}"
        git_push_files(bot_files, commit_msg)
        state["last_git_push_minute"] = int(utcnow().timestamp() // 60)
        save_state(state)
    else:
        # Heartbeat push every HEARTBEAT_GIT_PUSH_MIN minutes
        last_push_min = state.get("last_git_push_minute", 0)
        now_min = int(utcnow().timestamp() // 60)
        if now_min - last_push_min >= HEARTBEAT_GIT_PUSH_MIN:
            if git_push_files(bot_files, f"[bot] heartbeat {utcnow().strftime('%Y-%m-%d %H:%M')}"):
                state["last_git_push_minute"] = now_min
                save_state(state)


def startup():
    log(f"HERMES bot v2 start | repo={GITHUB_REPO}@{GITHUB_BRANCH}")
    log(f"  TG: {'configured' if TG_TOKEN and TG_CHAT_ID else 'MISSING'}")
    log(f"  GIT: {'configured' if GITHUB_TOKEN else 'READ-ONLY (no token)'}")
    log(f"  Poll interval: {POLL_INTERVAL_SEC}s")
    if GITHUB_TOKEN:
        git_configure_remote()
    if "--startup-msg" in sys.argv:
        loaded = load_setups()
        n_setups = sum(len(v) for v in loaded.get("setups", {}).values())
        tg_send(
            f"🟢 *HERMES BOT v2 STARTED*\n"
            f"Repo: `{GITHUB_REPO}@{GITHUB_BRANCH}`\n"
            f"Symbols: `{', '.join(loaded.get('symbols', []))}`\n"
            f"Active setups: `{n_setups}`\n"
            f"Poll: every `{POLL_INTERVAL_SEC//60}` minutes\n"
            f"Git sync: `{'ON' if GITHUB_TOKEN else 'OFF (read-only)'}`"
        )


def main():
    loop = "--loop" in sys.argv
    once = "--once" in sys.argv
    startup()
    try:
        while True:
            try:
                run_cycle()
            except Exception as e:
                log(f"CYCLE ERROR: {e}")
                tg_send(f"⚠️ *Hermes bot error*: `{str(e)[:200]}`")
            if once or not loop:
                break
            time.sleep(POLL_INTERVAL_SEC)
    except KeyboardInterrupt:
        log("Stopped by user")


if __name__ == "__main__":
    main()
