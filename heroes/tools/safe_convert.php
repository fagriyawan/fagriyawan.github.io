<?php
/**
 * Safe CYSP Batch Converter - Princess Connect Re:Dive
 * Gabung SEMUA animasi (common + battle) ke 1 JSON per character
 * 
 * Cara pakai:
 * 1. cd ~/priconne_convert
 * 2. php safe_convert.php
 * 
 * Output: /storage/emulated/0/Download/priconne_output/{id}/{id}.json + .atlas + .png
 */
error_reporting(E_ALL & ~E_DEPRECATED & ~E_WARNING & ~E_NOTICE);

$BASE_DIR = __DIR__;
$INPUT_DIR = $BASE_DIR . '/input';
$OUTPUT_DIR = '/storage/emulated/0/Download/priconne_output';
$BASE_SKEL = $BASE_DIR . '/000000_CHARA_BASE.cysp';
$CONVERTER = $BASE_DIR . '/converter.php';

// === CHECK ===
if (!file_exists($CONVERTER)) {
    die("ERROR: converter.php not found!\nRun: curl -so converter.php 'https://gist.githubusercontent.com/esterTion/e24d7142e0fa0bcc6ef11ee586ce5235/raw'\n");
}
if (!file_exists($BASE_SKEL)) {
    die("ERROR: 000000_CHARA_BASE.cysp not found!\nRun: curl -so 000000_CHARA_BASE.cysp 'https://redive.estertion.win/spine/common/000000_CHARA_BASE.cysp'\n");
}
if (!is_dir($INPUT_DIR)) {
    mkdir($INPUT_DIR, 0755, true);
    die("Created input/ folder. Put your files there first.\n");
}
if (!is_dir($OUTPUT_DIR)) mkdir($OUTPUT_DIR, 0755, true);

// === LOAD ===
require_once $CONVERTER;

echo "=== SAFE CYSP CONVERTER (Full Animations) ===\n\n";

// Load base skeleton
echo "Loading base skeleton...\n";
$baseSkel = readCyspSkeleton($BASE_SKEL);
echo "Base: " . count($baseSkel['bone']) . " bones, " . count($baseSkel['slot']) . " slots\n\n";

// Load ALL common animations (idle, run, die, etc)
$commonAnims = [];
$commonFiles = [
    'input/000000_DEAR.cysp',
    'input/000000_NO_WEAPON.cysp',
    'input/000000_POSING.cysp',
    'input/000000_RACE.cysp',
    'input/000000_RUN_JUMP.cysp',
    'input/000000_SMILE.cysp',
];

echo "Loading common animations...\n";
foreach ($commonFiles as $cf) {
    $fullPath = $BASE_DIR . '/' . $cf;
    if (!file_exists($fullPath)) {
        echo "  [MISS] $cf - not found, skipping\n";
        continue;
    }
    try {
        $anims = @readCyspAnimation($fullPath, $baseSkel);
        if ($anims && is_array($anims)) {
            $commonAnims = array_merge($commonAnims, $anims);
            echo "  [OK] " . basename($cf) . " - " . count($anims) . " animations\n";
        }
    } catch (\Throwable $e) {
        echo "  [ERR] " . basename($cf) . " - " . $e->getMessage() . "\n";
    }
}
echo "Total common animations: " . count($commonAnims) . "\n\n";

// Also try 04_COMMON_BATTLE.cysp
$commonBattle = $INPUT_DIR . '/04_COMMON_BATTLE.cysp';
if (file_exists($commonBattle)) {
    try {
        $anims = @readCyspAnimation($commonBattle, $baseSkel);
        if ($anims && is_array($anims)) {
            $commonAnims = array_merge($commonAnims, $anims);
            echo "Loaded 04_COMMON_BATTLE.cysp: " . count($anims) . " animations\n\n";
        }
    } catch (\Throwable $e) {
        echo "04_COMMON_BATTLE.cysp error: " . $e->getMessage() . "\n\n";
    }
}

// === CONVERT CHARACTERS ===
$atlasFiles = glob($INPUT_DIR . '/*.atlas');
echo "Found " . count($atlasFiles) . " characters to convert.\n\n";

$success = 0;
$failed = 0;
$skipped = 0;

foreach ($atlasFiles as $atlasFile) {
    $basename = pathinfo($atlasFile, PATHINFO_FILENAME);
    
    // Skip common files
    if (strpos($basename, '000000') === 0) continue;
    
    $pngFile = $INPUT_DIR . '/' . $basename . '.png';
    if (!file_exists($pngFile)) { $skipped++; continue; }

    // Skip if already converted
    $outDir = $OUTPUT_DIR . '/' . $basename;
    if (file_exists($outDir . '/' . $basename . '.json')) {
        $skipped++;
        continue;
    }

    // Find battle cysp (pattern: 100311 -> 100301_BATTLE.cysp)
    $cyspFile = null;
    $prefix4 = substr($basename, 0, 4);
    
    // Try: {prefix4}01_BATTLE.cysp
    $tryFile = $INPUT_DIR . '/' . $prefix4 . '01_BATTLE.cysp';
    if (file_exists($tryFile)) $cyspFile = $tryFile;
    
    // Try exact match
    if (!$cyspFile) {
        $tryFile = $INPUT_DIR . '/' . $basename . '_BATTLE.cysp';
        if (file_exists($tryFile)) $cyspFile = $tryFile;
    }
    
    // Try any matching prefix
    if (!$cyspFile) {
        $matches = glob($INPUT_DIR . '/' . $prefix4 . '*_BATTLE.cysp');
        if (!empty($matches)) {
            sort($matches);
            $cyspFile = end($matches);
        }
    }

    if (!$cyspFile) {
        echo "[SKIP] $basename - no matching .cysp\n";
        $skipped++;
        continue;
    }

    echo "[CONVERT] $basename ... ";

    try {
        $skel = $baseSkel;

        // Read battle animations
        $battleAnims = @readCyspAnimation($cyspFile, $skel);
        if (!$battleAnims || !is_array($battleAnims)) $battleAnims = [];

        // Merge: common + battle
        $skel['animation'] = array_merge($commonAnims, $battleAnims);

        // Convert to JSON
        $json = processToJson($skel);

        // Clean up for pixi-spine compatibility
        if (isset($json['skins'])) {
            foreach ($json['skins'] as &$slots) {
                foreach ($slots as &$attachments) {
                    foreach ($attachments as &$att) {
                        unset($att['placeholderName'], $att['weighted']);
                        if (isset($att['type']) && $att['type'] === 'region') unset($att['type']);
                    }
                }
            }
        }
        if (!isset($json['skeleton']['spine'])) {
            $json['skeleton']['spine'] = $json['skeleton']['version'] ?? '3.6.39';
        }

        // Output
        if (!is_dir($outDir)) mkdir($outDir, 0755, true);
        file_put_contents($outDir . '/' . $basename . '.json', json_encode($json, JSON_UNESCAPED_SLASHES));
        copy($atlasFile, $outDir . '/' . $basename . '.atlas');
        copy($pngFile, $outDir . '/' . $basename . '.png');

        $animCount = count($json['animations']);
        echo "OK ($animCount animations)\n";
        $success++;

    } catch (\Throwable $e) {
        echo "FAILED: " . $e->getMessage() . "\n";
        $failed++;
    }
}

echo "\n=== RESULTS ===\n";
echo "Success: $success\n";
echo "Failed:  $failed\n";
echo "Skipped: $skipped\n";
echo "Output:  $OUTPUT_DIR/\n";
