import Phaser from 'phaser';
import { cardDef, chooseReward, DEFAULT_DATA, type CardId } from '../core';
import { opponentName, t } from '../i18n';
import { session } from '../session';
import { CARD_H, makeCard } from '../ui/cardView';
import { C, H, W, textStyle } from '../ui/theme';
import { makeButton } from '../ui/widgets';

export class RewardScene extends Phaser.Scene {
  constructor() {
    super('Reward');
  }

  create(): void {
    const run = session.run;
    if (!run || run.status !== 'reward') {
      this.scene.start('Menu');
      return;
    }
    const beaten = run.history[run.history.length - 1];
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    this.add
      .text(W / 2, 60, t('reward.title', { name: beaten ? opponentName(beaten.opponentId) : '' }), textStyle(48, C.gold, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    this.add
      .text(W / 2, 118, t('reward.balance', { n: run.playerBalance, max: DEFAULT_DATA.rules.maxBalance }), textStyle(26, C.cream))
      .setOrigin(0.5);
    this.add.text(W / 2, 175, t('reward.pick'), textStyle(28, C.cream, { fontStyle: 'bold' })).setOrigin(0.5);

    const choices = run.rewardChoices;
    const spacing = 300;
    choices.forEach((id, i) => {
      const x = W / 2 + (i - (choices.length - 1) / 2) * spacing;
      const card = makeCard(this, id, cardDef(id), null).setPosition(x, 200 + (CARD_H * 1.4) / 2 + 20).setScale(1.4);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => this.tweens.add({ targets: card, scale: 1.5, duration: 100 }));
      card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1.4, duration: 100 }));
      card.on('pointerdown', () => this.pick(id));
    });

    const nextRound = run.round + 1;
    const nextId = run.bracket[nextRound];
    if (nextId) {
      this.add.text(W / 2, 650, t('reward.next', { name: opponentName(nextId) }), textStyle(24, C.cream)).setOrigin(0.5).setAlpha(0.8);
    }
    makeButton(this, W - 120, 660, 180, 56, t('reward.skip'), () => this.pick(null), {
      fill: C.panelLight,
      textColor: C.cream,
      fontSize: 22,
    });
  }

  private pick(id: CardId | null): void {
    const run = session.run;
    if (!run) return;
    session.setRun(chooseReward(run, id));
    session.startMatch();
    this.scene.start('Match');
  }
}
