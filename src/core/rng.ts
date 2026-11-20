// Seeded RNG (mulberry32). The RNG state is a plain uint32 stored inside game
// state, so the whole state stays serialisable and runs are reproducible.

/** Returns [float in [0,1), nextRngState]. */
export function nextFloat(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Returns [integer in [0, maxExclusive), nextRngState]. */
export function nextInt(rng: number, maxExclusive: number): [number, number] {
  const [f, next] = nextFloat(rng);
  return [Math.floor(f * maxExclusive), next];
}

/** Fisher–Yates shuffle. Returns [shuffledCopy, nextRngState]. */
export function shuffle<T>(items: readonly T[], rng: number): [T[], number] {
  const out = items.slice();
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, r] = nextInt(r, i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return [out, r];
}

/** Normalises any number/string into a uint32 seed. */
export function toSeed(input: number | string): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input >>> 0;
  const s = String(input).trim();
  if (/^\d+$/.test(s) && Number(s) <= 0xffffffff) return Number(s) >>> 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
