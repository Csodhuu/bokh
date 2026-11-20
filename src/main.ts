import Phaser from 'phaser';
import { installDebugOverlay } from './debug';
import { getLang, setLang } from './i18n';
import { MatchScene } from './scenes/MatchScene';
import { MenuScene } from './scenes/MenuScene';
import { RewardScene } from './scenes/RewardScene';
import { RunEndScene } from './scenes/RunEndScene';
import { DEBUG, session } from './session';
import { C, H, W } from './ui/theme';

setLang(getLang());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: C.bg,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  input: { activePointers: 2 },
  scene: [MenuScene, MatchScene, RewardScene, RunEndScene],
});

if (DEBUG) {
  installDebugOverlay(game);
  Object.assign(window, { game, session });
}
