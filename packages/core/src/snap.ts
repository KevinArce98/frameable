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
