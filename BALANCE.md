# Balance log

Numbers live in `src/data/*.json`. Run `npm run sim` after any change.
Target for the greedy bot with the starter deck: each opponent 30–80% win rate.

## v0.1 — initial tuning (sim: 10,000 matches per opponent, seed 1)

With the spec's original numbers the greedy bot won almost every match:

| opponent | balance | attack | guard | bot win rate | avg turns |
|---|---|---|---|---|---|
| Village  | 8  | twist 3        | brace 3 | 100.0% | 2.96 |
| Elephant | 14 | big throw 6    | brace 4 |  99.9% | 5.03 |
| Falcon   | 7  | 2 × 2          | —       | 100.0% | 2.80 |

Why: opponents attack only once every 2–3 turns, every attack is telegraphed
(so guard / Reversal / Step Back answer it), and the starter deck deals ~4
balance per turn. Raising attack damage alone barely helps because Reversal
reflects big hits back. Only opponent numbers were changed (card numbers and
rules are as specified):

| opponent | balance | attack | guard | bot win rate | avg turns | palm save used |
|---|---|---|---|---|---|---|
| Village  | 8 → **24**  | twist 3 → **9**       | brace 3 → **5** | 76.7% | 5.88 | 29.4% |
| Elephant | 14 → **26** | big throw 6 → **12**  | brace 4 → **8** | 43.0% | 6.54 | 60.0% |
| Falcon   | 7 → **24**  | 2×2 → **2×6**         | —               | 76.7% | 4.30 | 35.3% |

Full 3-match runs with random reward picks: **20.6%** run win rate
(0 wins 23.0%, 1 win 42.9%, 2 wins 13.5%, 3 wins 20.6%).

Open question for playtesting: opponents now have ~2.5× the player's balance.
An alternative that keeps numbers closer to the spec is to make opponent
patterns attack more often (e.g. Village: grab → twist → twist → brace) —
worth trying if fights feel like "chipping away at a wall".
