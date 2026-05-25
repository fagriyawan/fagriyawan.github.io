<?php
/**
 * Safe CYSP Batch Converter v2 - Princess Connect Re:Dive
 * Dengan auto-detect weapon type dari classMap.json
 * Setiap character pakai common battle yang sesuai senjatanya
 * 
 * Cara pakai:
 * 1. cd ~/priconne_convert
 * 2. php safe_convert.php
 */
error_reporting(E_ALL & ~E_DEPRECATED & ~E_WARNING & ~E_NOTICE);

$BASE_DIR = __DIR__;
$INPUT_DIR = $BASE_DIR . '/input';
$OUTPUT_DIR = '/storage/emulated/0/Download/priconne_output';
$BASE_SKEL = $BASE_DIR . '/000000_CHARA_BASE.cysp';
$CONVERTER = $BASE_DIR . '/converter.php';
$CLASSMAP_FILE = $BASE_DIR . '/classMap.json';

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

// === LOAD CLASSMAP ===
$classMap = [];
if (file_exists($CLASSMAP_FILE)) {
    $classMap = json_decode(file_get_contents($CLASSMAP_FILE), true);
    echo "ClassMap loaded: " . count($classMap) . " characters\n";
} else {
    echo "WARNING: classMap.json not found! All characters will use 04_COMMON_BATTLE.\n";
    echo "Run: curl -so classMap.json 'https://redive.estertion.win/spine/classMap.json'\n\n";
}

// === LOAD ===
require_once $CONVERTER;

echo "=== SAFE CYSP CONVERTER v2 (Auto Weapon Type) ===\n\n";

// Load base skeleton
echo "Loading base skeleton...\n";
$baseSkel = readCyspSkeleton($BASE_SKEL);
echo "Base: " . count($baseSkel['bone']) . " bones, " . count($baseSkel['slot']) . " slots\n\n";

// Load shared common animations (idle, run, pose - same for all)
$sharedAnims = [];
$sharedFiles = [
    'input/000000_DEAR.cysp',
    'input/000000_NO_WEAPON.cysp',
    'input/000000_POSING.cysp',
    'input/000000_RACE.cysp',
    'input/000000_RUN_JUMP.cysp',
    'input/000000_SMILE.cysp',
];

echo "Loading shared animations...\n";
foreach ($sharedFiles as $cf) {
    $fullPath = $BASE_DIR . '/' . $cf;
    if (!file_exists($fullPath)) {
        echo "  [MISS] $cf\n";
        continue;
    }
    try {
        $anims = @readCyspAnimation($fullPath, $baseSkel);
        if ($anims && is_array($anims)) {
            $sharedAnims = array_merge($sharedAnims, $anims);
            echo "  [OK] " . basename($cf) . " - " . count($anims) . " animations\n";
        }
    } catch (\Throwable $e) {
        echo "  [ERR] " . basename($cf) . " - " . $e->getMessage() . "\n";
    }
}
echo "Total shared animations: " . count($sharedAnims) . "\n\n";

// Pre-load all COMMON_BATTLE files by weapon type
echo "Loading weapon-type common battles...\n";
$commonBattleCache = [];
$commonBattleFiles = glob($INPUT_DIR . '/*_COMMON_BATTLE.cysp');
foreach ($commonBattleFiles as $cbf) {
    $fname = basename($cbf, '_COMMON_BATTLE.cysp');
    $typeNum = ltrim($fname, '0') ?: '0';
    try {
        $anims = @readCyspAnimation($cbf, $baseSkel);
        if ($anims && is_array($anims)) {
            $commonBattleCache[$typeNum] = $anims;
            echo "  [OK] type $typeNum (" . basename($cbf) . ") - " . count($anims) . " anims\n";
        }
    } catch (\Throwable $e) {
        echo "  [ERR] type $typeNum - " . $e->getMessage() . "\n";
    }
}
echo "Loaded " . count($commonBattleCache) . " weapon types\n\n";

