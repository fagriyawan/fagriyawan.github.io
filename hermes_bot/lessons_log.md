# HERMES Lessons Log

_Bot auto-appends this file after each closed trade. Hermes (AI) reviews periodically and updates HERMES_RULE_BOOK.md._

═══════════════════════════════════════════════════════════════
[LESSON_LOST_001] TRADE_0001 (manual entry by Hermes review)
═══════════════════════════════════════════════════════════════
Time     : 2026-05-19 16:49 UTC opened, ~17:33 UTC effectively lost
Symbol   : SOLUSDT SHORT
Setup    : SOL_SETUP_C (Scout)
Entry    : $84.72
Size     : $150 (1.5% modal)
SL       : $85.30  TP1: $83.50  TP2: $81.63
Status   : POSITION LOST DUE TO ARCHITECTURAL BUG

What happened:
  - Bot in Termux opened TRADE_0001 at 16:49 UTC (commit e188ddf)
  - At ~17:33 UTC, Hermes (AI) test in sandbox: rm state.json + bot --once
  - Sandbox commit overwrote production state.json in git with empty state
  - Bot's next pull (rebase) loaded empty state, position effectively gone
  - At 18:10 + 00:05 UTC heartbeats, state still shows trade_counter=0

What WOULD have happened (counterfactual):
  - Price moved from $84.72 entry to $84.21 current = +0.60% for SHORT
  - Hypothetical P&L: +$0.90 unrealized (still open)
  - 24h price action: $85.96 high → $83.7 low → $84.21 now
  - 4H structure validated short bias (5 LH, sustained downtrend)
  - Trade was on track to hit TP1 at $83.50

Auto observation:
  Trade ANALISIS BENAR (smart money divergence -12pp at entry,
  -32pp persistent over 12h). LOSS was operational, not analytical.

Lessons captured:
  → RULE #016: state.json is bot-owned, Hermes never modifies
  → Architecture: separate Hermes-owned files (setups, rules, lessons)
                  from bot-owned (state, history, snapshots)
  → For testing Hermes code: use temp directory, never repo dir

═══════════════════════════════════════════════════════════════
[OBSERVATION_001] 24h SOL data review (manual by Hermes)
═══════════════════════════════════════════════════════════════
Time period: 2026-05-19 13:00 UTC to 2026-05-20 00:30 UTC

Persistent regime detected:
  Smart money 40-41% long throughout (no shift)
  Retail      71-72% long throughout (no shift)
  Divergence  ~32pp constant for 12+ hours
  
Price action:
  High $85.96 → Low $83.70 → Now $84.21
  Net move    : -1.4% over 12h (bearish bias confirmed)
  Range       : $2.26 (2.6% range)
  
Trigger analysis:
  Setup A ($85.20-$85.60): not triggered (price max $85.07 in 12h)
  Setup B (break $83.45) : not triggered (low $83.70, holding)
  Setup C ($84.70-$84.90): triggered once (TRADE_0001, lost)

Conclusion:
  Setups too narrow. Markets often consolidate, missing opportunities.
  → Added Setup D (range short $84.95-$85.30) and Setup E (long hedge $83.55-$83.75)
  → Widened Setup C zone to $84.50-$84.80
  → Widened Setup A zone to $85.10-$85.50

Funding rate observation:
  -0.5bp / 0.7bp / 0.1bp range = neutral, no panic
  → Squeeze setups need funding > 0.05%/8h threshold (Rule #019)

Liquidation observation:
  Long liq 1h: $346 (minor)
  Short liq 1h: $0
  → No cascade event yet. Cluster $80.80 still magnet but distant.
═══════════════════════════════════════════════════════════════

(Future trades will append automatically below this line)

