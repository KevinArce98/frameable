import { describe, expect, it } from 'vitest';
import { satisfiesConstraints, snapToFrames } from '../src';
import type { Frame, SnapContext } from '../src';

const other: Frame = { x: 200, y: 100, width: 100, height: 100, rotation: 0 };
const moveCtx: SnapContext = { kind: 'move', threshold: 4 };

describe('snapToFrames on move', () => {
  const snap = snapToFrames([other]);

  it('snaps the left edge to a target edge and reports a guide', () => {
    const candidate: Frame = { x: 197, y: 400, width: 50, height: 50, rotation: 0 };
    const result = snap(candidate, moveCtx)!;
    expect(result.frame.x).toBe(200);
    expect(result.frame.y).toBe(400);
    expect(result.guides).toEqual([{ axis: 'x', position: 200, from: 100, to: 450 }]);
  });

  it('snaps centers to centers', () => {
    const candidate: Frame = { x: 224, y: 400, width: 50, height: 50, rotation: 0 };
    expect(snap(candidate, moveCtx)!.frame.x).toBe(225);
  });

  it('snaps both axes independently', () => {
    const candidate: Frame = { x: 198, y: 203, width: 50, height: 50, rotation: 0 };
    const result = snap(candidate, moveCtx)!;
    expect(result.frame).toMatchObject({ x: 200, y: 200 });
    expect(result.guides).toHaveLength(2);
  });

  it('passes through outside the threshold', () => {
    expect(snap({ x: 0, y: 0, width: 50, height: 50, rotation: 0 }, moveCtx)).toBeNull();
  });

  it('can restrict targets to edges only', () => {
    const edgesOnly = snapToFrames([other], { centers: false });
    expect(edgesOnly({ x: 224, y: 400, width: 50, height: 50, rotation: 0 }, moveCtx)).toBeNull();
  });
});

describe('snapToFrames guides', () => {
  it('spans every frame aligned at the snapped position', () => {
    const above: Frame = { x: 200, y: 0, width: 40, height: 30, rotation: 0 };
    const snap = snapToFrames([other, above]);
    const candidate: Frame = { x: 198, y: 400, width: 50, height: 50, rotation: 0 };
    const result = snap(candidate, moveCtx)!;
    expect(result.guides).toEqual([{ axis: 'x', position: 200, from: 0, to: 450 }]);
  });
});

describe('snapToFrames on resize', () => {
  const snap = snapToFrames([other]);

  it('moves only the dragged edge', () => {
    const candidate: Frame = { x: 20, y: 120, width: 177, height: 40, rotation: 0 };
    const result = snap(candidate, { kind: 'resize', handle: 'e', threshold: 4 })!;
    expect(result.frame).toMatchObject({ x: 20, width: 180, height: 40 });
  });

  it('adjusts origin when snapping a west edge', () => {
    const candidate: Frame = { x: 303, y: 120, width: 100, height: 40, rotation: 0 };
    const result = snap(candidate, { kind: 'resize', handle: 'w', threshold: 4 })!;
    expect(result.frame).toMatchObject({ x: 300, width: 103 });
  });

  it('ignores rotated frames and rotation', () => {
    const rotated: Frame = { x: 20, y: 120, width: 177, height: 40, rotation: 10 };
    expect(snap(rotated, { kind: 'resize', handle: 'e', threshold: 4 })).toBeNull();
    expect(snap(other, { kind: 'rotate', threshold: 4 })).toBeNull();
  });
});

describe('snapToFrames modifiers and source', () => {
  const snap = snapToFrames([other]);

  it('does not snap keyboard transactions', () => {
    const candidate: Frame = { x: 197, y: 400, width: 50, height: 50, rotation: 0 };
    expect(snap(candidate, { ...moveCtx, source: 'keyboard' })).toBeNull();
  });

  it('does not snap a resize that scales from the center or keeps the ratio', () => {
    const candidate: Frame = { x: 20, y: 120, width: 177, height: 40, rotation: 0 };
    const ctx: SnapContext = { kind: 'resize', handle: 'e', threshold: 4 };
    expect(
      snap(candidate, { ...ctx, modifiers: { shift: false, alt: true, meta: false, ctrl: false } })
    ).toBeNull();
    expect(
      snap(candidate, { ...ctx, modifiers: { shift: true, alt: false, meta: false, ctrl: false } })
    ).toBeNull();
  });
});

describe('satisfiesConstraints', () => {
  const frame: Frame = { x: 0, y: 0, width: 100, height: 50, rotation: 0 };

  it('checks size limits', () => {
    expect(satisfiesConstraints(frame, { minWidth: 120 })).toBe(false);
    expect(satisfiesConstraints(frame, { minWidth: 100, maxHeight: 50 })).toBe(true);
  });

  it('checks bounds and a locked ratio', () => {
    expect(
      satisfiesConstraints(frame, { bounds: { x: 0, y: 0, width: 80, height: 80, rotation: 0 } })
    ).toBe(false);
    expect(satisfiesConstraints(frame, undefined, 2)).toBe(true);
    expect(satisfiesConstraints(frame, undefined, 1)).toBe(false);
  });
});
