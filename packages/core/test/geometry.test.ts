import { describe, expect, it } from 'vitest';
import {
  aabb,
  applyBounds,
  corners,
  frameDelta,
  move,
  normalizeAngle,
  pointerAngle,
  rotate,
  rotationFromPointer,
} from '../src';
import type { Frame } from '../src';

const frame: Frame = { x: 0, y: 0, width: 100, height: 50, rotation: 0 };

describe('move', () => {
  it('translates', () => {
    expect(move(frame, { x: 5, y: -3 })).toEqual({ ...frame, x: 5, y: -3 });
  });

  it('locks to the dominant axis', () => {
    expect(move(frame, { x: 5, y: -3 }, { axisLock: true })).toEqual({ ...frame, x: 5 });
    expect(move(frame, { x: 2, y: -3 }, { axisLock: true })).toEqual({ ...frame, y: -3 });
  });
});

describe('angles', () => {
  it('normalizes into (-180, 180]', () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(720)).toBe(0);
  });

  it('measures pointer angle with up as zero', () => {
    const origin = { x: 0, y: 0 };
    expect(pointerAngle(origin, { x: 0, y: -1 })).toBeCloseTo(0);
    expect(pointerAngle(origin, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(pointerAngle(origin, { x: 0, y: 1 })).toBeCloseTo(180);
    expect(pointerAngle(origin, { x: -1, y: 0 })).toBeCloseTo(-90);
  });

  it('rotates with optional step', () => {
    expect(rotate(frame, { to: 47 }).rotation).toBe(47);
    expect(rotate(frame, { to: 47, step: 15 }).rotation).toBe(45);
    expect(rotate(frame, { to: 400 }).rotation).toBe(40);
  });

  it('rotates by the pointer sweep around the center', () => {
    const start = { x: 50, y: -100 };
    const current = { x: 200, y: 25 };
    expect(rotationFromPointer(frame, start, current).rotation).toBeCloseTo(90);
    expect(rotationFromPointer({ ...frame, rotation: 30 }, start, current).rotation).toBeCloseTo(
      120
    );
  });
});

describe('boxes', () => {
  it('returns rotated corners', () => {
    const [nw, ne, se, sw] = corners({ x: 0, y: 0, width: 100, height: 100, rotation: 90 });
    expect(nw.x).toBeCloseTo(100);
    expect(nw.y).toBeCloseTo(0);
    expect(ne.x).toBeCloseTo(100);
    expect(ne.y).toBeCloseTo(100);
    expect(se.x).toBeCloseTo(0);
    expect(se.y).toBeCloseTo(100);
    expect(sw.x).toBeCloseTo(0);
    expect(sw.y).toBeCloseTo(0);
  });

  it('computes the axis-aligned bounding box', () => {
    const box = aabb({ x: 0, y: 0, width: 100, height: 100, rotation: 45 });
    const diagonal = Math.SQRT2 * 100;
    expect(box.width).toBeCloseTo(diagonal);
    expect(box.height).toBeCloseTo(diagonal);
    expect(box.x).toBeCloseTo(50 - diagonal / 2);
  });

  it('keeps the rotated box inside bounds', () => {
    const bounds = { x: 0, y: 0, width: 300, height: 300, rotation: 0 };
    const inside = applyBounds({ x: 10, y: 10, width: 50, height: 50, rotation: 0 }, bounds);
    expect(inside).toEqual({ x: 10, y: 10, width: 50, height: 50, rotation: 0 });
    const pushed = applyBounds({ x: 280, y: -20, width: 50, height: 50, rotation: 0 }, bounds);
    expect(pushed).toEqual({ x: 250, y: 0, width: 50, height: 50, rotation: 0 });
    const rotatedBox = applyBounds({ x: 0, y: 0, width: 100, height: 100, rotation: 45 }, bounds);
    expect(aabb(rotatedBox).x).toBeCloseTo(0);
    expect(aabb(rotatedBox).y).toBeCloseTo(0);
  });

  it('reports deltas between frames', () => {
    expect(frameDelta(frame, { ...frame, x: 3, rotation: 350 })).toEqual({ x: 3, rotation: -10 });
  });
});
