// ?debug=1 overlay: raw state, seed input, bot autoplay hint. Plain DOM so it
// stays readable and copyable regardless of canvas scaling.
import type Phaser from 'phaser';
import { effectiveIntent } from './core';
import { session } from './session';

export function installDebugOverlay(game: Phaser.Game): void {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;top:0;right:0;z-index:10;max-width:340px;max-height:70vh;overflow:auto;background:rgba(0,0,0,.82);color:#cfe;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;padding:8px;border-bottom-left-radius:8px';
  root.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <b>DEBUG</b>
      <input id="dbg-seed" placeholder="seed" style="width:110px;font:inherit">
      <button id="dbg-go">Restart run with seed</button>
      <button id="dbg-toggle">hide</button>
    </div>
    <div style="opacity:.7;margin:4px 0">Press B in a match: bot plays one action.</div>
    <pre id="dbg-state" style="margin:0;white-space:pre-wrap"></pre>`;
  document.body.appendChild(root);

  const pre = root.querySelector<HTMLPreElement>('#dbg-state')!;
  const input = root.querySelector<HTMLInputElement>('#dbg-seed')!;
  root.querySelector('#dbg-go')!.addEventListener('click', () => {
    session.newRun(input.value.trim() || undefined);
    session.startMatch();
    for (const s of game.scene.getScenes(true)) s.scene.stop();
    game.scene.start('Match');
  });
  root.querySelector('#dbg-toggle')!.addEventListener('click', (e) => {
    const hidden = pre.style.display === 'none';
    pre.style.display = hidden ? '' : 'none';
    (e.target as HTMLButtonElement).textContent = hidden ? 'hide' : 'show';
  });

  const render = () => {
    const { run, match } = session;
    const view = {
      run: run && {
        seed: run.seed,
        round: run.round,
        status: run.status,
        balance: run.playerBalance,
        deck: run.deck,
        rewardChoices: run.rewardChoices,
        history: run.history,
      },
      match: match && {
        seed: match.seed,
        turn: match.turn,
        phase: match.phase,
        grip: match.grip,
        player: match.player,
        opponent: match.opponent,
        intent: match.phase === 'over' ? null : effectiveIntent(match),
        hand: match.hand.map((c) => c.id),
        drawPile: match.drawPile.map((c) => c.id),
        discardPile: match.discardPile.map((c) => c.id),
        exhaustPile: match.exhaustPile.map((c) => c.id),
        winner: match.winner,
        cardsPlayed: match.cardsPlayed,
      },
    };
    if (run && !input.value) input.placeholder = String(run.seed);
    pre.textContent = JSON.stringify(view, null, 1);
  };
  session.onChange(render);
  render();
}
