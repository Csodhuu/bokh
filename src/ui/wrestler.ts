import Phaser from 'phaser';
import { C } from './theme';

/**
 * A simple wrestler drawn from shapes: gutal boots, shuudag shorts, open
 * zodog vest. Origin is between the feet; `facing` 1 = faces right.
 */
export class Wrestler {
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private ratio = 1;
  private fallen = false;
  private phase = Math.random() * 10;
  /** Extra pose rotation/offset layered on top of the idle wobble. */
  private pose = { rot: 0 };

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    readonly facing: 1 | -1,
    color: number,
  ) {
    const g = scene.add.graphics();
    // boots (gutal) with upturned toes
    g.fillStyle(C.boot);
    g.fillRect(-36, -42, 26, 42);
    g.fillRect(10, -42, 26, 42);
    g.fillTriangle(-10, -12, -2, -22, -10, 0);
    g.fillTriangle(36, -12, 44, -22, 36, 0);
    // legs
    g.fillStyle(C.skin);
    g.fillRect(-32, -104, 20, 64);
    g.fillRect(12, -104, 20, 64);
    // shorts (shuudag)
    g.fillStyle(color);
    g.fillRoundedRect(-38, -128, 76, 32, 6);
    // torso (bare chest)
    g.fillStyle(C.skin);
    g.fillRoundedRect(-30, -206, 60, 84, 14);
    // zodog: back panel and shoulders
    g.fillStyle(color);
    g.fillRoundedRect(-36, -212, 30, 72, 8);
    g.fillRoundedRect(-24, -214, 48, 16, 6);
    // arms reaching forward
    g.lineStyle(18, color);
    g.lineBetween(10, -196, 56, -170);
    g.lineBetween(56, -170, 84, -150);
    g.fillStyle(C.skin);
    g.fillCircle(88, -148, 10);
    // head
    g.fillStyle(C.skin);
    g.fillCircle(6, -232, 22);
    g.fillStyle(0x1a1a1a);
    g.slice(6, -232, 22, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
    g.fillPath();
    g.fillStyle(0x1a1a1a);
    g.fillCircle(18, -234, 3);

    this.body = scene.add.container(0, 0, [g]);
    this.body.setScale(facing, 1);
    this.container = scene.add.container(x, y, [this.body]);
  }

  setBalanceRatio(r: number): void {
    this.ratio = Phaser.Math.Clamp(r, 0, 1);
  }

  /** Called every frame: lean back and wobble more as balance drops. */
  update(time: number): void {
    if (this.fallen) return;
    const loss = 1 - this.ratio;
    const lean = loss * 0.32;
    const amp = 0.012 + loss * loss * 0.12;
    const speed = 0.002 + loss * 0.004;
    const wobble = Math.sin(time * speed + this.phase) * amp;
    this.body.rotation = -this.facing * lean + wobble + this.pose.rot;
  }

  moveTo(x: number): void {
    this.scene.tweens.add({ targets: this.container, x, duration: 300, ease: 'Cubic.easeOut' });
  }

  lunge(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x + this.facing * 60,
        duration: 140,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  hit(): void {
    this.scene.tweens.add({
      targets: this.body,
      x: -this.facing * 18,
      duration: 80,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.body.setX(0),
    });
  }

  brace(): void {
    this.scene.tweens.add({ targets: this.body, scaleY: 0.9, duration: 150, yoyo: true });
  }

  palmTouch(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this.body, y: 20, duration: 260, yoyo: true, hold: 500 });
      this.scene.tweens.add({
        targets: this.pose,
        rot: -this.facing * 0.8,
        duration: 260,
        yoyo: true,
        hold: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  fall(): Promise<void> {
    this.fallen = true;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.body,
        rotation: -this.facing * 1.5,
        duration: 600,
        ease: 'Bounce.easeOut',
        onComplete: () => resolve(),
      });
    });
  }
}
