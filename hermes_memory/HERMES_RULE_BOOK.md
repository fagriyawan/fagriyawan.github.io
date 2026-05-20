═══════════════════════════════════════════════════════════════
                    HERMES TRADING RULE BOOK
═══════════════════════════════════════════════════════════════
Update terakhir : 2026-05-20 00:35 UTC
Total rules     : 19
Versi           : 1.2
═══════════════════════════════════════════════════════════════

─────────────────────────────────────────
KATEGORI A: SENTIMENT & POSITIONING
─────────────────────────────────────────

RULE #001  [TINGGI]  L/S ratio > 70% = jangan long kecuali ada
konfirmasi struktur balik di 1H (HL+HH+break resistance).

RULE #002  [SEDANG-TINGGI]  L/S NAIK selama harga turun =
trapped longs akumulasi. Sinyal short makin valid.

RULE #003  [SEDANG]  OI rebound pasca liquidation tanpa unwind =
stage untuk squeeze cascade berikutnya.

─────────────────────────────────────────
KATEGORI B: STRUKTUR HARGA
─────────────────────────────────────────

RULE #004  [TINGGI]  4H downtrend dengan 5+ LH dan 4+ LL =
trend solid. JANGAN fade tanpa konfirmasi HTF reversal.

RULE #005  [TINGGI]  Jangan entry di mid-range. Tunggu harga
tes level ekstrem. R/R selalu lebih baik di edge.

RULE #006  [TINGGI]  Level dianggap VALID setelah ditest dan
reject. Tag TESTED ✓ dan naikkan confidence.

─────────────────────────────────────────
KATEGORI C: ORDER FLOW
─────────────────────────────────────────

RULE #007  [SEDANG]  Taker B/S > 1.30 pasca liquidation = valid
bounce SIGNAL, tapi hanya scalp pendek.

RULE #008  [SEDANG]  High volume (>1.4x avg) + taker < 0.85 =
aggressive distribution. Setup short menguat.

─────────────────────────────────────────
KATEGORI D: RISK MANAGEMENT
─────────────────────────────────────────

RULE #009  [TINGGI — NON-NEGOTIABLE]  Risk per trade ≤ 1%.
Total exposure aktif ≤ 10%. Yakin ≠ pengganti risk mgmt.

─────────────────────────────────────────
KATEGORI E: SMART MONEY READING
─────────────────────────────────────────

RULE #010  [TINGGI]  Bandingkan 3 layer L/S; divergence retail
vs smart money >8pp = contrarian signal toward smart money side.

RULE #011  [SEDANG]  Top trader position trend lebih penting
dari level absolut.

─────────────────────────────────────────
KATEGORI F: LIQUIDATION CLUSTER
─────────────────────────────────────────

RULE #012  [SEDANG]  VWAP 12 candle 4H = proxy avg entry crowd,
hitung liq zones untuk leverage 5x/10x/20x/25x/50x.

RULE #013  [SEDANG]  50x liq < 1.5% dari current = SL harus
1.5x lebih lebar untuk hindari whipsaw.

─────────────────────────────────────────
KATEGORI G: MARKET LEADER CONTEXT
─────────────────────────────────────────

RULE #014  [TINGGI]  Cek BTC trend sebelum trade alt high-beta.
BTC sama→full confidence, BTC flat→80%, BTC opposite→50%.

─────────────────────────────────────────
KATEGORI H: VENUE DIVERGENCE
─────────────────────────────────────────

RULE #015  [SEDANG]  Funding cross-venue: jika Binance L/S
extreme tapi venue lain neutral, Binance kondisi anomali.

═══════════════════════════════════════════════════════════════
v1.2 UPDATE — 2026-05-20 00:35 UTC
PELAJARAN dari 24 jam pertama Termux + TRADE_0001 (yang hilang)
═══════════════════════════════════════════════════════════════

─────────────────────────────────────────
KATEGORI I: ARSITEKTUR & SAFETY (NEW)
─────────────────────────────────────────

RULE #016  [TINGGI — KRITIS]
"state.json adalah BOT-OWNED. Hermes (AI di Kiro) DILARANG
modifikasi atau reset state.json. Hermes hanya boleh edit:
 - setups.json
 - HERMES_RULE_BOOK.md
 - lessons_log.md (boleh tambah, tidak boleh hapus)
 - portofolio summary (read-only review)
