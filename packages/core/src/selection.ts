import { corners, surfaceToLocal } from './geometry';
import type { Frame, Point } from './types';

export type SelectionMode = 'intersect' | 'contain';

export function marqueeFrame(a: Point, b: Point): Frame {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
    rotation: 0,
  };
}

function project(points: Point[], axis: Point): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const value = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

type Quad = ReturnType<typeof corners>;

function edgeNormals([a, b, c]: Quad): Point[] {
  return [
    { x: -(b.y - a.y), y: b.x - a.x },
    { x: -(c.y - b.y), y: c.x - b.x },
  ];
}

export function framesIntersect(a: Frame, b: Frame): boolean {
  const pointsA = corners(a);
  const pointsB = corners(b);
  for (const axis of [...edgeNormals(pointsA), ...edgeNormals(pointsB)]) {
    const [minA, maxA] = project(pointsA, axis);
    const [minB, maxB] = project(pointsB, axis);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

export function frameContains(outer: Frame, inner: Frame): boolean {
  const epsilon = 1e-9;
  return corners(inner).every(point => {
    const local = surfaceToLocal(outer, point);
    return (
      Math.abs(local.x) <= outer.width / 2 + epsilon &&
      Math.abs(local.y) <= outer.height / 2 + epsilon
    );
  });
}

export function selectInMarquee<T>(
  items: readonly T[],
  marquee: Frame,
  getFrame: (item: T) => Frame,
  mode: SelectionMode = 'intersect'
): T[] {
  return items.filter(item => {
    const frame = getFrame(item);
    return mode === 'contain' ? frameContains(marquee, frame) : framesIntersect(marquee, frame);
  });
}

export type SelectionModifiers = { shift?: boolean; alt?: boolean };

export function combineSelection(
  base: readonly string[],
  hits: readonly string[],
  modifiers: SelectionModifiers = {}
): string[] {
  if (modifiers.alt) {
    const removed = new Set(hits);
    return base.filter(id => !removed.has(id));
  }
  if (modifiers.shift) {
    const present = new Set(base);
    return [...base, ...hits.filter(id => !present.has(id))];
  }
  return [...hits];
}

export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
}
