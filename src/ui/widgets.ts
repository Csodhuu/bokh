import Phaser from 'phaser';
import { C, textStyle } from './theme';

export interface Button {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setEnabled(enabled: boolean): void;
  setText(text: string): void;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onClick: () => void,
  opts: { fill?: number; textColor?: number; fontSize?: number } = {},
): Button {
  const fill = opts.fill ?? C.gold;
  const bg = scene.add.rectangle(0, 0, w, h, fill).setRounded(14).setStrokeStyle(3, C.black, 0.35);
  const label = scene.add
    .text(0, 0, text, textStyle(opts.fontSize ?? 26, opts.textColor ?? C.bg, { fontStyle: 'bold', align: 'center' }))
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, label]);
  let enabled = true;
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', () => {
    if (!enabled) return;
    scene.tweens.add({ targets: container, scale: 0.94, duration: 60, yoyo: true });
    onClick();
  });
  bg.on('pointerover', () => enabled && bg.setFillStyle(Phaser.Display.Color.ValueToColor(fill).lighten(12).color));
  bg.on('pointerout', () => bg.setFillStyle(fill));
  return {
    container,
    bg,
    label,
    setEnabled(e: boolean) {
      enabled = e;
      container.setAlpha(e ? 1 : 0.45);
    },
    setText(s: string) {
      label.setText(s);
    },
  };
}

export interface Bar {
  container: Phaser.GameObjects.Container;
  set(value: number, max: number, animate?: boolean): void;
}

export function makeBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): Bar {
  const back = scene.add.rectangle(0, 0, w, h, C.black, 0.5).setOrigin(0, 0.5).setStrokeStyle(2, C.cream, 0.4);
  const fill = scene.add.rectangle(2, 0, w - 4, h - 4, color).setOrigin(0, 0.5);
  const label = scene.add.text(w / 2, 0, '', textStyle(Math.round(h * 0.78), C.cream, { fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })).setOrigin(0.5);
  const container = scene.add.container(x, y, [back, fill, label]);
  return {
    container,
    set(value: number, max: number, animate = true) {
      const ratio = Phaser.Math.Clamp(value / max, 0, 1);
      const target = Math.max(0.0001, ratio * (w - 4));
      label.setText(`${Math.max(0, value)} / ${max}`);
      fill.setFillStyle(ratio <= 0.3 ? C.danger : color);
      if (animate) scene.tweens.add({ targets: fill, width: target, duration: 260, ease: 'Cubic.easeOut' });
      else fill.width = target;
    },
  };
}

/** Floating text that rises and fades. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: number, size = 34): void {
  const tx = scene.add
    .text(x, y, text, textStyle(size, color, { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }))
    .setOrigin(0.5)
    .setDepth(50);
  scene.tweens.add({ targets: tx, y: y - 70, alpha: 0, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => tx.destroy() });
}

/** Big centered banner. Resolves when it has faded out. */
export function banner(
  scene: Phaser.Scene,
  title: string,
  sub = '',
  color: number = C.gold,
  hold = 900,
): Promise<void> {
  return new Promise((resolve) => {
    const bg = scene.add.rectangle(640, 300, 1280, sub ? 150 : 110, C.black, 0.7);
    const t1 = scene.add
      .text(640, sub ? 280 : 300, title, textStyle(52, color, { fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }))
      .setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [bg, t1];
    if (sub) items.push(scene.add.text(640, 335, sub, textStyle(26, C.cream)).setOrigin(0.5));
    const c = scene.add.container(0, 0, items).setDepth(100).setAlpha(0);
    t1.setScale(0.6);
    scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
    scene.tweens.add({ targets: t1, scale: 1, duration: 250, ease: 'Back.easeOut' });
    scene.time.delayedCall(hold, () => {
      scene.tweens.add({
        targets: c,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          c.destroy();
          resolve();
        },
      });
    });
  });
}

export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((r) => scene.time.delayedCall(ms, r));
}
