import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  create(): void {
    this.add.text(640, 360, 'Bökh', { fontSize: '64px', color: '#f3e6c8' }).setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1410',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
  scene: [BootScene],
});
