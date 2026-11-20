import Phaser from 'phaser';
import { getLang, setLang, t } from '../i18n';
import { session, VERSION } from '../session';
import { C, H, W, textStyle } from '../ui/theme';
import { makeButton } from '../ui/widgets';
import { Wrestler } from '../ui/wrestler';

export class MenuScene extends Phaser.Scene {
  private wrestlers: Wrestler[] = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    this.wrestlers = [];
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    this.add.rectangle(W / 2, 330, W, 360, 0x2b3a4a, 0.5);
    this.add.ellipse(W / 2, 520, 900, 70, C.ground);

    const a = new Wrestler(this, W / 2 - 130, 515, 1, C.red);
    const b = new Wrestler(this, W / 2 + 130, 515, -1, C.blue);
    a.setBalanceRatio(0.75);
    b.setBalanceRatio(0.65);
    this.wrestlers.push(a, b);

    this.add
      .text(W / 2, 80, t('title'), textStyle(96, C.gold, { fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }))
      .setOrigin(0.5);
    this.add.text(W / 2, 150, t('subtitle'), textStyle(26, C.cream)).setOrigin(0.5);
    this.add.text(W - 16, H - 14, `v${VERSION}`, textStyle(16, C.cream)).setOrigin(1, 1).setAlpha(0.5);

    makeButton(this, W / 2, 600, 300, 76, t('menu.start'), () => {
      session.newRun();
      session.startMatch();
      this.scene.start('Match');
    }, { fontSize: 32 });

    makeButton(this, W / 2 - 330, 600, 240, 60, `? ${t('menu.howTo')}`, () => this.scene.start('Guide', { from: 'Menu' }), {
      fill: C.panelLight,
      textColor: C.cream,
      fontSize: 24,
    });
    makeButton(this, W / 2 + 330, 600, 240, 60, t('menu.language'), () => {
      setLang(getLang() === 'en' ? 'mn' : 'en');
      this.scene.restart();
    }, { fill: C.panelLight, textColor: C.cream, fontSize: 24 });
  }

  update(time: number): void {
    for (const w of this.wrestlers) w.update(time);
  }
}
