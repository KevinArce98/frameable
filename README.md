<p align="center">
  <strong>frameable</strong><br />
  Headless drag, resize, rotate and selection for React. Correct under any zoom.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/frameable"><img alt="npm" src="https://img.shields.io/npm/v/frameable?color=3b82f6&label=npm" /></a>
  <a href="https://bundlephobia.com/package/frameable"><img alt="size" src="https://img.shields.io/bundlephobia/minzip/frameable?color=3b82f6&label=min%2Bgzip" /></a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-3b82f6" />
</p>

<p align="center">
  <a href="https://kevinarce98.github.io/frameable/"><strong>Live demo</strong></a> · <a href="https://github.com/KevinArce98/frameable/blob/main/RFC-001-api.md">RFC 001</a>
</p>

---

**You own the geometry. Frameable owns the math.**

Frameable turns pointer and keyboard input into changes to a plain `Frame` object that lives in your state. It never reads layout from the DOM and never writes styles, so it stays correct inside zoomed canvases, CSS `transform`, CSS `zoom`, nested rotated groups and virtualized lists.

It is the successor to the role `react-moveable`, `react-rnd` and `@use-gesture/react` play today, designed around the failure modes those libraries collected in their issue trackers.

```bash
npm i frameable
```

## Quick start

```tsx
import { useState } from 'react';
import { Surface, useFrame, toStyle } from 'frameable';

function Box({ frame, onChange }) {
  const f = useFrame({ frame, onChange, constraints: { minWidth: 40, minHeight: 40 } });

  return (
    <div
      {...f.getDragProps()}
      {...f.getKeyboardProps()}
      style={{ ...toStyle(frame), ...f.getDragProps().style }}
    >
      <span {...f.getHandleProps('se')} className="handle" />
      <span {...f.getRotateProps()} className="rotate" />
    </div>
  );
}

export function Canvas() {
  const [frame, setFrame] = useState({ x: 80, y: 80, width: 240, height: 160, rotation: 0 });

  return (
    <Surface style={{ position: 'absolute', inset: 0 }}>
      <Box frame={frame} onChange={setFrame} />
    </Surface>
  );
}
```

The frame is yours. Put it in `useState`, Zustand, Jotai, Yjs or a database row. Frameable only calls `onChange` with the next value.

## Why another one

Open issues on the libraries this replaces cluster into five problems. Each one is a consequence of the library reading and writing the DOM.

| Problem                                                  | Frameable                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Resize and rotate math drifts, subpixel rounding         | Deltas are computed from the initial pointer, never accumulated                                 |
| Breaks when a parent is zoomed or transformed            | `Surface` converts screen pixels to surface units with an explicit matrix                       |
| Inputs and editable text inside the element stop working | Pointer downs on `input`, `textarea`, `button`, `a`, `[contenteditable]` are ignored by default |
| Snapping is a wall of boolean flags                      | A snapper is a function: `(candidate, ctx) => { frame, guides }`                                |
| No keyboard, no screen reader                            | Arrow keys, modifiers and ARIA attributes ship with `getKeyboardProps()`                        |

## Zoomed canvases

Pass your zoom and pan to `Surface` and every interaction resolves in surface units. Or omit `viewport` and let `Surface` measure its own element, which also handles CSS `zoom` and `transform: scale()` on ancestors.

```tsx
<Surface viewport={{ zoom, pan }} style={{ position: 'absolute', inset: 0 }}>
  <div
    style={{
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: '0 0',
    }}
  >
    <Box frame={frame} onChange={setFrame} />
  </div>
</Surface>
```

## API

### `useFrame(options)`

