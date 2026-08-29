import { describe, expect, it } from 'vitest';
import {
  applyBasisPoints,
  assertMinor,
  formatMinor,
  MoneyError,
  rupeesToMinor,
  sumMinor,
} from './money';
import { bboxToPolygon, haversineKm, point } from './geo';
import { slugify, uniqueSlug } from './slug';
import { assertNoOperatorKeys, escapeRegExp, normaliseText, UnsafeKeyError } from './sanitize';
import { buildPageInfo, toSkipLimit } from './pagination';
import { bookingCode, deterministicObjectId, sha256 } from './ids';
import { clamp01, jaccard } from './number';

describe('money', () => {
  it('rejects floats and negatives', () => {
    expect(() => assertMinor(99.5)).toThrow(MoneyError);
    expect(() => assertMinor(-1)).toThrow(MoneyError);
  });

  it('converts rupees to paise without float drift', () => {
    expect(rupeesToMinor(999.5)).toBe(99950);
    expect(rupeesToMinor(0.1 + 0.2)).toBe(30);
  });

  it('applies basis points as integers', () => {
    expect(applyBasisPoints(100000, 1500)).toBe(15000);
    expect(Number.isInteger(applyBasisPoints(99999, 1234))).toBe(true);
  });

  it('sums and formats', () => {
    expect(sumMinor(100, 250, 1)).toBe(351);
    expect(formatMinor(99950)).toContain('999');
  });
});

describe('geo', () => {
  it('builds GeoJSON points with longitude first', () => {
    const p = point(77.5946, 12.9716);
    expect(p.coordinates[0]).toBe(77.5946);
    expect(p.coordinates[1]).toBe(12.9716);
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => point(200, 0)).toThrow();
    expect(() => point(0, 100)).toThrow();
  });

  it('measures a known distance (Bengaluru to Mysuru is about 130 km)', () => {
    const km = haversineKm(point(77.5946, 12.9716), point(76.6394, 12.2958));
    expect(km).toBeGreaterThan(120);
    expect(km).toBeLessThan(145);
  });

  it('closes bounding-box polygons', () => {
    const poly = bboxToPolygon({ west: 77, south: 12, east: 78, north: 13 });
    const ring = poly.coordinates[0] as number[][];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

describe('slug', () => {
  it('normalises Indian place names', () => {
    expect(slugify('Dudhsagar Falls, Goa')).toBe('dudhsagar-falls-goa');
    expect(slugify('  Bandaje Arbi  ')).toBe('bandaje-arbi');
    expect(uniqueSlug('Hampi', 'a1b2')).toBe('hampi-a1b2');
  });
});

describe('sanitize', () => {
  it('rejects Mongo operator keys anywhere in the payload', () => {
    expect(() => assertNoOperatorKeys({ email: { $ne: null } })).toThrow(UnsafeKeyError);
    expect(() => assertNoOperatorKeys({ a: [{ 'b.c': 1 }] })).toThrow(UnsafeKeyError);
    expect(() => assertNoOperatorKeys({ ok: 'value', nested: { fine: 1 } })).not.toThrow();
  });

  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
  });

  it('strips control characters', () => {
    expect(normaliseText('hello\u0000 world\u001f')).toBe('hello world');
  });
});

describe('pagination', () => {
  it('caps page size and computes page info', () => {
    expect(toSkipLimit(3, 1000).limit).toBe(100);
    expect(toSkipLimit(3, 20)).toEqual({ skip: 40, limit: 20 });
    expect(buildPageInfo(2, 20, 45)).toMatchObject({ totalPages: 3, hasNext: true });
    expect(buildPageInfo(3, 20, 45).hasNext).toBe(false);
  });
});

describe('ids', () => {
  it('produces deterministic 24-hex ids for seeding', () => {
    const a = deterministicObjectId('ns', 'hampi');
    expect(a).toHaveLength(24);
    expect(a).toBe(deterministicObjectId('ns', 'hampi'));
    expect(a).not.toBe(deterministicObjectId('ns', 'gokarna'));
  });

  it('hashes and generates booking codes', () => {
    expect(sha256('x')).toHaveLength(64);
    expect(bookingCode()).toMatch(/^ANV-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

describe('number helpers', () => {
  it('clamps and computes jaccard similarity', () => {
    expect(clamp01(5)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(jaccard(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3, 5);
    expect(jaccard([], ['a'])).toBe(0);
  });
});
