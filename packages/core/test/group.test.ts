import { describe, expect, it } from 'vitest';
import { applyToGroup, center, groupBounds, localToSurface, surfaceToLocal } from '../src';
import type { Frame } from '../src';

const a: Frame = { x: 0, y: 0, width: 100, height: 50, rotation: 0 };
const b: Frame = { x: 200, y: 100, width: 60, height: 80, rotation: 0 };

describe('groupBounds', () => {
  it('returns null for no frames', () => {
    expect(groupBounds([])).toBeNull();
  });

  it('wraps unrotated members', () => {
    expect(groupBounds([a, b])).toEqual({ x: 0, y: 0, width: 260, height: 180, rotation: 0 });
  });

  it('wraps the rotated extent of a member', () => {
    const square: Frame = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
    const bounds = groupBounds([square])!;
    expect(bounds.width).toBeCloseTo(100 * Math.SQRT2, 9);
    expect(bounds.height).toBeCloseTo(100 * Math.SQRT2, 9);
    expect(center(bounds).x).toBeCloseTo(50, 9);
  });
});

describe('applyToGroup', () => {
  const group = groupBounds([a, b])!;

  it('returns members unchanged for an identity transform', () => {
    const next = applyToGroup([a, b], group, group);
    next.forEach((frame, index) => {
      const original = [a, b][index]!;
      expect(frame.x).toBeCloseTo(original.x, 9);
      expect(frame.y).toBeCloseTo(original.y, 9);
      expect(frame.width).toBeCloseTo(original.width, 9);
      expect(frame.height).toBeCloseTo(original.height, 9);
      expect(frame.rotation).toBeCloseTo(0, 9);
    });
  });

  it('translates every member by the same offset', () => {
    const next = applyToGroup([a, b], group, { ...group, x: group.x + 30, y: group.y - 10 });
    expect(next[0]).toMatchObject({ x: 30, y: -10, width: 100, height: 50 });
    expect(next[1]).toMatchObject({ x: 230, y: 90, width: 60, height: 80 });
  });

  it('scales positions and sizes with the group', () => {
    const next = applyToGroup([a, b], group, {
      ...group,
      width: group.width * 2,
      height: group.height * 2,
    });
    expect(next[0]).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
    expect(next[1]).toMatchObject({ x: 400, y: 200, width: 120, height: 160 });
  });

  it('rotates every member around the group center', () => {
    const next = applyToGroup([a, b], group, { ...group, rotation: 90 });
    const pivot = center(group);
    next.forEach((frame, index) => {
      const original = [a, b][index]!;
      expect(frame.rotation).toBeCloseTo(90, 9);
      const expected = localToSurface(
        { ...group, rotation: 90 },
        { x: center(original).x - pivot.x, y: center(original).y - pivot.y }
      );
      expect(center(frame).x).toBeCloseTo(expected.x, 9);
      expect(center(frame).y).toBeCloseTo(expected.y, 9);
    });
  });

  it('swaps member dimensions under non-uniform scale when the member is turned 90 degrees', () => {
    const turned: Frame = { x: 0, y: 0, width: 100, height: 40, rotation: 90 };
    const bounds = { x: -20, y: -30, width: 140, height: 100, rotation: 0 };
    const [next] = applyToGroup([turned], bounds, { ...bounds, width: 280 });
    expect(next!.width).toBeCloseTo(100, 9);
    expect(next!.height).toBeCloseTo(80, 9);
  });
});

describe('oriented group bounds', () => {
  it('matches the unrotated bounds at rotation 0', () => {
    expect(groupBounds([a, b], 0)).toEqual(groupBounds([a, b]));
  });

  it('wraps members tightly along the rotated axes', () => {
    const turned: Frame = { x: 0, y: 0, width: 100, height: 40, rotation: 30 };
    const bounds = groupBounds([turned], 30)!;
    expect(bounds.rotation).toBe(30);
    expect(bounds.width).toBeCloseTo(100, 9);
    expect(bounds.height).toBeCloseTo(40, 9);
    expect(center(bounds).x).toBeCloseTo(center(turned).x, 9);
    expect(center(bounds).y).toBeCloseTo(center(turned).y, 9);
  });

  it('keeps the pivot stable across repeated rotations', () => {
    let members = [a, b];
    let rotation = 0;
    const pivot = center(groupBounds(members, rotation)!);
    for (let step = 0; step < 4; step += 1) {
      const from = groupBounds(members, rotation)!;
      const to = { ...from, rotation: rotation + 15 };
      members = applyToGroup(members, from, to);
      rotation += 15;
      const next = center(groupBounds(members, rotation)!);
      expect(next.x).toBeCloseTo(pivot.x, 6);
      expect(next.y).toBeCloseTo(pivot.y, 6);
    }
  });
});

describe('applyToGroup with a rotated group', () => {
  const rotation = 30;
  const group = groupBounds([a, b], rotation)!;

  it('translates members along surface axes', () => {
    const next = applyToGroup([a, b], group, { ...group, x: group.x + 10, y: group.y - 5 });
    expect(center(next[0]!).x).toBeCloseTo(center(a).x + 10, 9);
    expect(center(next[0]!).y).toBeCloseTo(center(a).y - 5, 9);
  });

  it('scales member positions along the group axes', () => {
    const to = { ...group, width: group.width * 2 };
    const next = applyToGroup([a, b], group, to);
    const local = surfaceToLocal(group, center(a));
    const expected = localToSurface(to, { x: local.x * 2, y: local.y });
    expect(center(next[0]!).x).toBeCloseTo(expected.x, 9);
    expect(center(next[0]!).y).toBeCloseTo(expected.y, 9);
  });

  it('returns the original members untouched when nothing changes', () => {
    const next = applyToGroup([a, b], group, { ...group });
    expect(next[0]).toBe(a);
    expect(next[1]).toBe(b);
  });
});