| Option                | Type                   | Description                                                                                                |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `frame`               | `Frame`                | Controlled value: `{ x, y, width, height, rotation }` in surface units                                     |
| `onChange`            | `(frame) => void`      | Called on every animation frame during an interaction and once at the end                                  |
| `onTransaction`       | `(t) => void`          | Full lifecycle: `start`, `update`, `end`, `cancel` with `initial`, `frame`, `delta`, `modifiers`, `source` |
| `constraints`         | `Constraints`          | `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `aspectRatio`, `bounds`, `operations`, `rotationStep`    |
| `snap`                | `Snapper \| Snapper[]` | Composable snapping, see below                                                                             |
| `snapThreshold`       | `number`               | Snap distance in screen pixels. Default `4`                                                                |
| `disabled`            | `boolean`              | Removes all listeners, keeps props stable                                                                  |
| `interactiveSelector` | `string \| false`      | Elements that should receive pointer events instead of starting a drag                                     |
| `modifiers`           | `boolean`              | Set to `false` to turn off the Shift and Alt behaviors below                                               |
| `label`               | `string`               | Accessible name for the frame                                                                              |

Returns `{ frame, isActive, transaction, guides, cancel, getDragProps, getHandleProps, getRotateProps, getKeyboardProps }`. Spread the prop getters on your elements. Handles are named `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`.

### Modifiers

Same semantics as Figma, on by default.

- `Shift` while resizing keeps the aspect ratio. While rotating, snaps to 15°. While moving, locks to one axis.
- `Alt` while resizing scales from the center.
- `Escape` cancels the interaction and restores the initial frame.

### Keyboard

| Keys                   | Action                            |
| ---------------------- | --------------------------------- |
| Arrows                 | Move by 1                         |
| `Shift` + Arrows       | Move by 10                        |
| `Alt` + Arrows         | Resize from the bottom-right      |
| `Cmd`/`Ctrl` + `[` `]` | Rotate by 1°, by 15° with `Shift` |

### Snapping

```tsx
import { snapToFrames, snapToGrid } from 'frameable';

useFrame({ frame, onChange, snap: [snapToGrid(8), snapToFrames(otherFrames)] });
```

`snapThreshold` is in screen pixels, converted to surface units through the current zoom. Keyboard nudges are never snapped. `snapToFrames(frames, { edges, centers })` aligns edges and centers to other frames and returns the guides to draw. A snap that would break `minWidth`, `maxHeight`, `bounds` or a locked aspect ratio is discarded. A custom snapper is a pure function. Return `null` to pass through.

```ts
const snapToBaseline: Snapper = (candidate, ctx) => {
  if (ctx.kind !== 'move') return null;
  const y = Math.round(candidate.y / 4) * 4;
  return { frame: { ...candidate, y }, guides: [{ axis: 'y', position: y }] };
};
```

### `useSelection(options)`

Marquee and click selection over any set of frames. It reads frames through `getFrame`, never the DOM, so virtualized and off-screen items are selectable.

```tsx
const surface = useRef<SurfaceHandle>(null);

const sel = useSelection({
  items,
  selected,
  onChange: setSelected,
  getFrame: item => item.frame,
  mode: 'intersect',
  surface,
});

<Surface ref={surface} {...sel.getSurfaceProps()}>
  {items.map(item => (
    <Box key={item.id} {...sel.getItemProps(item.id)} />
  ))}
  {sel.marquee && <div style={toStyle(sel.marquee)} />}
</Surface>;
```

| Option                | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `mode`                | `'intersect'` (default) or `'contain'`                                                                  |
| `getId`               | Required unless items have a string `id`                                                                |
| `surface`, `viewport` | Resolve the marquee through the `Surface` zoom and pan. Pass the `Surface` ref, or `viewport` alone     |
| `onTransaction`       | `select` lifecycle (`start`, `update`, `end`, `cancel`) so history can coalesce a marquee into one step |
| `interactiveSelector` | Presses on matching elements never start a marquee. Same default as `useFrame`                          |

`Shift` + click toggles, `Shift` + drag adds, `Alt` + drag subtracts, `Escape` restores the previous selection. `getSurfaceProps(userProps)` and `getItemProps(id, userProps)` compose with your own handlers and `style`.

### `useGroup(options)` and `Transformer`

`useGroup` turns N items into one transformable frame and applies every change back to them. It calls `useFrame` internally, so it returns the same prop getters (`getDragProps`, `getHandleProps`, `getRotateProps`, `getKeyboardProps`) plus `frame`, `guides` and `isActive`. `Transformer` is the one styled component, built on the same controller.

```tsx
import 'frameable/transformer.css';

