#!/bin/bash
# ===========================================
# Setup Script - CYSP to Spine JSON Converter
# Jalankan di Termux: bash setup_termux.sh
# ===========================================

echo "=== SETUP CYSP CONVERTER ==="
echo ""

# Install PHP jika belum ada
if ! command -v php &> /dev/null; then
    echo "Installing PHP..."
    pkg install php -y
fi

# Buat folder kerja
WORK_DIR="$HOME/priconne_convert"
mkdir -p "$WORK_DIR/input"
mkdir -p "$WORK_DIR/output"

cd "$WORK_DIR"

# Download converter.php dari esterTion
echo "Downloading converter.php..."
curl -so converter.php 'https://gist.githubusercontent.com/esterTion/e24d7142e0fa0bcc6ef11ee586ce5235/raw'

# Download base skeleton
echo "Downloading 000000_CHARA_BASE.cysp..."
curl -so 000000_CHARA_BASE.cysp 'https://redive.estertion.win/spine/common/000000_CHARA_BASE.cysp'

# Copy batch converter
echo "Copying batch_convert_cysp.php..."
cp "$(dirname "$0")/batch_convert_cysp.php" "$WORK_DIR/"

echo ""
echo "=== SETUP COMPLETE ==="
echo ""
echo "Folder kerja: $WORK_DIR"
echo ""
echo "CARA PAKAI:"
echo "1. Copy file character ke folder input/:"
echo "   cp ~/storage/downloads/*.cysp $WORK_DIR/input/"
echo "   cp ~/storage/downloads/*.atlas $WORK_DIR/input/"
echo "   cp ~/storage/downloads/*.png $WORK_DIR/input/"
echo ""
echo "2. Jalankan converter:"
echo "   cd $WORK_DIR && php batch_convert_cysp.php"
echo ""
echo "3. Hasil ada di folder output/:"
echo "   ls $WORK_DIR/output/"
echo ""
echo "4. Copy hasil ke repo GitHub:"
echo "   cp -r $WORK_DIR/output/* ~/fagriyawan.github.io/heroes/assets/characternew/newredrive/"
echo ""
echo "5. Push ke GitHub:"
echo "   cd ~/fagriyawan.github.io && git add . && git commit -m 'Add new characters' && git push"
echo ""
