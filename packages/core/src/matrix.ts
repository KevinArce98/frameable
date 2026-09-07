import type { Matrix, Point, Viewport } from './types'

export const identity: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

export function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  }
}

export function invert(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c
  if (det === 0) throw new Error('Matrix is not invertible')
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  }
}

export function apply(m: Matrix, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

export function applyToVector(m: Matrix, v: Point): Point {
  return { x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y }
}

export function translation(x: number, y: number): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y }
}

export function scaling(sx: number, sy = sx): Matrix {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
}

export function rotationMatrix(degrees: number): Matrix {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

export function fromViewport(viewport: Viewport): Matrix {
  const zoom = viewport.zoom ?? 1
  const pan = viewport.pan ?? { x: 0, y: 0 }
  return multiply(translation(pan.x, pan.y), scaling(zoom))
}

export function surfaceToScreen(point: Point, matrix: Matrix): Point {
  return apply(matrix, point)
}

export function screenToSurface(point: Point, matrix: Matrix): Point {
  return apply(invert(matrix), point)
}

export function screenDeltaToSurface(delta: Point, matrix: Matrix): Point {
  return applyToVector(invert(matrix), delta)
}
