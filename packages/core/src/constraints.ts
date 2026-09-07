import { aabb } from './geometry'
import type { Frame } from './types'

export function applyBounds(frame: Frame, bounds: Frame | undefined): Frame {
  if (!bounds) return frame
  const box = aabb(frame)
  let dx = 0
  let dy = 0
  if (box.x < bounds.x) dx = bounds.x - box.x
  else if (box.x + box.width > bounds.x + bounds.width) dx = bounds.x + bounds.width - (box.x + box.width)
  if (box.y < bounds.y) dy = bounds.y - box.y
  else if (box.y + box.height > bounds.y + bounds.height) dy = bounds.y + bounds.height - (box.y + box.height)
  if (dx === 0 && dy === 0) return frame
  return { ...frame, x: frame.x + dx, y: frame.y + dy }
}
