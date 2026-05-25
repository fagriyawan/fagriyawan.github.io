<?php
/**
 * Batch CYSP to Spine JSON Converter for Princess Connect Re:Dive
 * 
 * Cara pakai di Termux:
 * 1. Install PHP: pkg install php
 * 2. Download converter.php dari gist esterTion
 * 3. Siapkan folder structure:
 *    /sdcard/priconne_convert/
 *    ├── converter.php        (dari gist)
 *    ├── batch_convert_cysp.php (file ini)
 *    ├── 000000_CHARA_BASE.cysp (download dari redive.estertion.win)
 *    ├── input/               (taruh semua .cysp + atlas + png disini)
 *    │   ├── 100301_BATTLE.cysp
 *    │   ├── 100311.atlas
 *    │   ├── 100311.png
 *    │   ├── 100331_BATTLE.cysp  (opsional, jika animasi berbeda)
 *    │   ├── 100331.atlas
 *    │   ├── 100331.png
 *    │   └── ...
 *    └── output/              (hasil convert akan disini)
 *        ├── 100311/
 *        │   ├── 100311.json
 *        │   ├── 100311.atlas
 *        │   └── 100311.png
 *        └── 100331/
 *            ├── 100331.json
 *            ├── 100331.atlas
 *            └── 100331.png
 * 
 * 4. Jalankan: php batch_convert_cysp.php
 * 
 * CATATAN:
 * - Setiap character punya ID 6 digit (contoh: 100311)
 * - File .cysp berisi animasi battle
 * - File .atlas + .png berisi texture
 * - Semua character pakai skeleton base yang sama (000000_CHARA_BASE.cysp)
 * - Script akan auto-match: 100311.atlas → cari 1003X1_BATTLE.cysp (ambil 4 digit pertama)
 */

error_reporting(E_ALL & ~E_DEPRECATED);

// === CONFIGURATION ===
$BASE_DIR = __DIR__;
$INPUT_DIR = $BASE_DIR . '/input';
$OUTPUT_DIR = $BASE_DIR . '/output';
$BASE_SKEL = $BASE_DIR . '/000000_CHARA_BASE.cysp';
$CONVERTER = $BASE_DIR . '/converter.php';

// === CHECK REQUIREMENTS ===
if (!file_exists($CONVERTER)) {
    echo "ERROR: converter.php not found!\n";
    echo "Download from: https://gist.githubusercontent.com/esterTion/e24d7142e0fa0bcc6ef11ee586ce5235/raw\n";
    echo "Run: curl -o converter.php 'https://gist.githubusercontent.com/esterTion/e24d7142e0fa0bcc6ef11ee586ce5235/raw'\n";
    exit(1);
}

if (!file_exists($BASE_SKEL)) {
    echo "ERROR: 000000_CHARA_BASE.cysp not found!\n";
    echo "Download from: https://redive.estertion.win/spine/common/000000_CHARA_BASE.cysp\n";
    echo "Run: curl -o 000000_CHARA_BASE.cysp 'https://redive.estertion.win/spine/common/000000_CHARA_BASE.cysp'\n";
    exit(1);
}

if (!is_dir($INPUT_DIR)) {
    mkdir($INPUT_DIR, 0755, true);
    echo "Created input/ folder. Put your .cysp, .atlas, .png files there.\n";
    exit(0);
}

if (!is_dir($OUTPUT_DIR)) {
    mkdir($OUTPUT_DIR, 0755, true);
}

// === LOAD CONVERTER ===
require_once $CONVERTER;

// === READ BASE SKELETON (only once!) ===
echo "=== BATCH CYSP CONVERTER ===\n";
echo "Loading base skeleton...\n";
$baseSkel = readCyspSkeleton($BASE_SKEL);
echo "Base loaded: " . count($baseSkel['bone']) . " bones, " . count($baseSkel['slot']) . " slots\n\n";

// === FIND ALL ATLAS FILES (these represent characters) ===
$atlasFiles = glob($INPUT_DIR . '/*.atlas');
if (empty($atlasFiles)) {
    echo "No .atlas files found in input/ folder.\n";
    echo "Put your character files (.atlas + .png + .cysp) in the input/ folder.\n";
    exit(0);
}

