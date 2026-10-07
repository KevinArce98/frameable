import {
  aabb,
  center,
  corners,
  framesEqual,
  localToSurface,
  normalizeAngle,
  rotatePoint,
  surfaceToLocal,
} from './geometry';
import type { Frame } from './types';

const DEG = Math.PI / 180;

function unrotatedBounds(frames: readonly Frame[]): Frame {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const frame of frames) {
    const box = aabb(frame);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0 };
}

export function groupBounds(frames: readonly Frame[], rotation = 0): Frame | null {
  if (frames.length === 0) return null;
  if (rotation === 0) return unrotatedBounds(frames);
  const origin = { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const frame of frames) {
    for (const corner of corners(frame)) {
      const local = rotatePoint(corner, origin, -rotation);
      minX = Math.min(minX, local.x);
      minY = Math.min(minY, local.y);
      maxX = Math.max(maxX, local.x);
      maxY = Math.max(maxY, local.y);
    }
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const middle = rotatePoint({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, origin, rotation);
  return {
    x: middle.x - width / 2,
    y: middle.y - height / 2,
    width,
    height,
    rotation: normalizeAngle(rotation),
  };
}

export function applyToGroup(members: readonly Frame[], from: Frame, to: Frame): Frame[] {
  if (framesEqual(from, to)) return [...members];
  const scaleX = from.width === 0 ? 1 : to.width / from.width;
  const scaleY = from.height === 0 ? 1 : to.height / from.height;
  return members.map(member => {
    const local = surfaceToLocal(from, center(member));
    const nextCenter = localToSurface(to, { x: local.x * scaleX, y: local.y * scaleY });
    const relative = (member.rotation - from.rotation) * DEG;
    const cos = Math.cos(relative);
    const sin = Math.sin(relative);
    const axisX = { x: scaleX * member.width * cos, y: scaleY * member.width * sin };
    const axisY = { x: -scaleX * member.height * sin, y: scaleY * member.height * cos };
    const width = Math.hypot(axisX.x, axisX.y);
    const area = Math.abs(axisX.x * axisY.y - axisX.y * axisY.x);
    const height = width === 0 ? 0 : area / width;
    const angle = Math.atan2(axisX.y, axisX.x) / DEG;
    return {
      x: nextCenter.x - width / 2,
      y: nextCenter.y - height / 2,
      width,
      height,
      rotation: normalizeAngle(to.rotation + angle),
    };
  });
}

export function groupScaleIsExact(
  members: readonly Frame[],
  group: Frame,
  epsilon = 1e-6
): boolean {
  return members.every(member => {
    const quarterTurns = normalizeAngle(member.rotation - group.rotation) / 90;
    return Math.abs(quarterTurns - Math.round(quarterTurns)) * 90 < epsilon;
  });
}

export function sharedRotation(frames: readonly Frame[], epsilon = 1e-6): number {
  const first = frames[0];
  if (!first) return 0;
  const shared = frames.every(
    frame => Math.abs(normalizeAngle(frame.rotation - first.rotation)) < epsilon
  );
  return shared ? first.rotation : 0;
}
