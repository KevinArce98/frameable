import { aabb } from './geometry';
import type { Constraints, Frame } from './types';

export function applyBounds(frame: Frame, bounds: Frame | undefined): Frame {
  if (!bounds) return frame;
  const box = aabb(frame);
  let dx = 0;
  let dy = 0;
  if (box.x < bounds.x) dx = bounds.x - box.x;
  else if (box.x + box.width > bounds.x + bounds.width)
    dx = bounds.x + bounds.width - (box.x + box.width);
  if (box.y < bounds.y) dy = bounds.y - box.y;
  else if (box.y + box.height > bounds.y + bounds.height)
    dy = bounds.y + bounds.height - (box.y + box.height);
  if (dx === 0 && dy === 0) return frame;
  return { ...frame, x: frame.x + dx, y: frame.y + dy };
}

export function satisfiesConstraints(
  frame: Frame,
  constraints: Constraints | undefined,
  lockedRatio?: number
): boolean {
  const epsilon = 1e-9;
  if (constraints) {
    if (constraints.minWidth !== undefined && frame.width < constraints.minWidth - epsilon)
      return false;
    if (constraints.minHeight !== undefined && frame.height < constraints.minHeight - epsilon)
      return false;
    if (constraints.maxWidth !== undefined && frame.width > constraints.maxWidth + epsilon)
      return false;
    if (constraints.maxHeight !== undefined && frame.height > constraints.maxHeight + epsilon)
      return false;
    if (constraints.bounds && applyBounds(frame, constraints.bounds) !== frame) return false;
  }
  if (lockedRatio !== undefined && frame.height > 0) {
    const ratio = frame.width / frame.height;
    if (Math.abs(ratio - lockedRatio) > 1e-6 * Math.max(1, lockedRatio)) return false;
  }
  return true;
}