echo "Found " . count($atlasFiles) . " characters to convert.\n\n";

$success = 0;
$failed = 0;
$skipped = 0;

foreach ($atlasFiles as $atlasFile) {
    $basename = pathinfo($atlasFile, PATHINFO_FILENAME); // e.g. "100311"
    $charId = $basename; // character ID
    
    // Find matching PNG
    $pngFile = $INPUT_DIR . '/' . $basename . '.png';
    if (!file_exists($pngFile)) {
        echo "[SKIP] $charId - Missing PNG file\n";
        $skipped++;
        continue;
    }
    
    // Find matching CYSP animation file
    // Pattern: character 100311 uses animation from 100301_BATTLE.cysp (first 4 digits + "01")
    // Or look for exact match first, then pattern match
    $cyspFile = null;
    
    // Try exact match: 100311_BATTLE.cysp
    if (file_exists($INPUT_DIR . '/' . $charId . '_BATTLE.cysp')) {
        $cyspFile = $INPUT_DIR . '/' . $charId . '_BATTLE.cysp';
    }
    // Try base pattern: 1003XX → 100301_BATTLE.cysp
    if (!$cyspFile) {
        $prefix4 = substr($charId, 0, 4);
        $tryFile = $INPUT_DIR . '/' . $prefix4 . '01_BATTLE.cysp';
        if (file_exists($tryFile)) {
            $cyspFile = $tryFile;
        }
    }
    // Try any matching prefix
    if (!$cyspFile) {
        $prefix4 = substr($charId, 0, 4);
        $matches = glob($INPUT_DIR . '/' . $prefix4 . '*_BATTLE.cysp');
        if (!empty($matches)) {
            // Use the latest version (sorted by name, last one)
            sort($matches);
            $cyspFile = end($matches);
        }
    }
    
    if (!$cyspFile) {
        echo "[SKIP] $charId - No matching .cysp animation file\n";
        $skipped++;
        continue;
    }
    
    // Convert
    echo "[CONVERT] $charId ... ";
    
    try {
        // Read animation from cysp
        $skel = $baseSkel; // copy base
        $skel['animation'] = readCyspAnimation($cyspFile, $skel);
        
        // Convert to JSON
        $json = processToJson($skel);
        
        // Clean up JSON for pixi-spine compatibility
        if (isset($json['skins'])) {
            foreach ($json['skins'] as &$slots) {
                foreach ($slots as &$attachments) {
                    foreach ($attachments as &$att) {
                        unset($att['placeholderName']);
                        if (isset($att['type']) && $att['type'] === 'region') {
                            unset($att['type']);
                        }
                        unset($att['weighted']);
                    }
                }
            }
        }
        
        // Add spine version field
        if (!isset($json['skeleton']['spine'])) {
            $json['skeleton']['spine'] = $json['skeleton']['version'] ?? '3.6.39';
        }
        
        // Create output folder
        $outDir = $OUTPUT_DIR . '/' . $charId;
        if (!is_dir($outDir)) mkdir($outDir, 0755, true);
        
        // Save JSON
        $jsonFile = $outDir . '/' . $charId . '.json';
        file_put_contents($jsonFile, json_encode($json, JSON_UNESCAPED_SLASHES));
        
        // Copy atlas and PNG
        copy($atlasFile, $outDir . '/' . $basename . '.atlas');
        copy($pngFile, $outDir . '/' . $basename . '.png');
        
        $animCount = count($json['animations']);
        echo "OK ($animCount animations)\n";
        $success++;
        
    } catch (Exception $e) {
        echo "FAILED: " . $e->getMessage() . "\n";
        $failed++;
    }
}

echo "\n=== RESULTS ===\n";
echo "Success: $success\n";
echo "Failed:  $failed\n";
echo "Skipped: $skipped\n";
echo "Output:  $OUTPUT_DIR/\n";
echo "\nEach output folder contains:\n";
echo "  - {id}.json  (skeleton + animations)\n";
echo "  - {id}.atlas (texture atlas)\n";
echo "  - {id}.png   (texture image)\n";
