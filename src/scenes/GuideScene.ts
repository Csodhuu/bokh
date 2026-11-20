import Phaser from 'phaser';
import { cardDef, DEFAULT_DATA, type CardEffect, type OpponentMove } from '../core';
import { cardDescription, cardName, gripName, moveName, opponentName, t } from '../i18n';
import { makeCard } from '../ui/cardView';
import { C, H, W, hex, textStyle } from '../ui/theme';
import { makeButton } from '../ui/widgets';

const TABS = ['basics', 'grip', 'opponents', 'defense', 'combos', 'tips', 'cards'] as const;
type Tab = (typeof TABS)[number];

const TOP = 150;
const BOTTOM = H - 20;
const TEXT_W = 1180;

const data = DEFAULT_DATA;
const cost = (id: string) => cardDef(id).cost;
const effect = <T extends CardEffect['type']>(id: string, type: T) =>
  cardDef(id).effects.find((e) => e.type === type) as Extract<CardEffect, { type: T }> | undefined;
const dmg = (id: string) => effect(id, 'damage')?.amount ?? 0;

export interface GuideData {
  from?: 'Menu' | 'Match';
}

/** In-game guide: rules, grip, opponents, defense, combos, tips, card list. */
export class GuideScene extends Phaser.Scene {
  private static tab: Tab = 'basics';
  private from: 'Menu' | 'Match' = 'Menu';
  private content!: Phaser.GameObjects.Container;
  private tabButtons: { tab: Tab; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('Guide');
  }

  init(d: GuideData): void {
    this.from = d.from ?? 'Menu';
  }

  create(): void {
    this.tabButtons = [];
    // Opaque background that also swallows taps meant for a paused scene below.
    this.add.rectangle(W / 2, H / 2, W, H, C.bg, 0.98).setInteractive();
    this.add.text(40, 26, t('guide.title'), textStyle(40, C.gold, { fontStyle: 'bold' }));
    makeButton(this, W - 120, 50, 180, 56, t('guide.close'), () => this.close(), { fontSize: 24 });

    const tabW = 168;
    TABS.forEach((tab, i) => {
      const x = W / 2 + (i - (TABS.length - 1) / 2) * (tabW + 6);
      const bg = this.add.rectangle(x, 112, tabW, 48, C.panelLight).setRounded(12).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, 112, t(`guide.tab.${tab}`), textStyle(21, C.cream, { fontStyle: 'bold' })).setOrigin(0.5);
      bg.on('pointerdown', () => this.show(tab));
      this.tabButtons.push({ tab, bg, label });
    });

