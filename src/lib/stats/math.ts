/** Safe division: null when the denominator is 0. */
export function div(a: number, b: number): number | null {
  return b ? a / b : null;
}

/** NFL passer rating. */
export function passerRating(cmp: number, att: number, yds: number, td: number, int: number): number | null {
  if (!att) return null;
  const clamp = (x: number) => Math.max(0, Math.min(2.375, x));
  const a = clamp((cmp / att - 0.3) * 5);
  const b = clamp((yds / att - 3) * 0.25);
  const c = clamp((td / att) * 20);
  const d = clamp(2.375 - (int / att) * 25);
  return ((a + b + c + d) / 6) * 100;
}

/** Sum a set of stat bags into one. */
export function sumInto(target: Record<string, number>, src: Record<string, number>) {
  for (const k in src) target[k] = (target[k] ?? 0) + src[k];
}

/** Weighted mean accumulator for rate stats reported per game. */
export class Weighted {
  private num = 0;
  private den = 0;
  add(value: number | undefined | null, weight: number | undefined | null) {
    if (value === undefined || value === null || !Number.isFinite(value) || !weight) return;
    this.num += value * weight;
    this.den += weight;
  }
  get value(): number | null {
    return this.den ? this.num / this.den : null;
  }
}

export function round(n: number, d = 1) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

/** Sack yardage as a positive number (nflverse stores `sack_yards_lost` as negative). */
export function sackYards(s: Record<string, number | undefined>): number {
  return Math.abs(s.sack_yards_lost ?? 0);
}
