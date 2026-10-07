import { HANDLE_DIRECTION, aabb } from './geometry';
import type { Frame, Guide, Point, SnapContext, Snapper, SnapResult } from './types';

export function runSnappers(
  frame: Frame,
  snappers: Snapper | Snapper[] | undefined,
  ctx: SnapContext
): SnapResult {
  if (!snappers) return { frame, guides: [] };
  const list = Array.isArray(snappers) ? snappers : [snappers];
  let current = frame;
  const guides: Guide[] = [];
  for (const snapper of list) {
    const result = snapper(current, ctx);
    if (result) {
      current = result.frame;
      guides.push(...result.guides);
    }
  }
  return { frame: current, guides };
}

function roundTo(value: number, size: number): number {
  return Math.round(value / size) * size;
}

export function snapToGrid(size: number | Point): Snapper {
  const grid = typeof size === 'number' ? { x: size, y: size } : size;
  return (candidate, ctx) => {
    if (ctx.kind === 'move') {
      return {
        frame: { ...candidate, x: roundTo(candidate.x, grid.x), y: roundTo(candidate.y, grid.y) },
        guides: [],
      };
    }
    if (ctx.kind === 'resize') {
      return {
        frame: {
          ...candidate,
          width: Math.max(grid.x, roundTo(candidate.width, grid.x)),
          height: Math.max(grid.y, roundTo(candidate.height, grid.y)),
        },
        guides: [],
      };
    }
    return null;
  };
}

export type SnapToFramesOptions = { edges?: boolean; centers?: boolean };

type Target = { position: number; from: number; to: number };

function collectTargets(frames: Frame[], options: SnapToFramesOptions) {
  const { edges = true, centers = true } = options;
  const x: Target[] = [];
  const y: Target[] = [];
  for (const frame of frames) {
    const box = aabb(frame);
    const xs = [];
    const ys = [];
    if (edges) {
      xs.push(box.x, box.x + box.width);
      ys.push(box.y, box.y + box.height);
    }
    if (centers) {
      xs.push(box.x + box.width / 2);
      ys.push(box.y + box.height / 2);
    }
    for (const position of xs) x.push({ position, from: box.y, to: box.y + box.height });
    for (const position of ys) y.push({ position, from: box.x, to: box.x + box.width });
  }
  return { x, y };
}

function nearest(
  sources: number[],
  targets: Target[],
  threshold: number
): { offset: number; target: Target } | null {
  let best: { offset: number; target: Target } | null = null;
  for (const source of sources) {
    for (const target of targets) {
      const offset = target.position - source;
      if (Math.abs(offset) > threshold) continue;
      if (!best || Math.abs(offset) < Math.abs(best.offset)) best = { offset, target };
    }
  }
  return best;
}

function guideFor(axis: 'x' | 'y', target: Target, spanFrom: number, spanTo: number): Guide {
  return {
    axis,
    position: target.position,
    from: Math.min(target.from, spanFrom),
    to: Math.max(target.to, spanTo),
  };
}

export function snapToFrames(frames: Frame[], options: SnapToFramesOptions = {}): Snapper {
  const targets = collectTargets(frames, options);
  return (candidate, ctx) => {
    if (ctx.source === 'keyboard') return null;
    if (ctx.kind === 'move') {
      const box = aabb(candidate);
      const snapX = nearest(
        [box.x, box.x + box.width / 2, box.x + box.width],
        targets.x,
        ctx.threshold
      );
      const snapY = nearest(
        [box.y, box.y + box.height / 2, box.y + box.height],
        targets.y,
        ctx.threshold
      );
      if (!snapX && !snapY) return null;
      const dx = snapX?.offset ?? 0;
      const dy = snapY?.offset ?? 0;
      const moved = { x: box.x + dx, y: box.y + dy, w: box.width, h: box.height };
      const guides: Guide[] = [];
      if (snapX) guides.push(guideFor('x', snapX.target, moved.y, moved.y + moved.h));
      if (snapY) guides.push(guideFor('y', snapY.target, moved.x, moved.x + moved.w));
      return { frame: { ...candidate, x: candidate.x + dx, y: candidate.y + dy }, guides };
    }
    if (
      ctx.kind === 'resize' &&
      ctx.handle &&
      candidate.rotation === 0 &&
      !ctx.modifiers?.alt &&
      !ctx.modifiers?.shift
    ) {
      const [hx, hy] = HANDLE_DIRECTION[ctx.handle];
      const right = candidate.x + candidate.width;
      const bottom = candidate.y + candidate.height;
      const snapX =
        hx === 0 ? null : nearest([hx > 0 ? right : candidate.x], targets.x, ctx.threshold);
      const snapY =
        hy === 0 ? null : nearest([hy > 0 ? bottom : candidate.y], targets.y, ctx.threshold);
      if (!snapX && !snapY) return null;
      const next = { ...candidate };
      if (snapX) {
        if (hx > 0) next.width = candidate.width + snapX.offset;
        else {
          next.x = candidate.x + snapX.offset;
          next.width = candidate.width - snapX.offset;
        }
      }
      if (snapY) {
        if (hy > 0) next.height = candidate.height + snapY.offset;
        else {
          next.y = candidate.y + snapY.offset;
          next.height = candidate.height - snapY.offset;
        }
      }
      if (next.width <= 0 || next.height <= 0) return null;
      const guides: Guide[] = [];
      if (snapX) guides.push(guideFor('x', snapX.target, next.y, next.y + next.height));
      if (snapY) guides.push(guideFor('y', snapY.target, next.x, next.x + next.width));
      return { frame: next, guides };
    }
    return null;
  };
}
