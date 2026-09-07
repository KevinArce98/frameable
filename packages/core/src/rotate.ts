import { center, normalizeAngle, pointerAngle } from './geometry';
import type { Frame, Point } from './types';

export type RotateOptions = { to: number; step?: number };

export function rotate(frame: Frame, options: RotateOptions): Frame {
  let rotation = options.to;
  if (options.step && options.step > 0)
    rotation = Math.round(rotation / options.step) * options.step;
  return { ...frame, rotation: normalizeAngle(rotation) };
}

export function rotationFromPointer(
  initial: Frame,
  start: Point,
  current: Point,
  step?: number
): Frame {
  const origin = center(initial);
  const to = initial.rotation + pointerAngle(origin, current) - pointerAngle(origin, start);
  return rotate(initial, step === undefined ? { to } : { to, step });
}
