import { describe, expect, it } from 'vitest';
import {
  fromViewport,
  identity,
  invert,
  multiply,
  rotationMatrix,
  runSnappers,
  screenDeltaToSurface,
  screenToSurface,
  snapToGrid,
  surfaceToScreen,
  toStyle,
} from '../src';

describe('viewport matrices', () => {
  it('maps surface to screen with pan and zoom', () => {
    const m = fromViewport({ zoom: 2, pan: { x: 10, y: 20 } });
    expect(surfaceToScreen({ x: 5, y: 5 }, m)).toEqual({ x: 20, y: 30 });
    expect(screenToSurface({ x: 20, y: 30 }, m)).toEqual({ x: 5, y: 5 });
  });

  it('scales pointer deltas without translation', () => {
    const m = fromViewport({ zoom: 2, pan: { x: 500, y: 500 } });
    expect(screenDeltaToSurface({ x: 10, y: -4 }, m)).toEqual({ x: 5, y: -2 });
  });

  it('composes an outer css scale with an inner viewport', () => {
    const outer = { a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 100 };
    const m = multiply(outer, fromViewport({ zoom: 2, pan: { x: 10, y: 0 } }));
    expect(surfaceToScreen({ x: 0, y: 0 }, m)).toEqual({ x: 105, y: 100 });
    expect(surfaceToScreen({ x: 10, y: 10 }, m)).toEqual({ x: 115, y: 110 });
  });

  it('inverts rotation', () => {
    const m = multiply(rotationMatrix(30), identity);
    const p = surfaceToScreen({ x: 3, y: 4 }, m);
    const back = screenToSurface(p, m);
    expect(back.x).toBeCloseTo(3);
    expect(back.y).toBeCloseTo(4);
    expect(() => invert({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 })).toThrow();
  });
});

describe('snapping', () => {
  const frame = { x: 13, y: 22, width: 101, height: 47, rotation: 0 };

  it('snaps position on move and size on resize', () => {
    const moved = runSnappers(frame, snapToGrid(8), { kind: 'move', threshold: 4 });
    expect(moved.frame).toEqual({ ...frame, x: 16, y: 24 });
    const resized = runSnappers(frame, [snapToGrid(8)], {
      kind: 'resize',
      handle: 'se',
      threshold: 4,
    });
    expect(resized.frame).toEqual({ ...frame, width: 104, height: 48 });
  });

  it('does nothing for rotation and without snappers', () => {
    expect(runSnappers(frame, snapToGrid(8), { kind: 'rotate', threshold: 4 }).frame).toEqual(
      frame
    );
    expect(runSnappers(frame, undefined, { kind: 'move', threshold: 4 }).frame).toBe(frame);
  });
});

describe('styles', () => {
  it('produces absolute positioning with rotation', () => {
    expect(toStyle({ x: 1, y: 2, width: 3, height: 4, rotation: 0 }).transform).toBe('none');
    expect(toStyle({ x: 1, y: 2, width: 3, height: 4, rotation: 15 }).transform).toBe(
      'rotate(15deg)'
    );
  });
});
