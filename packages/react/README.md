<p align="center">
  <strong>frameable</strong><br />
  Headless drag, resize and rotate for React. Correct under any zoom.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@frameable/react"><img alt="npm" src="https://img.shields.io/npm/v/@frameable/react?color=3b82f6&label=npm" /></a>
  <a href="https://bundlephobia.com/package/@frameable/react"><img alt="size" src="https://img.shields.io/bundlephobia/minzip/@frameable/react?color=3b82f6&label=min%2Bgzip" /></a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-3b82f6" />
</p>

---

**You own the geometry. Frameable owns the math.**

Frameable turns pointer and keyboard input into changes to a plain `Frame` object that lives in your state. It never reads layout from the DOM and never writes styles, so it stays correct inside zoomed canvases, CSS `transform`, CSS `zoom`, nested rotated groups and virtualized lists.

It is the successor to the role `react-moveable`, `react-rnd` and `@use-gesture/react` play today, designed around the failure modes those libraries collected in their issue trackers.

```bash
npm i @frameable/react
```

## Quick start

```tsx
import { useState } from 'react'
import { Surface, useFrame, toStyle } from '@frameable/react'

function Box({ frame, onChange }) {
  const f = useFrame({ frame, onChange, constraints: { minWidth: 40, minHeight: 40 } })

  return (
    <div {...f.getDragProps()} {...f.getKeyboardProps()} style={{ ...toStyle(frame), ...f.getDragProps().style }}>
      <span {...f.getHandleProps('se')} className="handle" />
      <span {...f.getRotateProps()} className="rotate" />
    </div>
  )
}

export function Canvas() {
  const [frame, setFrame] = useState({ x: 80, y: 80, width: 240, height: 160, rotation: 0 })

  return (
    <Surface style={{ position: 'absolute', inset: 0 }}>
      <Box frame={frame} onChange={setFrame} />
    </Surface>
  )
}
```

The frame is yours. Put it in `useState`, Zustand, Jotai, Yjs or a database row. Frameable only calls `onChange` with the next value.

## Why another one

Open issues on the libraries this replaces cluster into five problems. Each one is a consequence of the library reading and writing the DOM.

| Problem | Frameable |
|---|---|
| Resize and rotate math drifts, subpixel rounding | Deltas are computed from the initial pointer, never accumulated |
| Breaks when a parent is zoomed or transformed | `Surface` converts screen pixels to surface units with an explicit matrix |
| Inputs and editable text inside the element stop working | Pointer downs on `input`, `textarea`, `button`, `a`, `[contenteditable]` are ignored by default |
| Snapping is a wall of boolean flags | A snapper is a function: `(candidate, ctx) => { frame, guides }` |
| No keyboard, no screen reader | Arrow keys, modifiers and ARIA attributes ship with `getKeyboardProps()` |

## Zoomed canvases

Pass your zoom and pan to `Surface` and every interaction resolves in surface units. Or omit `viewport` and let `Surface` measure its own element, which also handles CSS `zoom` and `transform: scale()` on ancestors.

```tsx
<Surface viewport={{ zoom, pan }} style={{ position: 'absolute', inset: 0 }}>
  <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
    <Box frame={frame} onChange={setFrame} />
  </div>
</Surface>
```

## API

### `useFrame(options)`

| Option | Type | Description |
|---|---|---|
| `frame` | `Frame` | Controlled value: `{ x, y, width, height, rotation }` in surface units |
| `onChange` | `(frame) => void` | Called on every animation frame during an interaction and once at the end |
| `onTransaction` | `(t) => void` | Full lifecycle: `start`, `update`, `end`, `cancel` with `initial`, `frame`, `delta`, `modifiers`, `source` |
| `constraints` | `Constraints` | `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `aspectRatio`, `bounds`, `operations`, `rotationStep` |
| `snap` | `Snapper \| Snapper[]` | Composable snapping, see below |
| `disabled` | `boolean` | Removes all listeners, keeps props stable |
| `interactiveSelector` | `string \| false` | Elements that should receive pointer events instead of starting a drag |
| `label` | `string` | Accessible name for the frame |

Returns `{ frame, isActive, transaction, guides, getDragProps, getHandleProps, getRotateProps, getKeyboardProps }`. Spread the prop getters on your elements. Handles are named `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`.

### Modifiers

Same semantics as Figma, on by default.

- `Shift` while resizing keeps the aspect ratio. While rotating, snaps to 15°. While moving, locks to one axis.
- `Alt` while resizing scales from the center.
- `Escape` cancels the interaction and restores the initial frame.

### Keyboard

| Keys | Action |
|---|---|
| Arrows | Move by 1 |
| `Shift` + Arrows | Move by 10 |
| `Alt` + Arrows | Resize from the bottom-right |
| `Cmd`/`Ctrl` + `[` `]` | Rotate by 1°, by 15° with `Shift` |

### Snapping

```tsx
import { snapToGrid } from '@frameable/react'

useFrame({ frame, onChange, snap: snapToGrid(8) })
```

A custom snapper is a pure function. Return `null` to pass through.

```ts
const snapToBaseline: Snapper = (candidate, ctx) => {
  if (ctx.kind !== 'move') return null
  const y = Math.round(candidate.y / 4) * 4
  return { frame: { ...candidate, y }, guides: [{ axis: 'y', position: y }] }
}
```

### `Surface`

Provides the coordinate system. Renders a `div`, accepts `viewport={{ zoom, pan }}` and any div props. Exposes `getMatrix()` through its ref so you can convert pointer positions yourself.

### `@frameable/core`

Everything above is built on pure functions with no React and no DOM: `move`, `resize`, `rotate`, `applyBounds`, `runSnappers`, viewport matrices and style helpers. Use it to build bindings for other frameworks or to precompute layouts on the server.

## Comparison

| | Frameable | react-moveable | react-rnd | @use-gesture/react |
|---|---|---|---|---|
| Maintained | yes | no release since 2024 | slow | no release since 2024 |
| Controlled geometry | yes | no | partial | n/a |
| Correct under zoomed parent | yes | no | no | manual |
| Rotate | yes | yes | no | manual |
| Snapping | function | flags | grid only | no |
| Keyboard | yes | no | no | no |
| Headless | yes | no | no | yes |
| Size, min+gzip | 3.3 kB + 2.9 kB core | 106 kB | not measured | 8 kB |

Frameable is complementary to `@dnd-kit/react` and `pragmatic-drag-and-drop`. Use those when the question is "where in this list does this go". Use Frameable when the question is "what are the coordinates of this thing now".

## Roadmap

- **0.1** `useFrame`, `Surface`, `snapToGrid`, keyboard. Replaces `react-rnd`.
- **0.2** `useSelection`, `useGroup`, `snapToFrames`, styled `Transformer`. Replaces `react-moveable` and `react-selecto`.
- **0.3** `usePinch`, guide rendering helpers, Vue bindings.
- **1.0** API freeze.

The full design, with the data behind these decisions, is in [RFC 001](https://github.com/frameable/frameable/blob/main/RFC-001-api.md).

## License

MIT
