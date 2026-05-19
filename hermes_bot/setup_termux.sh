#!/data/data/com.termux/files/usr/bin/bash
# HERMES Bot — Termux Setup Script
# Usage: bash setup_termux.sh

set -e

echo "═══════════════════════════════════════════"
echo "  HERMES BOT — TERMUX SETUP"
echo "═══════════════════════════════════════════"

# 1. Check we're in the right dir
if [ ! -f "hermes_bot.py" ]; then
    echo "ERROR: Run this script from inside hermes_bot/ directory"
    exit 1
fi

# 2. Install deps if needed
echo
echo "[1/5] Checking dependencies..."
command -v python >/dev/null 2>&1 || { echo "Installing python..."; pkg install -y python; }
command -v git >/dev/null 2>&1 || { echo "Installing git..."; pkg install -y git; }
echo "  python: $(python --version)"
echo "  git:    $(git --version)"

# 3. Setup .env
echo
echo "[2/5] Configuring .env..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "  Created .env from template."
else
    echo "  .env already exists, keeping."
fi

# 4. Prompt for GitHub token if not set
if grep -q "ghp_your_token_here" .env; then
    echo
    echo "[3/5] GitHub Token setup"
    echo "  Buka di browser: https://github.com/settings/tokens?type=beta"
    echo "  Klik 'Generate new token' (fine-grained)"
    echo "    - Repository access: Only select repositories -> fagriyawan.github.io"
    echo "    - Permissions:"
    echo "        Contents = Read and write"
    echo "        Metadata = Read-only"
    echo "  Copy token (start dengan 'github_pat_...' atau 'ghp_...')"
    echo
    read -p "Paste token here: " TOKEN
    if [ -n "$TOKEN" ]; then
        # Replace placeholder using sed
        sed -i "s|ghp_your_token_here|$TOKEN|" .env
        echo "  Token saved to .env"
    else
        echo "  WARNING: Token kosong, bot akan jalan read-only"
    fi
else
    echo "[3/5] GitHub Token already configured."
fi

# 5. Quick verify
echo
echo "[4/5] Verifying connectivity..."
python -c "
import urllib.request, ssl, json
ctx = ssl.create_default_context()
try:
    r = urllib.request.urlopen('https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT', timeout=10, context=ctx)
    d = json.loads(r.read().decode())
    print(f'  Binance OK: SOL = \${float(d[\"price\"]):.2f}')
except Exception as e:
    print(f'  Binance FAIL: {e}')
"

python -c "
import os, urllib.request, json, ssl
ctx = ssl.create_default_context()
# load .env
for line in open('.env'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k,v = line.split('=',1); os.environ[k.strip()] = v.strip().strip('\"').strip(\"'\")
tok = os.environ.get('TG_TOKEN','')
chat = os.environ.get('TG_CHAT_ID','')
if tok and chat:
    try:
        url = f'https://api.telegram.org/bot{tok}/getMe'
        r = urllib.request.urlopen(url, timeout=10, context=ctx)
        d = json.loads(r.read().decode())
        print(f'  Telegram OK: bot @{d[\"result\"][\"username\"]} ready for chat {chat}')
    except Exception as e:
        print(f'  Telegram FAIL: {e}')
else:
    print('  Telegram NOT configured')
"

# 6. Test run
echo
echo "[5/5] Test run (1 cycle, no loop)..."
python hermes_bot.py --once --startup-msg
echo
echo "═══════════════════════════════════════════"
echo "  SETUP DONE"
echo "═══════════════════════════════════════════"
echo
echo "Next steps:"
echo "  1) Cek Telegram, harusnya ada pesan 'HERMES BOT v2 STARTED'"
echo "  2) Run loop mode untuk monitoring 24/7:"
echo "       python hermes_bot.py --loop"
echo "  3) Jalankan di background dengan tmux atau nohup:"
echo "       nohup python hermes_bot.py --loop > bot.log 2>&1 &"
echo
echo "  Untuk stop: pkill -f hermes_bot"
echo "  Untuk monitor log: tail -f bot.log"
echo