Kalau saya overwrite state.json dari sandbox, bot di Termux
pull akan kehilangan posisi terbuka."
Sumber: TRADE_0001 hilang karena saya rm state.json saat test
        di sandbox dan commit ke git.
Aksi:   Saya tidak akan pernah ulang ini. Test code Hermes
        harus pakai temp dir, bukan repo dir.

─────────────────────────────────────────
KATEGORI J: REGIME DETECTION (NEW)
─────────────────────────────────────────

RULE #017  [TINGGI]
"Smart vs retail divergence yang PERSISTENT (>25pp selama
>6 jam berturut-turut) = REGIME, bukan moment. Setup short
dengan confidence DOUBLED. Boleh tingkatkan size hingga
+50% dari baseline (tapi tetap di bawah risk per trade 1%)."
Sumber: 12 jam history SOL: divergence ~32pp konstan
        13:00 32pp, 17:00 31pp, 21:00 31pp, 00:00 32pp
Bedanya dgn Rule #010 (8pp threshold momentary):
        Rule #017 = persistent regime (durasi penting)
        Rule #010 = single-point detection

─────────────────────────────────────────
KATEGORI K: DOWN-WEIGHT SIGNALS (NEW)
─────────────────────────────────────────

RULE #018  [SEDANG]
"Taker B/S adalah LAGGING indicator (mengikuti pergerakan
harga, bukan memimpin). Smart money L/S adalah LEADING.
Jangan beri bobot taker > smart money saat decision making.
Taker volatile (range 0.58-1.79 dalam 12 jam) tapi smart
money stabil (40.4% ± 0.5pp) — yang stabil adalah truth."
Sumber: 12 jam SOL data — taker bouncing ±2x, smart flat.
        Taker tidak bisa dipakai sebagai sole signal.

RULE #019  [SEDANG]
"Funding rate < 0.05% per 8h = mild positioning, BUKAN
extreme. Setup short yang relying on funding squeeze tidak
valid sampai funding mencapai threshold. Saat ini Hermes
akan filter: setup squeeze hanya jika |funding| > 0.05%/8h."
Sumber: SOL funding 0.07bp / -0.05bp / 0.01bp = neutral
        (1bp = 0.01%, jadi 0.07bp = 0.0007% — sangat kecil)

─────────────────────────────────────────
DAFTAR_SINYAL_BAHAYA — UPDATE v1.2
─────────────────────────────────────────
🚫 Hermes (AI) modifikasi state.json → BUG kehilangan posisi
🚫 Setup short tanpa cek divergence persistensi → noise
🚫 Decision based on taker only (tanpa smart money konfirmasi)
🚫 Setup squeeze tanpa cek funding threshold (>0.05%/8h)
🚫 Smart money REDUCING long + retail ADDING → jangan long
🚫 BTC opposite trend dari setup alt → kurangi size minimal 50%
🚫 50x liq cluster < 1.5% dari entry → set SL lebih lebar
🚫 L/S ratio > 70% + harga di tengah range → jangan long
🚫 Mid-range entry tanpa level tes → tunggu edge
🚫 Volume spike + taker < 0.85 → distribusi aktif, jangan long

═══════════════════════════════════════════════════════════════
CONFIDENCE BOOSTERS (kondisi yang perkuat sinyal)
═══════════════════════════════════════════════════════════════
✅ Divergence persistent >25pp selama >6h → DOUBLE confidence short
✅ 4H clean LH+LL pattern + smart money <45% → strong short
✅ Smart money trend turun + retail trend naik → contrarian valid
✅ Cluster liquidation dense within 5% target → magnet kuat
✅ Multi-source data agree (Gate, Binance fapi yg accessible) → konfirmasi cross-venue

═══════════════════════════════════════════════════════════════
CHANGE LOG
═══════════════════════════════════════════════════════════════
v1.0  2026-05-19 15:35 UTC  9 rules dari baseline SOL
v1.1  2026-05-19 15:50 UTC  +6 rules: smart money, liq cluster,
                             market leader, venue divergence
v1.2  2026-05-20 00:35 UTC  +4 rules dari pelajaran 24h Termux:
                             - #016 architectural safety
                             - #017 regime persistence
                             - #018 lagging vs leading signals
                             - #019 funding threshold filter
═══════════════════════════════════════════════════════════════
