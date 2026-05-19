═══════════════════════════════════════════════════════════════
                    HERMES TRADING RULE BOOK
═══════════════════════════════════════════════════════════════
Update terakhir : 2026-05-19 15:35 UTC
Total rules     : 9
Sumber          : SOL_20260518_BASELINE, TRADE_LOG_SOL_001,
                  SOL_20260519_1532_SNAPSHOT
═══════════════════════════════════════════════════════════════

─────────────────────────────────────────
KATEGORI A: SENTIMENT & POSITIONING
─────────────────────────────────────────

RULE #001  [Confidence: TINGGI]
"Jika Long/Short ratio > 70%, JANGAN long kecuali ada
konfirmasi struktur berbalik di 1H (Higher Low + Higher High
+ break resistance)."
Sumber: SOL_20260518_BASELINE (75.03%)
Logika: Crowd terlalu satu sisi = fuel untuk squeeze.

RULE #002  [Confidence: SEDANG-TINGGI]
"L/S ratio yang NAIK selama harga turun = trapped longs
sedang akumulasi (buying the dip salah). Sinyal short
makin valid."
Sumber: SOL_20260519 (75.03% -> 76.19% sambil harga -0.51%)
Logika: Tidak ada unwind = tidak ada flush = bom waktu.

RULE #003  [Confidence: SEDANG]
"OI rebound pasca liquidation tanpa unwind = stage untuk
squeeze cascade berikutnya. Hindari sisi yang baru saja
liquidated."
Sumber: SOL_20260518_BASELINE ($857M -> $813M -> $820M)

─────────────────────────────────────────
KATEGORI B: STRUKTUR HARGA
─────────────────────────────────────────

RULE #004  [Confidence: TINGGI]
"4H downtrend dengan 5+ Lower High dan 4+ Lower Low
berturut-turut = trend solid. JANGAN fade trend tanpa
konfirmasi reversal di higher timeframe."
Sumber: SOL_20260518_BASELINE

RULE #005  [Confidence: TINGGI]
"Jangan entry di mid-range. Tunggu harga tes level
ekstrem (resistance atau support). R/R selalu lebih
baik di edge daripada di tengah."
Sumber: TRADE_LOG_SOL_001 (wait at $84.93 mid-range)

RULE #006  [Confidence: TINGGI]
"Level dianggap VALID setelah ditest dan harga reject.
Update label menjadi TESTED ✓ dan naikkan confidence
level untuk setup berikutnya di level itu."
Sumber: SOL_20260519 (resistance $85.97 reject, support
$83.50 held — kedua level baseline tervalidasi)

─────────────────────────────────────────
KATEGORI C: ORDER FLOW
─────────────────────────────────────────

RULE #007  [Confidence: SEDANG]
"Taker B/S > 1.30 setelah liquidation event = valid bounce
signal, TAPI hanya untuk scalp pendek (target ke resistance
terdekat). Bukan reversal trend."
Sumber: SOL_20260518_BASELINE (taker 1.320 setelah flush
$35.6M -> bounce ke $85, bukan reversal)

RULE #008  [Confidence: SEDANG]
"High volume candle (>1.4x average) + taker B/S < 0.85 =
aggressive distribution. Setup short bertambah valid."
Sumber: SOL_20260519 14:00 UTC (1.43M SOL vol, taker 0.753)

─────────────────────────────────────────
KATEGORI D: RISK MANAGEMENT
─────────────────────────────────────────

RULE #009  [Confidence: TINGGI — NON-NEGOTIABLE]
"Risk per trade ≤ 1% modal. Total exposure aktif ≤ 10%
modal. Jangan tambah size hanya karena yakin — yakin
tidak menggantikan risk management."
Sumber: TRADE_LOG_SOL_001 (sizing 3-5% notional, risk
0.45-0.6% modal)

═══════════════════════════════════════════════════════════════
DAFTAR_SINYAL_BAHAYA (anti-entry list)
═══════════════════════════════════════════════════════════════
🚫 L/S ratio > 70% + harga di tengah range → jangan long
🚫 4H clean downtrend + harga belum tes resistance → jangan long
🚫 OI naik tapi harga turun → trapped longs, jangan ikut long
🚫 Mid-range entry tanpa level tes → tunggu edge
🚫 Volume spike + taker < 0.85 → distribusi aktif, jangan long

