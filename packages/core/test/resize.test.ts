import { describe, expect, it } from 'vitest'
import { HANDLES, center, handlePosition, resize } from '../src'
import type { Frame, Handle } from '../src'

const base: Frame = { x: 100, y: 50, width: 200, height: 100, rotation: 0 }
const rotated: Frame = { ...base, rotation: 37 }

const OPPOSITE: Record<Handle, Handle> = {
  n: 's',
  ne: 'sw',
  e: 'w',
  se: 'nw',
  s: 'n',
  sw: 'ne',
  w: 'e',
  nw: 'se',
}

function expectPoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 9)
  expect(actual.y).toBeCloseTo(expected.y, 9)
}

describe('resize on an unrotated frame', () => {
  it('grows from the south-east handle', () => {
    const next = resize(base, { handle: 'se', delta: { x: 20, y: 10 } })
    expect(next).toEqual({ ...base, width: 220, height: 110 })
  })

  it('grows from the north-west handle and moves the origin', () => {
    const next = resize(base, { handle: 'nw', delta: { x: -20, y: -10 } })
    expect(next).toEqual({ x: 80, y: 40, width: 220, height: 110, rotation: 0 })
  })

  it('ignores the perpendicular delta on edge handles', () => {
    const next = resize(base, { handle: 'e', delta: { x: 30, y: 999 } })
    expect(next).toEqual({ ...base, width: 230 })
  })
})

describe('resize keeps the opposite handle fixed on a rotated frame', () => {
  for (const handle of HANDLES) {
    it(`handle ${handle}`, () => {
      const anchorBefore = handlePosition(rotated, OPPOSITE[handle])
      const next = resize(rotated, { handle, delta: { x: 23, y: -11 } })
      expectPoint(handlePosition(next, OPPOSITE[handle]), anchorBefore)
      expect(next.rotation).toBe(37)
    })
  }
})

describe('resize from center', () => {
  it('keeps the center fixed and doubles the size change', () => {
    const next = resize(rotated, { handle: 'se', delta: { x: 10, y: 5 }, fromCenter: true })
    expectPoint(center(next), center(rotated))
    const local = resize({ ...rotated, rotation: 0 }, { handle: 'se', delta: { x: 10, y: 5 }, fromCenter: true })
    expect(local.width).toBeCloseTo(220)
    expect(local.height).toBeCloseTo(110)
  })
})

describe('resize with preserved aspect ratio', () => {
  it('derives height from width on the east handle', () => {
    const next = resize(base, { handle: 'e', delta: { x: 100, y: 0 }, preserveAspect: true })
    expect(next.width).toBe(300)
    expect(next.height).toBe(150)
    expectPoint(handlePosition(next, 'w'), handlePosition(base, 'w'))
  })

  it('follows the dominant axis on corner handles', () => {
    const next = resize(base, { handle: 'se', delta: { x: 100, y: 0 }, preserveAspect: true })
    expect(next.width).toBe(300)
    expect(next.height).toBe(150)
    expectPoint(handlePosition(next, 'nw'), handlePosition(base, 'nw'))
  })

  it('accepts an explicit ratio', () => {
    const next = resize(base, { handle: 's', delta: { x: 0, y: 100 }, aspectRatio: 1 })
    expect(next.height).toBe(200)
    expect(next.width).toBe(200)
  })
})

describe('resize limits', () => {
  it('clamps to min and max', () => {
    const shrunk = resize(base, { handle: 'se', delta: { x: -500, y: -500 }, minWidth: 40, minHeight: 30 })
    expect(shrunk.width).toBe(40)
    expect(shrunk.height).toBe(30)
    const grown = resize(base, { handle: 'se', delta: { x: 500, y: 500 }, maxWidth: 250, maxHeight: 120 })
    expect(grown.width).toBe(250)
    expect(grown.height).toBe(120)
  })

  it('keeps the ratio after clamping', () => {
    const next = resize(base, { handle: 'se', delta: { x: 500, y: 0 }, preserveAspect: true, maxHeight: 120 })
    expect(next.height).toBe(120)
    expect(next.width).toBe(240)
  })

  it('never produces a negative size', () => {
    const next = resize(base, { handle: 'se', delta: { x: -1000, y: -1000 } })
    expect(next.width).toBe(0)
    expect(next.height).toBe(0)
  })
})
