export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

export function isPast(date: Date, now = new Date()): boolean {
  return date.getTime() < now.getTime();
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

/** Exponential decay in [0,1]; 1 when fresh, 0.5 after one half-life. */
export function decay(ageDays: number, halfLifeDays: number): number {
  if (halfLifeDays <= 0) return 0;
  const clamped = Math.max(0, ageDays);
  return Math.pow(0.5, clamped / halfLifeDays);
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function toIsoDateString(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 10);
}