═══════════════════════════════════════════════════════════════
CHANGE LOG
═══════════════════════════════════════════════════════════════
v1.0  2026-05-19  Inisialisasi 9 rules dari baseline SOL
                  + WAIT decision TRADE_LOG_SOL_001
                  + Live data validation snapshot 15:32 UTC



═══════════════════════════════════════════════════════════════
v1.1 UPDATE — 2026-05-19 15:50 UTC
═══════════════════════════════════════════════════════════════

─────────────────────────────────────────
KATEGORI E: SMART MONEY READING (NEW)
─────────────────────────────────────────

RULE #010  [Confidence: TINGGI]
"Selalu bandingkan 3 layer L/S sentiment:
 a) globalLongShortAccountRatio (RETAIL)
 b) topLongShortAccountRatio (TOP ACCOUNT count)
 c) topLongShortPositionRatio (TOP POSITION SIZE = SMART MONEY)
Jika divergence (a) - (c) > 8pp = sinyal contrarian
toward smart money side. Layer (c) is the truth."
Sumber: SOL_20260519_1545_FULL (76.19% retail vs 63.81% smart)

RULE #011  [Confidence: SEDANG]
"Top trader position trend lebih penting dari level absolut.
Jika smart money REDUCING long sementara retail ADDING,
itu setup short yang lebih reliable dari L/S extreme saja."
Sumber: SOL trend 12h: smart 64.21%->63.81%, retail 75%->76%

─────────────────────────────────────────
KATEGORI F: LIQUIDATION CLUSTER
─────────────────────────────────────────

RULE #012  [Confidence: SEDANG]
"Estimasi crowd avg entry pakai VWAP 12 candle 4H.
Hitung liq zones untuk leverage 5x/10x/20x/25x/50x.
Cluster dense (multiple leverage tiers within 5%) =
magnet kuat. Target take profit di cluster terdekat."
Sumber: SOL_20260519 → cluster $80.80-$81.63 dense zone

RULE #013  [Confidence: SEDANG]
"50x leverage liq dalam 1.5% dari current price = high
volatility risk. Stop loss harus 1.5x lebih lebar dari
normal untuk hindari whipsaw saat cascade."
Sumber: SOL 50x liq $83.27 vs price $84.35 (1.28%)

─────────────────────────────────────────
KATEGORI G: MARKET LEADER CONTEXT
─────────────────────────────────────────

RULE #014  [Confidence: TINGGI]
"Selalu cek BTC trend sebelum trade alt high-beta:
 - BTC trend SAMA dgn alt setup → confidence FULL
 - BTC FLAT → trade alt setup, confidence 80%
 - BTC OPPOSITE → reduce confidence 50%, kurangi size"
Sumber: BTC flat hari ini, SOL setup short tetap valid
        tapi tidak full confidence.

─────────────────────────────────────────
KATEGORI H: VENUE DIVERGENCE
─────────────────────────────────────────

RULE #015  [Confidence: SEDANG]
"Funding rate cross-venue (Binance vs dYdX/Bybit/Kraken):
 jika Binance L/S extreme tapi funding venue lain neutral/
 opposite, kondisi Binance adalah anomali venue, bukan
 sinyal market global. Confidence on Binance signal naik
 (because retail di Binance lebih extreme di-isolated)."
Sumber: SOL Binance retail 76% long, dYdX funding -0.003%
        (mild short bias) = Binance retail terisolasi salah.

─────────────────────────────────────────
DAFTAR_SINYAL_BAHAYA — UPDATE
─────────────────────────────────────────
🚫 Smart money REDUCING long + retail ADDING → jangan long
🚫 BTC opposite trend dari setup alt → kurangi size minimal 50%
🚫 50x liq cluster < 1.5% dari entry → set SL lebih lebar

═══════════════════════════════════════════════════════════════
v1.1 RULES TOTAL: 15 (added 6 from autonomous research session)
═══════════════════════════════════════════════════════════════
