import { describe, expect, it } from 'vitest';
import {
  combineSelection,
  frameContains,
  framesIntersect,
  marqueeFrame,
  selectInMarquee,
  toggleSelection,
} from '../src';
import type { Frame } from '../src';

const box: Frame = { x: 100, y: 100, width: 100, height: 100, rotation: 0 };

describe('marqueeFrame', () => {
  it('normalizes any drag direction', () => {
    expect(marqueeFrame({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 60,
      rotation: 0,
    });
  });
});

describe('framesIntersect', () => {
  it('detects overlap and separation', () => {
    expect(framesIntersect(box, { ...box, x: 150, y: 150 })).toBe(true);
    expect(framesIntersect(box, { ...box, x: 201 })).toBe(false);
  });

  it('uses the rotated shape, not its bounding box', () => {
    const diamond: Frame = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
    const corner: Frame = { x: 95, y: -5, width: 20, height: 20, rotation: 0 };
    expect(framesIntersect(diamond, corner)).toBe(false);
    expect(framesIntersect(diamond, { ...corner, x: 70, y: 10 })).toBe(true);
  });
});

describe('frameContains', () => {
  it('requires every corner inside', () => {
    const marquee: Frame = { x: 0, y: 0, width: 300, height: 300, rotation: 0 };
    expect(frameContains(marquee, box)).toBe(true);
    expect(frameContains(marquee, { ...box, x: 250 })).toBe(false);
  });
});

describe('selectInMarquee', () => {
  const items = [
    { id: 'a', frame: box },
    { id: 'b', frame: { ...box, x: 400 } },
    { id: 'c', frame: { ...box, x: 250 } },
  ];
  const marquee: Frame = { x: 90, y: 90, width: 200, height: 200, rotation: 0 };

  it('selects touched items in intersect mode', () => {
    const ids = selectInMarquee(items, marquee, item => item.frame).map(item => item.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('selects only fully contained items in contain mode', () => {
    const ids = selectInMarquee(items, marquee, item => item.frame, 'contain').map(item => item.id);
    expect(ids).toEqual(['a']);
  });
});

describe('frameContains with a rotated outer frame', () => {
  const diamond: Frame = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };

  it('tests against the rotated shape', () => {
    expect(frameContains(diamond, { x: 45, y: 45, width: 10, height: 10, rotation: 0 })).toBe(true);
    expect(frameContains(diamond, { x: 0, y: 0, width: 10, height: 10, rotation: 0 })).toBe(false);
  });
});

describe('combineSelection', () => {
  const base = ['a', 'b'];

  it('replaces by default', () => {
    expect(combineSelection(base, ['c'])).toEqual(['c']);
  });

  it('adds with shift without duplicating', () => {
    expect(combineSelection(base, ['b', 'c'], { shift: true })).toEqual(['a', 'b', 'c']);
  });

  it('subtracts with alt', () => {
    expect(combineSelection(base, ['b', 'c'], { alt: true })).toEqual(['a']);
  });
});

describe('toggleSelection', () => {
  it('adds and removes an id', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
  });
});
