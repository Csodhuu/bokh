import Phaser from 'phaser';
import type { CardDef } from '../core';
import { cardDescription, cardName, gripName, t } from '../i18n';
import { C, hex, textStyle } from './theme';

export const CARD_W = 168;
export const CARD_H = 236;

function cardColor(def: CardDef): number {
  const types = def.effects.map((e) => e.type);
  if (types.includes('damage')) return C.red;
  if (types.includes('reversal') || types.includes('guard')) return C.guard;
  if (types.includes('grip') || types.includes('setGrip')) return C.gold;
  return C.green;
}

/** Draws a card. `blocked` is the reason text when it can't be played. */
export function makeCard(
  scene: Phaser.Scene,
  id: string,
  def: CardDef,
  blocked: string | null,
): Phaser.GameObjects.Container {
  const color = cardColor(def);
  const items: Phaser.GameObjects.GameObject[] = [];

  const shadow = scene.add.rectangle(4, 6, CARD_W, CARD_H, C.black, 0.4).setRounded(14);
  const bg = scene.add.rectangle(0, 0, CARD_W, CARD_H, 0xf1e4c4).setRounded(14).setStrokeStyle(5, color);
  const band = scene.add.rectangle(0, -CARD_H / 2 + 34, CARD_W - 10, 52, color, 0.22);
  items.push(shadow, bg, band);

  const name = scene.add
    .text(10, -CARD_H / 2 + 34, cardName(id), textStyle(20, 0x2a1d12, { fontStyle: 'bold', align: 'center', wordWrap: { width: CARD_W - 52 } }))
    .setOrigin(0.5);
  if (name.height > 50) name.setFontSize(17);
  items.push(name);

  // cost orb
  items.push(scene.add.circle(-CARD_W / 2 + 18, -CARD_H / 2 + 18, 20, C.energy).setStrokeStyle(3, C.bg));
  items.push(scene.add.text(-CARD_W / 2 + 18, -CARD_H / 2 + 18, String(def.cost), textStyle(24, C.bg, { fontStyle: 'bold' })).setOrigin(0.5));

  let y = -CARD_H / 2 + 72;
  if (def.requiresGrip) {
    const req = scene.add
      .text(0, y, t('effect.requires', { grip: gripName(def.requiresGrip) }), textStyle(15, C.cream, { fontStyle: 'bold', backgroundColor: hex(0x6b4a2a), padding: { x: 6, y: 2 } }))
      .setOrigin(0.5, 0);
    items.push(req);
    y += 28;
  }

  const desc = scene.add
    .text(0, y + 4, cardDescription(def).join('\n'), textStyle(18, 0x2a1d12, { align: 'center', wordWrap: { width: CARD_W - 18 }, lineSpacing: 2 }))
    .setOrigin(0.5, 0);
  const maxH = CARD_H / 2 - (y + 4) - 8;
  for (let size = 17; desc.height > maxH && size >= 12; size--) desc.setFontSize(size);
  items.push(desc);

  if (blocked) {
    items.push(scene.add.rectangle(0, 0, CARD_W, CARD_H, C.black, 0.5).setRounded(14));
    items.push(
      scene.add
        .text(0, CARD_H / 2 - 26, blocked, textStyle(16, C.cream, { fontStyle: 'bold', align: 'center', backgroundColor: hex(0x8a2a1d), padding: { x: 6, y: 4 }, wordWrap: { width: CARD_W - 12 } }))
        .setOrigin(0.5),
    );
  }

  const c = scene.add.container(0, 0, items);
  c.setSize(CARD_W, CARD_H);
  return c;
}
