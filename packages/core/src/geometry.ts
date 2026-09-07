import type { Frame, Handle, Point } from './types';

const DEG = Math.PI / 180;

export const HANDLES: readonly Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export const HANDLE_DIRECTION: Record<Handle, readonly [number, number]> = {
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
  nw: [-1, -1],
};

export function center(frame: Frame): Point {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

export function rotatePoint(point: Point, origin: Point, degrees: number): Point {
  const rad = degrees * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

export function rotateVector(vector: Point, degrees: number): Point {
  return rotatePoint(vector, { x: 0, y: 0 }, degrees);
}

export function normalizeAngle(degrees: number): number {
  let angle = degrees % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
}

export function localToSurface(frame: Frame, local: Point): Point {
  const c = center(frame);
  return rotatePoint({ x: c.x + local.x, y: c.y + local.y }, c, frame.rotation);
}

export function surfaceToLocal(frame: Frame, point: Point): Point {
  const c = center(frame);
  const unrotated = rotatePoint(point, c, -frame.rotation);
  return { x: unrotated.x - c.x, y: unrotated.y - c.y };
}

export function handlePosition(frame: Frame, handle: Handle): Point {
  const [hx, hy] = HANDLE_DIRECTION[handle];
  return localToSurface(frame, { x: (hx * frame.width) / 2, y: (hy * frame.height) / 2 });
}

export function corners(frame: Frame): [Point, Point, Point, Point] {
  return [
    handlePosition(frame, 'nw'),
    handlePosition(frame, 'ne'),
    handlePosition(frame, 'se'),
    handlePosition(frame, 'sw'),
  ];
}

export function aabb(frame: Frame): Frame {
  if (frame.rotation === 0) return { ...frame };
  const points = corners(frame);
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    rotation: 0,
  };
}

export function pointerAngle(origin: Point, point: Point): number {
  return normalizeAngle(Math.atan2(point.y - origin.y, point.x - origin.x) / DEG + 90);
}

export function framesEqual(a: Frame, b: Frame, epsilon = 1e-9): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon &&
    Math.abs(normalizeAngle(a.rotation - b.rotation)) < epsilon
  );
}

export function frameDelta(from: Frame, to: Frame): Partial<Frame> {
  const delta: Partial<Frame> = {};
  if (from.x !== to.x) delta.x = to.x - from.x;
  if (from.y !== to.y) delta.y = to.y - from.y;
  if (from.width !== to.width) delta.width = to.width - from.width;
  if (from.height !== to.height) delta.height = to.height - from.height;
  if (from.rotation !== to.rotation) delta.rotation = normalizeAngle(to.rotation - from.rotation);
  return delta;
}
