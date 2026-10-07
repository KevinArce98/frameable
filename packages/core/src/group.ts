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
  const rotationDelta = to.rotation - from.rotation;
  return members.map(member => {
    const local = surfaceToLocal(from, center(member));
    const nextCenter = localToSurface(to, { x: local.x * scaleX, y: local.y * scaleY });
    const relative = (member.rotation - from.rotation) * DEG;
    const cos = Math.cos(relative);
    const sin = Math.sin(relative);
    const width = member.width * Math.hypot(scaleX * cos, scaleY * sin);
    const height = member.height * Math.hypot(scaleX * sin, scaleY * cos);
    return {
      x: nextCenter.x - width / 2,
      y: nextCenter.y - height / 2,
      width,
      height,
      rotation: normalizeAngle(member.rotation + rotationDelta),
    };
  });
}
