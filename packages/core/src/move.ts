import type { Frame, Point } from './types';

export type MoveOptions = { axisLock?: boolean };

export function move(frame: Frame, delta: Point, options: MoveOptions = {}): Frame {
  let { x: dx, y: dy } = delta;
  if (options.axisLock) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  return { ...frame, x: frame.x + dx, y: frame.y + dy };
}
