import Phaser from 'phaser';
import { roundsWon, totalTurns } from '../core';
import { cardName, opponentName, t } from '../i18n';
import { mostPlayed, runSummary, session } from '../session';
import { C, H, W, textStyle } from '../ui/theme';
import { makeButton } from '../ui/widgets';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without async clipboard (or non-secure contexts).
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export class RunEndScene extends Phaser.Scene {
  constructor() {
    super('RunEnd');
  }

  create(): void {
    const run = session.run;
    if (!run) {
      this.scene.start('Menu');
      return;
    }
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    const won = run.status === 'won';
    const last = run.history[run.history.length - 1];
    this.add
      .text(W / 2, 64, won ? t('end.won') : t('end.lost', { name: last ? opponentName(last.opponentId) : '' }), textStyle(52, won ? C.gold : C.danger, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    const top = mostPlayed(run, 3);
    const lines = [
      t('end.rounds', { n: roundsWon(run), total: run.bracket.length }),
      t('end.turns', { n: totalTurns(run) }),
      t('end.mostPlayed', { list: top.length ? top.map(([id, c]) => `${cardName(id)} ×${c}`).join(', ') : t('end.none') }),
    ];
    this.add.text(W / 2, 130, lines.join('\n'), textStyle(28, C.cream, { align: 'center', lineSpacing: 10 })).setOrigin(0.5, 0);

    const summary = runSummary(run);
    this.add.rectangle(W / 2, 410, 900, 220, C.panel).setStrokeStyle(2, C.gold, 0.5).setRounded(12);
    this.add
      .text(W / 2 - 430, 310, summary, textStyle(19, C.cream, { wordWrap: { width: 860 }, lineSpacing: 4 }))
      .setAlpha(0.9);

    const status = this.add.text(W / 2, 540, '', textStyle(22, C.gold)).setOrigin(0.5);
    makeButton(this, W / 2, 600, 300, 70, t('end.copy'), async () => {
      const ok = await copyText(summary);
      status.setText(ok ? t('end.copied') : t('end.copyFailed'));
      if (!ok) window.prompt(t('end.copyFailed'), summary);
    }, { fontSize: 28 });

    makeButton(this, 220, 670, 260, 56, t('end.sameSeed'), () => this.restart(run.seed), { fill: C.panelLight, textColor: C.cream, fontSize: 22 });
    makeButton(this, W / 2, 680, 220, 56, t('end.newRun'), () => this.restart(), { fill: C.panelLight, textColor: C.cream, fontSize: 22 });
    makeButton(this, W - 180, 670, 200, 56, t('end.menu'), () => this.scene.start('Menu'), { fill: C.panelLight, textColor: C.cream, fontSize: 22 });
  }

  private restart(seed?: number): void {
    session.newRun(seed);
    session.startMatch();
    this.scene.start('Match');
  }
}
