#!/bin/bash
# ================================================
# FULL SETUP + CONVERT - Princess Connect Re:Dive
# Jalankan di Termux: bash setup_and_convert.sh
# ================================================

echo "=== PRICONNE CYSP CONVERTER - FULL SETUP ==="
echo ""

# Install PHP
if ! command -v php &> /dev/null; then
    echo "Installing PHP..."
    pkg install php curl -y
fi

# Buat folder kerja
WORK=~/priconne_convert
mkdir -p $WORK/input
cd $WORK

# Download converter.php
echo "Downloading converter.php..."
curl -so converter.php 'https://gist.githubusercontent.com/esterTion/e24d7142e0fa0bcc6ef11ee586ce5235/raw'

# Download base skeleton
echo "Downloading 000000_CHARA_BASE.cysp..."
curl -so 000000_CHARA_BASE.cysp 'https://redive.estertion.win/spine/common/000000_CHARA_BASE.cysp'

# Download common animations (idle, run, die, victory, etc)
echo "Downloading common animations..."
curl -so input/000000_DEAR.cysp 'https://redive.estertion.win/spine/common/000000_DEAR.cysp'
curl -so input/000000_NO_WEAPON.cysp 'https://redive.estertion.win/spine/common/000000_NO_WEAPON.cysp'
curl -so input/000000_POSING.cysp 'https://redive.estertion.win/spine/common/000000_POSING.cysp'
curl -so input/000000_RACE.cysp 'https://redive.estertion.win/spine/common/000000_RACE.cysp'
curl -so input/000000_RUN_JUMP.cysp 'https://redive.estertion.win/spine/common/000000_RUN_JUMP.cysp'
curl -so input/000000_SMILE.cysp 'https://redive.estertion.win/spine/common/000000_SMILE.cysp'
curl -so input/04_COMMON_BATTLE.cysp 'https://redive.estertion.win/spine/common/04_COMMON_BATTLE.cysp'

# Download safe_convert.php
echo "Downloading safe_convert.php..."
curl -so safe_convert.php 'https://raw.githubusercontent.com/fagriyawan/fagriyawan.github.io/main/heroes/tools/safe_convert.php'

# Copy character files from Download folder
SRC=/storage/emulated/0/Download/caracterredrive
if [ -d "$SRC" ]; then
    echo ""
    echo "Copying character files from $SRC ..."
    
    # Copy .cysp (tanpa tanggal = versi terbaru)
    find "$SRC" -name "*_BATTLE.cysp" ! -name "*_20*" -exec cp {} $WORK/input/ \;
    
    # Copy .atlas (tanpa tanggal = versi terbaru)
    find "$SRC" -name "*.atlas" ! -name "*_20*" -exec cp {} $WORK/input/ \;
    
    # Copy .png (tanpa tanggal = versi terbaru)
    find "$SRC" -name "*.png" ! -name "*_20*" -exec cp {} $WORK/input/ \;
    
    echo "Copied:"
    echo "  .cysp: $(ls $WORK/input/*_BATTLE.cysp 2>/dev/null | wc -l) files"
    echo "  .atlas: $(ls $WORK/input/*.atlas 2>/dev/null | wc -l) files"
    echo "  .png: $(ls $WORK/input/*.png 2>/dev/null | wc -l) files"
else
    echo ""
    echo "WARNING: Folder $SRC not found!"
    echo "Copy your character files manually to: $WORK/input/"
fi

echo ""
echo "=== SETUP DONE ==="
echo ""
echo "Sekarang jalankan converter:"
echo "  cd $WORK && php safe_convert.php"
echo ""
echo "Output di: /storage/emulated/0/Download/priconne_output/"
echo ""
