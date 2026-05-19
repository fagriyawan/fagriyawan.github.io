# HERMES Trading Bot v2 — Auto Git Sync Edition

Autonomous paper trading bot yang **belajar bareng Hermes (AI di Kiro)** via Git.

## 🧠 Arsitektur Pembelajaran

```
GitHub repo (single source of truth)
├── setups.json          ← Hermes write, bot read each cycle
├── HERMES_RULE_BOOK.md  ← Hermes write (reasoning)
├── trade_history.json   ← bot write (auto)
├── state.json           ← bot write (auto)
├── lessons_log.md       ← bot append (auto)
└── snapshots/           ← bot write (auto)

[Bot @ Termux]                    [Hermes @ Kiro]
   ↓ git pull tiap cycle              ↑ git pull saat user chat
   - Pakai setups.json terbaru        - Baca lessons_log.md
   - Trade jika trigger valid          - Analisis pola
   ↓ git push setelah trade            - Update setups.json
   - trade_history, state              ↓ git push
   - lessons_log.md                    - Bot pakai rule baru cycle berikutnya
```

## 🚀 Setup di Termux Android

### 1. Install Termux dari F-Droid (BUKAN Play Store!)
[https://f-droid.org/packages/com.termux/](https://f-droid.org/packages/com.termux/)

### 2. Buka Termux dan jalankan:

```bash
# Update package & install dependencies
pkg update -y && pkg install -y python git

# Clone repo (branch khusus bot, bukan main)
git clone -b hermes-trading-bot https://github.com/fagriyawan/fagriyawan.github.io.git hermes
cd hermes/hermes_bot

# Run interactive setup script (akan tanya GitHub token)
bash setup_termux.sh
```

### 3. Get GitHub Personal Access Token

1. Buka [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta) di browser HP
2. **Generate new token** (Fine-grained personal access token)
3. **Token name:** `hermes-bot`
4. **Expiration:** 90 days (atau custom)
5. **Repository access:** Only select repositories → pilih `fagriyawan.github.io`
6. **Permissions:**
   - Contents: **Read and write**
   - Metadata: Read-only (auto)
7. Klik **Generate token**, copy token-nya
8. Paste ke setup script saat ditanya

### 4. Run dalam loop mode (24/7)

```bash
# Cara 1: foreground (cocok untuk testing)
python hermes_bot.py --loop

# Cara 2: background dengan nohup (cocok produksi)
nohup python hermes_bot.py --loop > bot.log 2>&1 &
echo "Bot PID: $!"

# Cara 3: background dengan tmux (recommended)
pkg install tmux
tmux new -s hermes
python hermes_bot.py --loop
# Detach: Ctrl+B lalu D
# Re-attach: tmux attach -t hermes
```

### 5. Cegah Termux dimatikan Android

Di Termux:
```bash
termux-wake-lock
```

Di setting HP:
- **Battery optimization:** disable untuk Termux
- **Background activity:** allowed

## 📡 Pesan Telegram yang akan Anda terima

| Trigger | Format |
|---|---|
| 🟢 Startup | Bot mulai, jumlah setups aktif |
| 🔥 TRIGGER | Setup A/B/C trigger → entry baru |
| ✅/❌ CLOSE | SL/TP hit, P&L diumumkan |
| 🟡 PULSE | Price gerak >0.5% atau LS shift >1pp |
| 📊 DAILY | Tiap 00:00 UTC: equity, win rate, skill |
| 📚 RULES | Hermes push setups.json baru |
| ⚠️ ERROR | Kalau ada masalah |

## 🔄 Loop Pembelajaran (yang bikin bot makin pintar)

### Langkah 1 — Bot trade otomatis di Termux
Bot pull `setups.json` setiap 10 menit. Kalau trigger valid, eksekusi.
Setelah close, push `trade_history.json` + append `lessons_log.md` ke git.

### Langkah 2 — Anda chat Hermes di Kiro (sehari sekali / seminggu sekali)
```
"Hermes, review lessons_log.md dan update rule book"
```

Hermes akan:
1. `git pull` lessons dan history terbaru
2. Analisis tiap trade (kenapa win/loss?)
3. Update `HERMES_RULE_BOOK.md` (tambah rule baru)
4. Update `setups.json` (adjust setup baru, disable yang gagal terus)
5. `git push` perubahan

### Langkah 3 — Bot pull rule baru tiap cycle
Cycle berikutnya, bot deteksi `setups.json` berubah → pakai rule baru → kirim alert
"📚 RULES UPDATED" ke Telegram.

## 🛡️ Safety Features

- **Paper trading only** — no real funds
- **Setup deduplication** — `consumed_setup_ids` mencegah re-entry sama
- **Rebase on pull** — prevent merge conflicts dengan Hermes update
- **Read-only fallback** — bot tetap jalan kalau GITHUB_TOKEN missing (no push)
- **Error alerts** — exception → Telegram notification

## 🧰 Maintenance Commands

```bash
# Lihat status process
ps aux | grep hermes_bot

# Lihat log realtime
tail -f bot.log

# Stop bot
pkill -f hermes_bot

# Force pull rules manual
git pull --rebase origin hermes-trading-bot

# Lihat trade history
cat trade_history.json | python -m json.tool

# Lihat state portfolio
cat state.json | python -m json.tool
```

## 📋 Env Vars (.env)

| Var | Required | Default | Deskripsi |
|---|---|---|---|
| TG_TOKEN | ✅ | — | Telegram bot token |
| TG_CHAT_ID | ✅ | — | Telegram chat id Anda |
| GITHUB_TOKEN | ✅ | — | GitHub PAT untuk git push |
| GITHUB_REPO | — | `fagriyawan/fagriyawan.github.io` | repo yang dipakai |
| GITHUB_BRANCH | — | `hermes-trading-bot` | branch yang dipakai |
| POLL_INTERVAL_SEC | — | `600` | interval polling (detik) |
| DAILY_REPORT_HOUR_UTC | — | `0` | jam UTC untuk daily report |

## ⚠️ Known Limitations

- Termux di Android bisa di-kill OS kalau RAM penuh / battery saver agresif
- Untuk truly bullet-proof 24/7, deploy ke VPS murah ($3-5/bulan)
- Setup C (scout) bisa retrigger di range — saat ini di-prevent oleh `consumed_setup_ids`,
  tapi untuk frequent re-entry pattern butuh re-design