// === HELPER: Get weapon type ===
function getWeaponType($charId, $classMap) {
    $prefix4 = substr($charId, 0, 4);
    $baseId = $prefix4 . '01';
    if (isset($classMap[$baseId])) return $classMap[$baseId]['type'];
    if (isset($classMap[$charId])) return $classMap[$charId]['type'];
    return '4'; // fallback
}

// === CONVERT ===
$atlasFiles = glob($INPUT_DIR . '/*.atlas');
echo "Found " . count($atlasFiles) . " characters to convert.\n\n";

$success = 0; $failed = 0; $skipped = 0;

foreach ($atlasFiles as $atlasFile) {
    $basename = pathinfo($atlasFile, PATHINFO_FILENAME);
    if (strpos($basename, '000000') === 0) continue;
    
    $pngFile = $INPUT_DIR . '/' . $basename . '.png';
    if (!file_exists($pngFile)) { $skipped++; continue; }

    $outDir = $OUTPUT_DIR . '/' . $basename;
    if (file_exists($outDir . '/' . $basename . '.json')) { $skipped++; continue; }

    // Find battle cysp
    $cyspFile = null;
    $prefix4 = substr($basename, 0, 4);
    $tryFile = $INPUT_DIR . '/' . $prefix4 . '01_BATTLE.cysp';
    if (file_exists($tryFile)) $cyspFile = $tryFile;
    if (!$cyspFile) {
        $tryFile = $INPUT_DIR . '/' . $basename . '_BATTLE.cysp';
        if (file_exists($tryFile)) $cyspFile = $tryFile;
    }
    if (!$cyspFile) {
        $matches = glob($INPUT_DIR . '/' . $prefix4 . '*_BATTLE.cysp');
        if (!empty($matches)) { sort($matches); $cyspFile = end($matches); }
    }
    if (!$cyspFile) { echo "[SKIP] $basename - no cysp\n"; $skipped++; continue; }

    $weaponType = getWeaponType($basename, $classMap);
    echo "[CONVERT] $basename (type:$weaponType) ... ";

    try {
        $skel = $baseSkel;

        // 1. Shared animations (same for all)
        $allAnims = $sharedAnims;

        // 2. Weapon-specific common battle
        if (isset($commonBattleCache[$weaponType])) {
            $allAnims = array_merge($allAnims, $commonBattleCache[$weaponType]);
        } elseif (isset($commonBattleCache['4'])) {
            $allAnims = array_merge($allAnims, $commonBattleCache['4']);
        }

        // 3. Character-specific skills
        $battleAnims = @readCyspAnimation($cyspFile, $skel);
        if ($battleAnims && is_array($battleAnims)) {
            $allAnims = array_merge($allAnims, $battleAnims);
        }

        $skel['animation'] = $allAnims;
        $json = processToJson($skel);

        // Filter: hanya simpan animasi yang dibutuhkan
        if (isset($json['animations'])) {
            $keepPatterns = ['idle', 'die', 'attack', 'damage', 'joy_short', 'run', 'skill0', 'skill1', 'skill2', 'skill_evolution'];
            $filtered = [];
            foreach ($json['animations'] as $animName => $animData) {
                foreach ($keepPatterns as $pattern) {
                    if (stripos($animName, $pattern) !== false) {
                        $filtered[$animName] = $animData;
                        break;
                    }
                }
            }
            $json['animations'] = $filtered;
        }

        // Clean up
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

        if (!is_dir($outDir)) mkdir($outDir, 0755, true);
        file_put_contents($outDir . '/' . $basename . '.json', json_encode($json, JSON_UNESCAPED_SLASHES));
        copy($atlasFile, $outDir . '/' . $basename . '.atlas');
        copy($pngFile, $outDir . '/' . $basename . '.png');

        $animCount = count($json['animations']);
        echo "OK ($animCount anims)\n";
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
