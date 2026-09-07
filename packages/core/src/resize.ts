import { HANDLE_DIRECTION, center, rotateVector } from './geometry'
import type { Frame, Handle, Point } from './types'

export type ResizeOptions = {
  handle: Handle
  delta: Point
  preserveAspect?: boolean
  aspectRatio?: number
  fromCenter?: boolean
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function resize(frame: Frame, options: ResizeOptions): Frame {
  const [hx, hy] = HANDLE_DIRECTION[options.handle]
  const local = rotateVector(options.delta, -frame.rotation)
  const factor = options.fromCenter ? 2 : 1
  const minWidth = options.minWidth ?? 0
  const minHeight = options.minHeight ?? 0
  const maxWidth = options.maxWidth ?? Infinity
  const maxHeight = options.maxHeight ?? Infinity

  let width = hx === 0 ? frame.width : frame.width + hx * local.x * factor
  let height = hy === 0 ? frame.height : frame.height + hy * local.y * factor

  const ratio = options.aspectRatio ?? (frame.height === 0 ? 1 : frame.width / frame.height)
  const keepRatio = options.preserveAspect || options.aspectRatio !== undefined

  if (keepRatio) {
    if (hx === 0) width = height * ratio
    else if (hy === 0) height = width / ratio
    else {
      const widthChange = Math.abs(width - frame.width) / Math.max(frame.width, 1)
      const heightChange = Math.abs(height - frame.height) / Math.max(frame.height, 1)
      if (widthChange >= heightChange) height = width / ratio
      else width = height * ratio
    }
  }

  width = clamp(width, minWidth, maxWidth)
  height = clamp(height, minHeight, maxHeight)
  if (keepRatio) {
    const fromWidth = width / ratio
    if (fromWidth >= minHeight && fromWidth <= maxHeight) height = fromWidth
    else width = clamp(height * ratio, minWidth, maxWidth)
  }

  const c = center(frame)
  if (options.fromCenter) {
    return { ...frame, x: c.x - width / 2, y: c.y - height / 2, width, height }
  }

  const ax = keepRatio && hx === 0 ? 0 : -hx
  const ay = keepRatio && hy === 0 ? 0 : -hy
  const anchorBefore = rotateVector({ x: (ax * frame.width) / 2, y: (ay * frame.height) / 2 }, frame.rotation)
  const anchorAfter = rotateVector({ x: (ax * width) / 2, y: (ay * height) / 2 }, frame.rotation)
  const nextCenter = {
    x: c.x + anchorBefore.x - anchorAfter.x,
    y: c.y + anchorBefore.y - anchorAfter.y,
  }
  return { ...frame, x: nextCenter.x - width / 2, y: nextCenter.y - height / 2, width, height }
}
