import Phaser from 'phaser';
import {
  applyAction,
  cardDef,
  chooseBotAction,
  DEFAULT_DATA,
  effectiveIntent,
  fatigueForTurn,
  playBlockReason,
  type MatchAction,
  type MatchEvent,
  type MatchState,
  type PlayBlockReason,
  type Side,
} from '../core';
import { cardName, gripName, moveName, opponentName, t } from '../i18n';
import { DEBUG, session } from '../session';
import { CARD_H, CARD_W, makeCard } from '../ui/cardView';
import { C, H, W, hex, textStyle } from '../ui/theme';
import { matchTip } from '../ui/tips';
import { banner, floatText, makeBar, makeButton, wait, type Bar, type Button } from '../ui/widgets';
import { Wrestler } from '../ui/wrestler';

const GROUND_Y = 410;
const HAND_Y = 600;
const HAND_X0 = 374;
const HAND_X1 = 1156;
/** On touch, the first tap enlarges a card this much so its text is readable. */
const SELECT_SCALE = 1.6;

export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private busy = false;
  private selected = -1;

  private player!: Wrestler;
  private opponent!: Wrestler;
  private oppBar!: Bar;
  private playerBar!: Bar;
  private oppName!: Phaser.GameObjects.Text;
  private oppGuard!: Phaser.GameObjects.Text;
  private intentIcon!: Phaser.GameObjects.Text;
  private intentText!: Phaser.GameObjects.Text;
  private intentSub!: Phaser.GameObjects.Text;
  private intentPanel!: Phaser.GameObjects.Rectangle;
  private roundText!: Phaser.GameObjects.Text;
  private gripPills: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private energyText!: Phaser.GameObjects.Text;
  private guardText!: Phaser.GameObjects.Text;
  private guardIcon!: Phaser.GameObjects.Container;
  private palmText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private pileText!: Phaser.GameObjects.Text;
  private endTurnBtn!: Button;
  private handCards: Phaser.GameObjects.Container[] = [];
  private tapHint!: Phaser.GameObjects.Text;
  private tipText!: Phaser.GameObjects.Text;

  constructor() {
    super('Match');
  }

  create(): void {
    const m = session.match;
    if (!m) {
      this.scene.start('Menu');
      return;
    }
    this.state = m;
    this.busy = false;
    this.selected = -1;
    this.handCards = [];
    this.gripPills = [];

    this.buildBackground();
    this.buildTop();
    this.buildMiddle();
    this.buildBottom();
    this.tapHint = this.add
      .text(0, 0, t('hud.tapAgain'), textStyle(22, C.bg, { fontStyle: 'bold', backgroundColor: hex(C.gold), padding: { x: 10, y: 4 } }))
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
    this.refreshAll(false);

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0 && this.selected >= 0) {
        this.selected = -1;
        this.layoutHand(false);
      }
    });

    if (DEBUG) {
      this.input.keyboard?.on('keydown-B', () => void this.dispatch(chooseBotAction(this.state)));
    }

    const run = session.run;
    void (async () => {
      this.busy = true;
      if (run) {
        await banner(
          this,
          opponentName(this.state.opponent.id),
          t('hud.round', { n: run.round + 1, total: run.bracket.length }),
          C.gold,
          900,
        );
      }
      session.pendingEvents = [];
      this.busy = false;
      this.refreshAll();
    })();
  }

  update(time: number): void {
    this.player?.update(time);
    this.opponent?.update(time);
  }

  // ------------------------------------------------------------------ layout

  private buildBackground(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    // sky band + steppe
    this.add.rectangle(W / 2, 260, W, 300, 0x2b3a4a, 0.55);
    this.add.ellipse(W / 2, GROUND_Y + 8, 1000, 80, C.ground);
    this.add.ellipse(W / 2, GROUND_Y + 4, 900, 56, 0x5a7d3d);
    this.add.rectangle(W / 2, 455 + 8, W, 2, C.cream, 0.08);
  }

  private buildTop(): void {
    // Intent panel (top-left)
    this.intentPanel = this.add.rectangle(30, 14, 700, 106, C.panel).setOrigin(0, 0).setStrokeStyle(3, C.danger, 0.9);
    this.intentPanel.setRounded(14);
    this.roundText = this.add.text(48, 24, '', textStyle(18, C.cream, { fontStyle: 'bold' })).setAlpha(0.75);
    this.intentIcon = this.add.text(78, 80, '', textStyle(40)).setOrigin(0.5);
    this.intentText = this.add.text(120, 56, '', textStyle(30, C.cream, { fontStyle: 'bold' }));
    this.intentSub = this.add.text(120, 92, '', textStyle(18, C.cream)).setAlpha(0.85);

    // Opponent HUD (top-right)
    this.oppName = this.add.text(760, 18, '', textStyle(30, C.cream, { fontStyle: 'bold' }));
    this.oppBar = makeBar(this, 760, 80, 400, 34, C.blue);
    this.oppGuard = this.add
      .text(1180, 80, '', textStyle(22, C.cream, { fontStyle: 'bold', backgroundColor: hex(C.guard), padding: { x: 8, y: 4 } }))
      .setOrigin(0, 0.5);

    // Guide button (pauses the match)
    makeButton(this, W - 34, 34, 52, 52, '?', () => this.openGuide(), { fontSize: 30 });

    // Contextual coaching tip under the intent panel
    this.tipText = this.add
      .text(40, 130, '', textStyle(20, C.gold, { fontStyle: 'bold', wordWrap: { width: 690 }, stroke: '#000', strokeThickness: 4 }))
      .setDepth(5);
  }

  private openGuide(): void {
    if (this.busy) return;
    this.selected = -1;
    this.layoutHand(false);
    this.scene.launch('Guide', { from: 'Match' });
    this.scene.pause();
  }

  private refreshTip(): void {
    const tip = this.busy ? null : matchTip(this.state);
    if (!tip) {
      this.tipText.setText('');
      return;
    }
    const params: Record<string, string | number> = { ...tip.params };
    for (const [k, id] of Object.entries(tip.cards ?? {})) params[k] = cardName(id);
    for (const [k, id] of Object.entries(tip.moves ?? {})) params[k] = moveName(id);
    for (const [k, g] of Object.entries(tip.grips ?? {})) params[k] = gripName(g);
    this.tipText.setText(t(tip.key, params));
    this.tipText.setColor(hex(tip.key === 'tip.lethal' || tip.key === 'tip.palm' ? C.danger : C.gold));
  }

  private buildMiddle(): void {
    this.player = new Wrestler(this, this.wrestlerX('player', this.state.grip), GROUND_Y, 1, C.red);
    this.opponent = new Wrestler(this, this.wrestlerX('opponent', this.state.grip), GROUND_Y, -1, C.blue);

    this.statusText = this.add
      .text(W / 2, 150, '', textStyle(20, C.cream, { fontStyle: 'bold', align: 'center' }))
      .setOrigin(0.5);

    // Grip tracker
    const pillW = 170;
    const y = 445;
    this.add.text(W / 2 - 2 * (pillW + 8) - 14, y, t('grip.label'), textStyle(20, C.cream, { fontStyle: 'bold' })).setOrigin(1, 0.5);
    for (let i = 0; i <= 3; i++) {
      const x = W / 2 + (i - 1.5) * (pillW + 8);
      const bg = this.add.rectangle(x, y, pillW, 34, C.panelLight).setRounded(17).setStrokeStyle(2, C.gold, 0.4);
      const label = this.add.text(x, y, `${i} · ${gripName(i)}`, textStyle(18, C.cream)).setOrigin(0.5);
      this.gripPills.push({ bg, label });
    }
  }

  private buildBottom(): void {
    this.add.text(24, 482, t('hud.you'), textStyle(24, C.cream, { fontStyle: 'bold' }));
    this.palmText = this.add.text(90, 486, '', textStyle(17, C.cream, { fontStyle: 'bold' }));
    this.playerBar = makeBar(this, 22, 538, 254, 34, C.red);

    // energy orb
    this.add.circle(78, 626, 42, C.energy).setStrokeStyle(4, C.bg);
    this.energyText = this.add.text(78, 622, '', textStyle(38, C.bg, { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(78, 684, t('hud.energy'), textStyle(18, C.cream)).setOrigin(0.5, 0);

    // guard shield
    const shield = this.add.graphics();
    shield.fillStyle(C.guard);
    shield.beginPath();
    shield.moveTo(-36, -38);
    shield.lineTo(36, -38);
    shield.lineTo(36, 4);
    shield.lineTo(0, 40);
    shield.lineTo(-36, 4);
    shield.closePath();
    shield.fillPath();
    this.guardText = this.add.text(0, -6, '', textStyle(34, C.bg, { fontStyle: 'bold' })).setOrigin(0.5);
    this.guardIcon = this.add.container(206, 624, [shield, this.guardText]);
    this.add.text(206, 684, t('hud.guard'), textStyle(18, C.cream)).setOrigin(0.5, 0);

    this.endTurnBtn = makeButton(this, 1162, 436, 196, 60, t('hud.endTurn'), () => this.onEndTurn(), { fontSize: 26 });
    this.pileText = this.add.text(1162, 474, '', textStyle(15, C.cream, { align: 'center' })).setOrigin(0.5, 0.5).setAlpha(0.75);
  }

  private wrestlerX(side: Side, grip: number): number {
    const gap = 250 - grip * 42;
    return side === 'player' ? W / 2 - gap / 2 - 60 : W / 2 + gap / 2 + 60;
  }

  // ------------------------------------------------------------------ refresh

  private refreshAll(animate = true): void {
    const s = this.state;
    const run = session.run;
    this.oppName.setText(opponentName(s.opponent.id));
    this.oppBar.set(s.opponent.balance, s.opponent.maxBalance, animate);
    this.playerBar.set(s.player.balance, s.player.maxBalance, animate);
    this.player.setBalanceRatio(s.player.balance / s.player.maxBalance);
    this.opponent.setBalanceRatio(s.opponent.balance / s.opponent.maxBalance);
    this.setOppGuard(s.opponent.guard);
    this.setGuard(s.player.guard);
    this.energyText.setText(String(s.player.energy));
    this.palmText.setText(`✋ ${s.player.palmSaveUsed ? t('hud.palmUsed') : t('hud.palmReady')}`);
    this.palmText.setColor(hex(s.player.palmSaveUsed ? C.grey : C.gold));
    this.setGrip(s.grip, false);

    const fatigueStart = DEFAULT_DATA.rules.fatigueStartTurn;
    const fatigueNow = fatigueForTurn(s.turn);
    const parts = [
      run ? t('hud.round', { n: run.round + 1, total: run.bracket.length }) : '',
      t('hud.turn', { n: s.turn }),
      fatigueNow > 0 ? t('hud.fatigueNow', { n: fatigueNow }) : t('hud.fatigueSoon', { n: fatigueStart }),
    ].filter(Boolean);
    this.roundText.setText(parts.join('  ·  '));
    this.roundText.setColor(hex(fatigueNow > 0 ? C.danger : C.cream));

    const statuses: string[] = [];
    if (s.player.reversalActive) statuses.push(`↺ ${t('hud.reversalReady')}`);
    if (s.opponent.attackPenalty > 0) statuses.push(t('hud.weakened', { n: s.opponent.attackPenalty }));
    this.statusText.setText(statuses.join('\n'));

    this.pileText.setText(`${t('hud.draw', { n: s.drawPile.length })} · ${t('hud.discard', { n: s.discardPile.length })}`);
    this.refreshIntent();
    this.refreshTip();
    this.layoutHand(false, true);
    this.endTurnBtn.setEnabled(!this.busy && s.phase !== 'over');
  }

  private refreshIntent(): void {
    const s = this.state;
    if (s.phase === 'over') {
      this.intentIcon.setText('');
      this.intentText.setText('');
      this.intentSub.setText('');
      return;
    }
    const intent = effectiveIntent(s);
    const move = moveName(intent.moveId);
    let icon = '✊';
    let text = '';
    let color: number = C.gold;
    if (intent.type === 'attack') {
      icon = '⚔';
      color = C.danger;
      const first = Math.max(0, intent.amount - s.opponent.attackPenalty);
      text =
        intent.hits > 1
          ? t('intent.attackMulti', { move, hits: intent.hits, n: first === intent.amount ? intent.amount : `${first}/${intent.amount}` })
          : t('intent.attack', { move, n: intent.totalDamage });
    } else if (intent.type === 'guard') {
      icon = '🛡';
      color = C.guard;
      text = t('intent.guard', { move, n: intent.amount });
    } else {
      text = t('intent.grip', { move, n: intent.amount });
    }
    this.intentIcon.setText(icon);
    this.intentText.setText(text);
    this.intentText.setColor(hex(color));
    this.intentPanel.setStrokeStyle(3, color, 0.9);
    this.intentSub.setText(
      intent.convertedFrom
        ? t('intent.converted', { move: moveName(intent.convertedFrom), grip: gripName(intent.requiresGrip ?? 0) })
        : t('intent.label'),
    );
  }

  private setGrip(level: number, animate: boolean): void {
    this.gripPills.forEach(({ bg, label }, i) => {
      const on = i === level;
      bg.setFillStyle(on ? C.gold : C.panelLight);
      bg.setStrokeStyle(on ? 3 : 2, on ? C.cream : C.gold, on ? 1 : 0.4);
      label.setColor(hex(on ? C.bg : C.cream));
      label.setFontStyle(on ? 'bold' : '');
      if (on && animate) this.tweens.add({ targets: [bg, label], scale: 1.15, duration: 120, yoyo: true });
    });
    if (animate) {
      this.player.moveTo(this.wrestlerX('player', level));
      this.opponent.moveTo(this.wrestlerX('opponent', level));
    } else {
      this.player.container.x = this.wrestlerX('player', level);
      this.opponent.container.x = this.wrestlerX('opponent', level);
    }
  }

  private setGuard(v: number): void {
    this.guardText.setText(String(v));
    this.guardIcon.setAlpha(v > 0 ? 1 : 0.35);
  }

  private setOppGuard(v: number): void {
    this.oppGuard.setText(`🛡 ${v}`);
    this.oppGuard.setVisible(v > 0);
  }

  private blockText(reason: PlayBlockReason | null): string | null {
    if (!reason) return null;
    if (reason.kind === 'grip') return t('block.grip', { grip: gripName(reason.need) });
    if (reason.kind === 'energy') return t('block.energy');
    return null;
  }

  // ------------------------------------------------------------------ hand

  private layoutHand(animateIn: boolean, rebuild = false): void {
    const s = this.state;
    if (rebuild || this.handCards.length !== s.hand.length) {
      this.handCards.forEach((c) => c.destroy());
      this.handCards = s.hand.map((card, i) => {
        const block = this.blockText(playBlockReason(s, i));
        const c = makeCard(this, card.id, cardDef(card.id), s.phase === 'over' ? null : block);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCardTap(i, p));
        c.on('pointerover', (p: Phaser.Input.Pointer) => {
          if (!p.wasTouch && !this.busy) this.hover(i, true);
        });
        c.on('pointerout', (p: Phaser.Input.Pointer) => {
          if (!p.wasTouch) this.hover(i, false);
        });
        return c;
      });
    }
    const n = this.handCards.length;
    const spacing = n > 1 ? Math.min(CARD_W + 10, (HAND_X1 - HAND_X0) / (n - 1)) : 0;
    const x0 = (HAND_X0 + HAND_X1) / 2 - (spacing * (n - 1)) / 2;
    this.handCards.forEach((c, i) => {
      const sel = i === this.selected;
      const x = x0 + i * spacing;
      const y = sel ? H - (CARD_H * SELECT_SCALE) / 2 - 4 : HAND_Y;
      c.setDepth(sel ? 20 : 10 + i);
      if (animateIn) {
        c.setPosition(x, H + CARD_H);
        this.tweens.add({ targets: c, y, duration: 260, delay: i * 50, ease: 'Cubic.easeOut' });
      } else {
        c.setPosition(x, y);
      }
      c.setScale(sel ? SELECT_SCALE : 1);
    });
    const sel = this.handCards[this.selected];
    this.tapHint.setVisible(!!sel);
    if (sel) this.tapHint.setPosition(sel.x, sel.y - (CARD_H * SELECT_SCALE) / 2 - 18);
  }

  private hover(i: number, on: boolean): void {
    const c = this.handCards[i];
    if (!c || this.selected === i) return;
    c.setDepth(on ? 19 : 10 + i);
    this.tweens.add({ targets: c, y: on ? HAND_Y - 40 : HAND_Y, scale: on ? 1.18 : 1, duration: 100 });
  }

  private onCardTap(i: number, p: Phaser.Input.Pointer): void {
    if (this.busy || this.state.phase === 'over') return;
    // On touch: first tap enlarges the card, second tap plays it.
    if (p.wasTouch && this.selected !== i) {
      this.selected = i;
      this.layoutHand(false);
      return;
    }
    const reason = playBlockReason(this.state, i);
    if (reason) {
      const c = this.handCards[i];
      if (c) {
        this.tweens.add({ targets: c, x: c.x + 8, duration: 50, yoyo: true, repeat: 2 });
        const txt = this.blockText(reason);
        if (txt) floatText(this, c.x, c.y - CARD_H / 2 - 10, txt, C.danger, 24);
      }
      return;
    }
    this.selected = -1;
    const card = this.handCards[i];
    if (card) {
      this.handCards.splice(i, 1);
      this.tweens.add({
        targets: card,
        x: W / 2,
        y: 300,
        scale: 0.6,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.easeIn',
        onComplete: () => card.destroy(),
      });
    }
    void this.dispatch({ type: 'PlayCard', handIndex: i });
  }

  private onEndTurn(): void {
    if (this.busy || this.state.phase === 'over') return;
    this.selected = -1;
    void this.dispatch({ type: 'EndTurn' });
  }

  // ------------------------------------------------------------------ actions + animation

  private async dispatch(action: MatchAction): Promise<void> {
    if (this.busy || this.state.phase === 'over') return;
    const { state, events } = applyAction(this.state, action);
    this.busy = true;
    this.endTurnBtn.setEnabled(false);
    this.tipText.setText('');
    const prev = this.state;
    this.state = state;
    session.setMatch(state);
    await this.animate(events, prev);
    this.busy = false;
    this.refreshAll();
    if (action.type === 'EndTurn' && state.phase !== 'over') this.layoutHand(true, true);
    if (state.phase === 'over') await this.finish();
  }

  private wrestlerOf(side: Side): Wrestler {
    return side === 'player' ? this.player : this.opponent;
  }

  private headPos(side: Side): [number, number] {
    const w = this.wrestlerOf(side);
    return [w.container.x, GROUND_Y - 280];
  }

  private async animate(events: MatchEvent[], prev: MatchState): Promise<void> {
    for (const e of events) {
      switch (e.type) {
        case 'CardPlayed':
          floatText(this, W / 2, 250, cardName(e.card.id), C.cream, 30);
          this.layoutHand(false);
          await wait(this, 180);
          break;
        case 'PlayRejected':
          break;
        case 'EnergyChanged':
          this.energyText.setText(String(e.to));
          break;
        case 'GripChanged':
          this.setGrip(e.to, true);
          await wait(this, 260);
          break;
        case 'GuardChanged':
          if (e.side === 'player') this.setGuard(e.to);
          else this.setOppGuard(e.to);
          if (e.to > e.from) {
            const [x, y] = this.headPos(e.side);
            floatText(this, x, y + 40, `🛡 +${e.to - e.from}`, C.guard, 30);
            this.wrestlerOf(e.side).brace();
            await wait(this, 200);
          }
          break;
        case 'GuardAbsorbed': {
          const [x, y] = this.headPos(e.side);
          floatText(this, x, y + 10, t('fx.blocked', { n: e.amount }), C.guard, 28);
          await wait(this, 220);
          break;
        }
        case 'BalanceChanged': {
          const [x, y] = this.headPos(e.side);
          const fat = e.source === 'fatigue';
          const diff = e.to - e.from;
          floatText(this, x, y - 10, fat ? t('fx.fatigue', { n: -diff }) : `${diff}`, fat ? 0xf08a24 : C.danger, fat ? 28 : 44);
          const max = e.side === 'player' ? prev.player.maxBalance : prev.opponent.maxBalance;
          (e.side === 'player' ? this.playerBar : this.oppBar).set(e.to, max);
          this.wrestlerOf(e.side).setBalanceRatio(e.to / max);
          if (!fat) {
            this.wrestlerOf(e.side).hit();
            this.cameras.main.shake(120, 0.004 * Math.min(4, -diff / 2));
          }
          await wait(this, 380);
          break;
        }
        case 'ReversalReady': {
          const [x, y] = this.headPos('player');
          floatText(this, x, y + 30, `↺ ${t('hud.reversalReady')}`, C.guard, 26);
          this.statusText.setText(`↺ ${t('hud.reversalReady')}`);
          await wait(this, 200);
          break;
        }
        case 'AttackWeakened': {
          const [x, y] = this.headPos('opponent');
          floatText(this, x, y + 30, t('hud.weakened', { n: e.amount }), C.gold, 26);
          this.refreshIntent();
          await wait(this, 200);
          break;
        }
        case 'HandDiscarded':
          this.handCards.forEach((c, i) =>
            this.tweens.add({ targets: c, y: H + CARD_H, alpha: 0, duration: 200, delay: i * 30 }),
          );
          await wait(this, 250);
          break;
        case 'OpponentActed': {
          this.tweens.add({ targets: this.intentPanel, alpha: 0.4, duration: 90, yoyo: true, repeat: 1 });
          if (e.intent.type === 'attack') await this.opponent.lunge();
          else await wait(this, 250);
          break;
        }
        case 'AttackReversed':
          void this.player.lunge();
          await banner(this, t('fx.reversal'), '', C.guard, 500);
          break;
        case 'PalmSave':
          this.palmText.setText(`✋ ${t('hud.palmUsed')}`).setColor(hex(C.grey));
          void this.player.palmTouch();
          await banner(this, `✋ ${t('fx.palmSave')}`, t('fx.palmSaveSub', { n: DEFAULT_DATA.rules.palmSaveBalance }), C.gold, 1300);
          break;
        case 'Fatigue':
          await banner(this, t('fx.fatigue', { n: e.amount }), '', 0xf08a24, 450);
          break;
        case 'TurnStarted':
          this.statusText.setText('');
          this.roundText.setText(t('hud.turn', { n: e.turn }));
          break;
        case 'Fall':
          await this.wrestlerOf(e.side).fall();
          await banner(this, t('fx.fall'), '', C.danger, 500);
          break;
        case 'MatchEnded':
          await banner(this, e.winner === 'player' ? t('fx.youWin') : t('fx.youLose'), '', e.winner === 'player' ? C.gold : C.danger, 1100);
          break;
        case 'Shuffled':
        case 'CardDrawn':
        case 'CardExhausted':
          break;
      }
    }
  }

  private async finish(): Promise<void> {
    await wait(this, 200);
    const run = session.finishMatch();
    this.scene.start(run.status === 'reward' ? 'Reward' : 'RunEnd');
  }
}
