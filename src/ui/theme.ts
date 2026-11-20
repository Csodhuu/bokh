import type Phaser from 'phaser';

export const W = 1280;
export const H = 720;

export const C = {
  bg: 0x1b1410,
  panel: 0x2a2019,
  panelLight: 0x3a2d22,
  cream: 0xf3e6c8,
  gold: 0xe0b24f,
  red: 0xc0392b,
  blue: 0x2f6db5,
  green: 0x5e8c3e,
  ground: 0x4a6b33,
  grey: 0x6b6259,
  danger: 0xe2553f,
  guard: 0x5aa9e6,
  energy: 0xf2c94c,
  skin: 0xd9a066,
  boot: 0x5a3a22,
  black: 0x000000,
} as const;

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';

export function textStyle(
  size: number,
  color: number = C.cream,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: hex(color),
    resolution: Math.min(3, Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio : 2)),
    ...extra,
  };
}
