# HERMES Trading Bot

Autonomous paper trading bot. Polls Binance market data, evaluates setups against
the rule book, executes paper trades, and sends Telegram alerts.

**Zero external dependencies** — pure Python 3.7+ standard library only.

## Quick Start

```bash
# Test once (sends a test message + runs one cycle)
python3 hermes_bot.py --startup-msg

# Run forever (polls every 10 minutes)
python3 hermes_bot.py --loop

# Override credentials with env vars
export TG_TOKEN="your_token"
export TG_CHAT_ID="your_chat_id"
python3 hermes_bot.py --loop
```

## Deploy options

### A. Linux VPS (systemd) — RECOMMENDED for 24/7
```ini
# /etc/systemd/system/hermes.service
[Unit]
Description=Hermes Trading Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hermes_bot
ExecStart=/usr/bin/python3 /opt/hermes_bot/hermes_bot.py --loop
Restart=always
User=hermes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now hermes
journalctl -u hermes -f
```

### B. Local cron
```bash
crontab -e
# add:
*/10 * * * * cd /home/user/hermes_bot && /usr/bin/python3 hermes_bot.py >> bot.log 2>&1
```

### C. GitHub Actions (free, every 10 min)
```yaml
# .github/workflows/hermes.yml
name: Hermes
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python3 hermes_bot.py
        env:
          TG_TOKEN: ${{ secrets.TG_TOKEN }}
          TG_CHAT_ID: ${{ secrets.TG_CHAT_ID }}
      - uses: actions/upload-artifact@v4
        with:
          name: hermes-state
          path: |
            state.json
            trade_history.json
            snapshots/
```

### D. Replit / Railway / Render
Upload, set start command to `python3 hermes_bot.py --loop`.

## What each cycle does

1. **Fetch** spot ticker + klines (4h/1h/15m), OI history, retail L/S, smart-money
   L/S (top trader position), taker B/S ratio.
2. **Evaluate open positions** — close on SL or TP, send alert.
3. **Evaluate pending setups** — check trigger conditions, open new position on
   trigger, send alert.
4. **Periodic pulse** — if price moved >0.5% or L/S shifted >1pp.
5. **Daily report** — at 00:00 UTC: equity, win rate, skill level breakdown.

## State files

- `state.json` — portfolio, open positions, pending setups, last snapshot
- `trade_history.json` — all closed trades for stats
- `snapshots/` — periodic timestamped market snapshots

## Pre-loaded setups (TRADE_LOG_SOL_003)

| Setup | Type | Entry | Size | SL | TP1 / TP2 / TP3 |
|---|---|---|---|---|---|
| A | SHORT rejection | $85.20-$85.60 | $300 | $86.10 | $83.50 / $81.63 |
| B | SHORT breakdown | <$83.45 (15m close) | $400 | $84.30 | $81.63 / $80.80 / $76.70 |
| C | SHORT scout | $84.70-$84.90 | $150 | $85.30 | $83.50 / $81.63 |

Total max exposure: $850 (8.5% modal). Aggregate risk: ~$127 (1.27%). Compliant
with RULE #009 (max 1% risk/trade, 10% total exposure).

## Notes

- **Paper trading only.** No real funds touched.
- Endpoints `fapi.binance.com` and `api.binance.com` may be 451-blocked from some
  hosts. Bot uses `data-api.binance.vision` and `www.binance.com/futures/data/...`
  which generally work globally.
- Token in script is the one provided during setup. For production, use env vars:
  `TG_TOKEN` and `TG_CHAT_ID`.
- To extend to more coins, edit `SYMBOLS` and add corresponding setups in
  `bootstrap_setups()`.