    this.content = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.show(GuideScene.tab);
  }

  private close(): void {
    if (this.from === 'Match') {
      this.scene.stop();
      this.scene.resume('Match');
    } else {
      this.scene.start('Menu');
    }
  }

  private show(tab: Tab): void {
    GuideScene.tab = tab;
    for (const b of this.tabButtons) {
      const on = b.tab === tab;
      b.bg.setFillStyle(on ? C.gold : C.panelLight);
      b.label.setColor(hex(on ? C.bg : C.cream));
    }
    this.content.removeAll(true);
    switch (tab) {
      case 'basics':
        return this.paragraphs([
          t('guide.basics', {
            energy: data.rules.energyPerTurn,
            hand: data.rules.handSize,
            palm: data.rules.palmSaveBalance,
            fatigue: data.rules.fatigueStartTurn,
            every: data.rules.fatigueEscalateEvery,
            rounds: data.rules.bracket.length,
            heal: data.rules.healOnWin,
          }),
        ]);
      case 'grip': {
        const lines = Object.keys(data.cards)
          .filter((id) => (cardDef(id).requiresGrip ?? 0) > 0)
          .sort((a, b) => (cardDef(a).requiresGrip ?? 0) - (cardDef(b).requiresGrip ?? 0))
          .map((id) => `•  ${gripName(cardDef(id).requiresGrip ?? 0)} — ${cardName(id)}: ${cardDescription(cardDef(id)).join(', ')}`);
        return this.paragraphs([t('guide.grip', { fallback: data.rules.fallbackGripOnMissingGrip }), t('guide.gripCards'), lines.join('\n')], [1]);
      }
      case 'opponents': {
        const lines = data.rules.bracket.map((id, i) => {
          const opp = data.opponents[id]!;
          const pattern = opp.pattern.map(describeMove).join('  →  ');
          return `${i + 1}. ${t('guide.opponentLine', { name: opponentName(id), balance: opp.balance, pattern })}`;
        });
        return this.paragraphs([t('guide.opponents'), lines.join('\n\n')], [1]);
      }
      case 'defense':
        return this.paragraphs([t('guide.defense')]);
      case 'combos': {
        const n = (id: string) => cardName(id);
        const combos = [
          t('combo.legHook', { legGrab: n('legGrab'), hook: n('hook'), cost: cost('legGrab') + cost('hook'), dmg: dmg('hook') }),
          t('combo.slap', { slap: n('zasuulSlap'), hook: n('hook'), n: effect('zasuulSlap', 'energyNextTurn')?.amount ?? 1 }),
          t('combo.lift', { legGrab: n('legGrab'), sleeveGrip: n('sleeveGrip'), lift: n('liftAndThrow'), dmg: dmg('liftAndThrow') }),
          t('combo.hip', { hipThrow: n('hipThrow'), dmg: dmg('hipThrow') }),
          t('combo.knee', {
            kneeSweep: n('kneeSweep'),
            lowerStance: n('lowerStance'),
            w: effect('kneeSweep', 'weakenNextAttack')?.amount ?? 0,
            g: effect('lowerStance', 'guard')?.amount ?? 0,
          }),
          t('combo.stepReversal', { stepBack: n('stepBack'), reversal: n('reversal') }),
        ];
        return this.paragraphs([t('guide.combosIntro'), combos.map((c) => `•  ${c}`).join('\n\n')], [0]);
      }
      case 'tips': {
        const tips = [1, 2, 3, 4, 5, 6].map((i) =>
          `•  ${t(`tipguide.${i}`, { fatigue: data.rules.fatigueStartTurn, heal: data.rules.healOnWin })}`,
        );
        return this.paragraphs([t('guide.tipsIntro'), tips.join('\n\n')], [0]);
      }
      case 'cards':
        return this.cards();
    }
  }

  /** Stacked text blocks; indices in `headings` are drawn gold + bold. Shrinks to fit. */
  private paragraphs(blocks: string[], headings: number[] = []): void {
    for (let size = 23; size >= 15; size--) {
      this.content.removeAll(true);
      let y = TOP;
      for (const [i, block] of blocks.entries()) {
        const head = headings.includes(i);
        const txt = this.add.text(50, y, block, textStyle(head ? size + 1 : size, head ? C.gold : C.cream, {
          fontStyle: head ? 'bold' : '',
          wordWrap: { width: TEXT_W },
          lineSpacing: Math.round(size * 0.3),
        }));
        this.content.add(txt);
        y += txt.height + (head ? 10 : 22);
      }
      if (y <= BOTTOM) return;
    }
  }

  private cards(): void {
    const starter = [...new Set(data.starterDeck)];
    const rewards = [...new Set(data.rewardPool)];
    const scale = 0.8;
    const rows: [string, string[], number][] = [
      [t('guide.starter'), starter, 170],
      [t('guide.rewards'), rewards, 440],
    ];
    for (const [label, ids, y] of rows) {
      this.content.add(this.add.text(50, y - 22, label, textStyle(24, C.gold, { fontStyle: 'bold' })));
      ids.forEach((id, i) => {
        const x = W / 2 + (i - (ids.length - 1) / 2) * 196;
        const c = makeCard(this, id, cardDef(id), null).setScale(scale).setPosition(x, y + 115);
        this.content.add(c);
      });
    }
  }
}

function describeMove(m: OpponentMove): string {
  const name = moveName(m.id);
  if (m.type === 'attack') {
    const hits = m.hits ?? 1;
    const dmgText = hits > 1 ? `${hits}×−${m.damage}` : `−${m.damage}`;
    const need = m.requiresGrip ? ` (${gripName(m.requiresGrip)})` : '';
    return `⚔ ${name} ${dmgText}${need}`;
  }
  if (m.type === 'guard') return `🛡 ${name} +${m.amount}`;
  return `✊ ${name} +${m.amount}`;
}