const group = useGroup({
  items: selectedItems,
  getFrame: item => item.frame,
  onChange: updates => updateMany(updates),
  snap: snapToFrames(otherFrames),
});

<Transformer {...group.getTransformerProps()} draggable={false} zoom={zoom} />;
```

- `onChange` receives `{ id, frame }[]`. `onTransaction` receives the group transaction plus `members`, one `{ id, initial, frame }` per item, so undo and sync get per-member before and after values.
- `group.frame` is `null` for an empty selection. It keeps its rotation after a transaction for as long as the items stay where the group left them, so repeated rotation pivots around the same point. If the items change from outside, it falls back to an unrotated bounding box.
- To drag the group from the members themselves, spread `group.getDragProps()` on each selected member and render `<Transformer draggable={false} />`. Members stay clickable and `Shift` + click keeps working.
- `constraints` apply to the group box, not to each member.
- A `Frame` cannot represent shear, so a non-uniform scale is only exact for members aligned to the group axes in quarter turns. `nonUniformScale` decides what happens otherwise. `'lock'` (default) keeps the aspect ratio of the group while any member is turned off the group axes, so every resize stays exact. `'approximate'` allows free resizing and fits each turned member to its stretched axis, keeping its area. When all members share one rotation, the group adopts it and resizes freely and exactly.
- `Transformer` also works alone with `frame` and `onChange`, accepts every `useFrame` option plus `handles`, `rotate`, `draggable`, `zoom`, `className` and `onGuidesChange`. Pass the viewport `zoom` so handles and outline keep their on-screen size. Style it with `--frameable-color` and `--frameable-handle-size`.

### `Surface`

Provides the coordinate system. Renders a `div`, accepts `viewport={{ zoom, pan }}` and any div props. Exposes `getMatrix()` through its ref so you can convert pointer positions yourself.

### `frameable-core`

```bash
npm i frameable-core
```

Everything above is built on pure functions with no React and no DOM: `move`, `resize`, `rotate`, `applyBounds`, `runSnappers`, `groupBounds`, `applyToGroup`, `selectInMarquee`, `combineSelection`, viewport matrices and style helpers. Use it to build bindings for other frameworks or to precompute layouts on the server.

## Comparison

|                             | Frameable            | react-moveable | react-rnd    | @use-gesture/react |
| --------------------------- | -------------------- | -------------- | ------------ | ------------------ |
| Last release                | active               | Dec 2023       | Mar 2026     | Mar 2024           |
| Controlled geometry         | yes                  | no             | partial      | n/a                |
| Correct under zoomed parent | yes                  | no             | no           | manual             |
| Rotate                      | yes                  | yes            | no           | manual             |
| Snapping                    | function             | flags          | grid only    | no                 |
| Keyboard                    | yes                  | no             | no           | no                 |
| Headless                    | yes                  | no             | no           | yes                |
| Size, min+gzip              | 5.1 kB + 3.6 kB core | 106 kB         | not measured | 8 kB               |

Frameable is complementary to `@dnd-kit/react` and `pragmatic-drag-and-drop`. Use those when the question is "where in this list does this go". Use Frameable when the question is "what are the coordinates of this thing now".

## Roadmap

- **0.1** (released) `useFrame`, `Surface`, `snapToGrid`, keyboard. Replaces `react-rnd`.
- **0.2** (released) `useSelection`, `useGroup`, `snapToFrames`, styled `Transformer`. Replaces `react-moveable` and `react-selecto`.
- **0.3** `usePinch`, guide rendering helpers, Vue bindings.
- **1.0** API freeze.

The original design, with the data behind these decisions, is in [RFC 001](https://github.com/KevinArce98/frameable/blob/main/RFC-001-api.md). Its implementation status section lists where the shipped API differs.

## License

MIT

## Development

```bash
pnpm install
pnpm test:run
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
```

`pnpm dev` starts the demo in `examples/demo`: a dark canvas with viewport zoom and pan, an optional CSS `zoom` on the parent, grid and layer snapping, marquee selection, a group transformer, a live frame inspector and the transaction log.
