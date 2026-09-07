import { center } from './geometry';
import type { Frame } from './types';

export type FrameStyle = {
  position: 'absolute';
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
  transformOrigin: string;
};

export function toStyle(frame: Frame): FrameStyle {
  return {
    position: 'absolute',
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    transform: frame.rotation === 0 ? 'none' : `rotate(${frame.rotation}deg)`,
    transformOrigin: 'center',
  };
}

export function toSVGTransform(frame: Frame): string {
  if (frame.rotation === 0) return '';
  const c = center(frame);
  return `rotate(${frame.rotation} ${c.x} ${c.y})`;
}
