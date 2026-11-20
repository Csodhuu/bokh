// Quick balance grid search for one opponent:
//   npm run tune -- village "[[24,9,5],[22,8,6]]"
// Each triple is [balance, attackDamage, guardAmount]; every attack/guard move
// in that opponent's pattern gets the value. 2,000 matches per row.
import { simulate } from './sim';
import { DEFAULT_DATA } from '../src/core';

const which = process.argv[2];
const gridArg = process.argv[3];
if (!which || !gridArg || !DEFAULT_DATA.opponents[which]) {
  console.error('usage: npm run tune -- <opponentId> "[[balance,damage,guard], ...]"');
  process.exit(1);
}
const grid = JSON.parse(gridArg) as number[][];
console.log('opponent balance damage guard winRate avgTurns');
for (const [bal, dmg, guard] of grid) {
  const d = structuredClone(DEFAULT_DATA);
  d.rules.bracket = [which];
  const o = d.opponents[which]!;
  if (bal !== undefined) o.balance = bal;
  for (const m of o.pattern) {
    if (m.type === 'attack' && dmg !== undefined) m.damage = dmg;
    if (m.type === 'guard' && guard !== undefined) m.amount = guard;
  }
  const r = simulate(2000, 7, d).rows.find((x) => x.opponent === which)!;
  console.log(which, bal, dmg, guard, `${(r.winRate * 100).toFixed(1)}%`, r.avgTurns.toFixed(2));
}
