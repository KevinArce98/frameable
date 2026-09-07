# RFC 001: Frameable — direct-manipulation primitives for React

- Status: Draft, open for comments
- Working name: `frameable` (name is a placeholder)
- Scope of this RFC: public API of v1. Implementation details are out of scope unless they constrain the API.

## Summary

Frameable is a headless library for dragging, resizing, rotating, selecting and grouping elements on a 2D surface: canvases, design tools, whiteboards, page builders, dashboards.

It replaces the role that `react-moveable`, `react-selecto`, `react-rnd` and `@use-gesture/react` play today. Those libraries have no maintainer, and their open issues describe the same five failures over and over. Frameable is designed around fixing those five failures at the API level rather than patching them.

The core idea in one sentence: **you own the geometry, Frameable owns the math.** The library never reads layout from the DOM to decide where things are and never writes styles. It converts pointer input into changes to a plain `Frame` object that lives in your state, and gives you props to spread on your elements.

## Motivation

Open issues on the incumbents cluster like this (448 open issues on `moveable`, 81 on `react-rnd`, 43 on `use-gesture`, clustered by keyword in September 2026):

| Problem                                       | Issues | Root cause in the incumbents                                            |
| --------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| Wrong resize, rotate or scale math            | 157    | Geometry read back from DOM; rounding and transform-origin drift        |
| Breaks when a parent is zoomed or transformed | 77     | Screen-space deltas applied as if they were element-space               |
| Groups and multi-selection                    | 68     | Groups bolted on as a second component with its own state               |
| Snapping and guides                           | 59     | Snapping is a closed feature with dozens of flags instead of a function |
| Inputs and editable text inside the element   | 41     | Library captures pointer events before the app sees them                |

Every one of these is a consequence of the "library reads and writes the DOM" model. A controlled-geometry model makes them either trivial or explicit.

Secondary motivation: the incumbents have no keyboard story, no React 19 or Strict Mode guarantees, and ship class components or imperative instances.

## Goals

1. Correct under any ancestor transform: CSS zoom, `transform: scale()`, panned and zoomed canvases, nested rotated groups.
2. Headless. Zero styles shipped in the core. A styled `Transformer` component is a separate optional export.
3. Controlled state. Geometry is plain data that the app owns. Works with `useState`, Zustand, Jotai, Yjs, or a server.
4. One transaction model for every interaction, so undo, persistence and collaboration hook in at exactly one place.
5. Keyboard and screen-reader support as first-class, not an add-on.
6. Small. Core under 8 kB min+gz, zero runtime dependencies, tree-shakeable per hook.
7. React 19, Strict Mode, Server Components safe (hooks are client-only and say so).

## Non-goals for v1

- Sortable lists and drop zones. Use `@dnd-kit/react` or `pragmatic-drag-and-drop`.
- Rendering. Frameable does not draw anything. It works with DOM, SVG, Canvas or WebGL through the same props.
- Undo/redo, persistence, collaboration. The transaction model makes them easy to add on top.
- Warp, skew, clip paths, bezier editing. Possible later as plugins.
- Multi-touch pinch and rotate gestures. Planned for v1.1 once the pointer model is stable.
- Physics, inertia, spring animations. Compose with `motion` or `react-spring` on the resulting `Frame`.

## Core concepts

### Frame

The unit of geometry. All values are in **surface units**, never screen pixels.

```ts
type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};
```

`x` and `y` are the top-left corner before rotation. `rotation` is in degrees, clockwise, around the frame center. This matches CSS `transform: rotate()` when `transform-origin` is `center`, which is the default `Transformer` output.

A `Frame` is deliberately not a matrix. Matrices are correct but nobody wants to store one in app state or send one over a wire. The library exposes matrix helpers for people who need them.

### Surface

A surface is the coordinate system your frames live in. It knows how to convert between screen pixels and surface units. This is the answer to the "parent is zoomed" family of bugs: the conversion is explicit and lives in one place.

```tsx
<Surface viewport={{ zoom, pan }}>{children}</Surface>
```

`viewport` is optional. When omitted, the surface measures its own DOM node with `getBoundingClientRect` and derives the matrix from the element's computed transform chain. When you already track zoom and pan in state, pass them and no measurement happens.

Surfaces nest. A frame inside a rotated group inside a zoomed canvas resolves through the chain automatically.

### Transaction

Every interaction, whether from pointer or keyboard, is a transaction with three phases:

```ts
type Transaction = {
  id: string;
  kind: 'move' | 'resize' | 'rotate' | 'select';
  phase: 'start' | 'update' | 'end' | 'cancel';
  initial: Frame;
  frame: Frame;
  delta: Partial<Frame>;
  modifiers: { shift: boolean; alt: boolean; meta: boolean; ctrl: boolean };
  source: 'pointer' | 'keyboard' | 'programmatic';
};
```

`update` fires on every animation frame while the interaction is live. `end` fires once with the final frame. `cancel` fires on Escape or pointer cancel and restores `initial`.

This is the single integration point for undo, autosave, collaboration and analytics.

## API

### `useFrame`

The primary hook. One element, one frame.

```tsx
const {
  frame,
  getDragProps,
  getHandleProps,
  getRotateProps,
  getKeyboardProps,
  isActive,
  transaction,
} = useFrame({
  frame,
  onChange,
  onTransaction,
  constraints,
  snap,
  disabled,
});
```

Options:

| Option          | Type                       | Notes                                                       |
| --------------- | -------------------------- | ----------------------------------------------------------- |
| `frame`         | `Frame`                    | Required. Controlled value.                                 |
| `onChange`      | `(frame: Frame) => void`   | Required. Called on every `update` and on `end`.            |
| `onTransaction` | `(t: Transaction) => void` | Optional. Full lifecycle.                                   |
| `constraints`   | `Constraints`              | Min and max size, aspect ratio, bounds, allowed operations. |
| `snap`          | `Snapper \| Snapper[]`     | See Snapping.                                               |
| `disabled`      | `boolean`                  | Removes all listeners, keeps props stable.                  |

Returned prop getters follow the Downshift convention: spread them, they compose with your own handlers.

```tsx
function Box({ frame, onChange }) {
  const f = useFrame({ frame, onChange });

  return (
    <div {...f.getDragProps()} {...f.getKeyboardProps()} style={toStyle(f.frame)}>
      <span {...f.getHandleProps('se')} />
      <span {...f.getHandleProps('n')} />
      <span {...f.getRotateProps()} />
    </div>
  );
}
```

`toStyle` is a helper that returns `{ position, left, top, width, height, transform }`. For SVG, `toSVGTransform`. For Konva or Pixi, read the frame directly.

Handle names: `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`. A handle is any element you spread `getHandleProps` on, so a hit area can be larger than the visible dot.

### Constraints

```ts
type Constraints = {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number | 'preserve';
  bounds?: Frame | 'parent';
  operations?: Array<'move' | 'resize' | 'rotate'>;
  rotationStep?: number;
};
```

Modifier keys have fixed meanings that match Figma, Sketch and Illustrator, because users bring those expectations:

- `Shift` while resizing preserves aspect ratio. While rotating, snaps to 15° steps. While moving, locks to an axis.
- `Alt` while resizing scales from the center.
- `Shift + Alt` does both.

These are on by default. Turn them off per interaction with `modifiers: false` or remap with `modifiers: { preserveAspect: 'meta' }`.

### Snapping

Snapping is a pure function. It receives the candidate frame and returns a snapped frame plus guides to draw. No flags.

```ts
type Snapper = (candidate: Frame, ctx: SnapContext) => SnapResult | null;

type SnapContext = {
  transaction: Transaction;
  surface: SurfaceInfo;
  threshold: number;
};

type SnapResult = {
  frame: Frame;
  guides: Guide[];
};

type Guide = { axis: 'x' | 'y'; position: number; from?: number; to?: number };
```

Built-in snappers cover the common cases and are composable:

```tsx
useFrame({
  frame,
  onChange,
  snap: [
    snapToGrid(8),
    snapToFrames(otherFrames, { edges: true, centers: true }),
    snapToBounds(canvasFrame),
  ],
});
```

Guides come back on the hook as `guides` so you render them however you like. Frameable never draws a line.

Writing a custom snapper is ten lines. Snap to a baseline grid, to text metrics, to a timeline ruler, to whatever your domain needs.

### `useSelection`

Marquee selection and click selection over a set of frames. Works on any frames, not only those managed by `useFrame`.

```tsx
const sel = useSelection({
  items: frames,
  selected,
  onChange: setSelected,
  getFrame: (item) => item.frame,
  mode: 'intersect',
})

<div {...sel.getSurfaceProps()}>
  {items.map((item) => (
    <Box key={item.id} {...sel.getItemProps(item.id)} />
  ))}
  {sel.marquee && <Marquee frame={sel.marquee} />}
</div>
```

- `mode`: `'intersect'` selects anything the marquee touches, `'contain'` requires full containment.
- `Shift + click` toggles, `Shift + drag` adds to the selection, `Alt + drag` subtracts.
- Marquee frames respect the surface, so they work on a zoomed canvas.
- Items scrolled out of view or virtualized are handled through `getFrame`, which never touches the DOM. This closes the top two issues on `selecto`.

### `useGroup`

Turns N frames into one transformable bounding frame and distributes changes back.

```tsx
const group = useGroup({
  frames: selectedFrames,
  onChange: (next) => updateMany(next),
})

<Transformer {...group.getTransformerProps()} />
```

`group.frame` is the rotated bounding box of the members. Moving, resizing or rotating the group applies the same affine change to every member, including nested rotations. This is the same math as `useFrame` with a different target, not a separate code path, which is why it cannot drift.

### `<Transformer>`

The one styled component. A selection outline with eight handles and a rotate handle. Ships its own minimal CSS in a separate entry so headless users never pay for it.

```tsx
<Transformer
  frame={frame}
  onChange={setFrame}
  handles={['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']}
  rotate
  className="my-transformer"
/>
```

It is implemented with `useFrame` and nothing else. It exists so the README demo is three lines and so people who want Figma-looking handles get them.

### Keyboard

`getKeyboardProps()` adds `tabIndex`, `role`, `aria-label`, `aria-roledescription` and key handlers:

| Keys                   | Action                                           |
| ---------------------- | ------------------------------------------------ |
| Arrows                 | Move 1 unit                                      |
| Shift + Arrows         | Move 10 units                                    |
| Alt + Arrows           | Resize 1 unit from the bottom-right              |
| Cmd/Ctrl + `[` and `]` | Rotate 1°                                        |
| Enter                  | Start a keyboard transaction, announces "moving" |
| Escape                 | Cancel the live transaction                      |

Keyboard interactions produce the same `Transaction` objects as pointer ones. Live region announcements are provided through `useAnnouncer`, which the app renders once.

### Interactive content inside a frame

The third most common bug class. Frameable's `getDragProps` ignores pointer downs on elements matching `interactiveSelector`, which defaults to `input, textarea, select, button, a, [contenteditable], [data-frameable-ignore]`. Double click is never captured. This makes text editing inside a draggable box work by default instead of after an issue thread.

For the opposite need, a dedicated drag handle inside the element, spread `getDragProps()` on the handle instead of the root.

### Pointer model

- Pointer Events only. No mouse or touch fallbacks.
- `setPointerCapture` on down, so leaving the element or the window mid-drag does not drop the interaction.
- `touch-action: none` applied through the returned props, not global CSS.
- Updates coalesced to one per animation frame. `onChange` never fires more than 60 or 120 times a second.
- Deltas are computed from the initial pointer position, not accumulated, so rounding cannot drift over a long drag. This is the direct fix for the oldest open issue on `moveable`.

### Low-level escape hatch: `frameable-core`

Everything above compiles down to pure functions with no React:

```ts
import { move, resize, rotate, groupBounds, applyToGroup, screenToSurface } from 'frameable-core';

const next = resize(frame, { handle: 'se', delta: { x: 12, y: 4 }, preserveAspect: true });
```

These are exported so Vue, Svelte and vanilla users can build their own bindings, and so the math is testable without a DOM. The React package is thin.

## Coordinate math, stated once

The one paragraph that justifies the architecture.

A pointer event gives `clientX, clientY`. The surface converts that to surface units with the inverse of its accumulated matrix. All deltas are computed in surface units. For a rotated frame, the delta is rotated by `-rotation` into the frame's local axes before being applied to width and height, then the frame's center is recomputed so the opposite handle stays fixed. Scaling from center skips the recentering step. The result is written back as a `Frame`. The DOM is never consulted for position or size, only, optionally, once per surface for the viewport matrix.

Because the library never reads element geometry, subpixel rounding, CSS transitions, `zoom`, `transform-origin`, borders and scrollbars cannot corrupt the model.

## Comparison

|                             | Frameable     | react-moveable | react-rnd              | dnd-kit                | use-gesture   | interactjs |
| --------------------------- | ------------- | -------------- | ---------------------- | ---------------------- | ------------- | ---------- |
| Maintained                  | yes           | no since 2024  | slow                   | yes                    | no since 2024 | yes        |
| Controlled geometry         | yes           | no             | partial                | n/a                    | n/a           | no         |
| Correct under zoomed parent | yes           | no             | no                     | n/a                    | manual        | manual     |
| Rotate                      | yes           | yes            | no                     | no                     | manual        | no         |
| Groups                      | yes           | yes            | no                     | no                     | no            | no         |
| Snapping                    | function      | flags          | grid only              | no                     | no            | modifiers  |
| Marquee selection           | yes           | via selecto    | no                     | no                     | no            | no         |
| Keyboard                    | yes           | no             | no                     | sortable only          | no            | no         |
| Headless                    | yes           | no             | no                     | yes                    | yes           | yes        |
| Size, min+gz                | target < 8 kB | 106 kB         | not measured with deps | not measured with deps | 8 kB          | 28 kB      |

Sizes measured September 2026: `react-moveable` from its bundled ESM entry, `@use-gesture/react` and `interactjs` from Bundlephobia. `react-rnd` and `@dnd-kit/react` split their code across dependencies, so the entry file alone understates them and is omitted.

`dnd-kit` and Frameable are complementary. Use `dnd-kit` when the question is "where in this list does this go". Use Frameable when the question is "what are the coordinates of this thing now".

## Migration from react-moveable

A recipe, not a compatibility layer:

- `<Moveable target={ref} draggable resizable rotatable onDrag onResize onRotate>` becomes `useFrame({ frame, onChange })` plus a `Frame` in state.
- `onRenderEnd` becomes `onTransaction` with `phase === 'end'`.
- `snappable` plus its 20 props become one `snap` array.
- `MoveableGroup` becomes `useGroup`.
- `bounds` becomes `constraints.bounds`.
- `keepRatio` becomes `constraints.aspectRatio: 'preserve'`.

The main change for users is that the element no longer gets its position from Moveable's inline styles but from your state. Most Moveable users already mirror that state to persist it, so this usually deletes code.

## Open questions

1. **Rotation origin.** Center is the right default. Should `origin` be configurable per frame, or only per transaction? Per frame complicates groups.
2. **Units.** Should `Frame` allow `width: 'auto'` for text boxes that size to content? Leaning no for v1. Measure once, store a number.
3. **Surface auto-measurement.** Measuring the transform chain on every pointer down is cheap. Measuring it on every frame is not. Proposal: measure on `start`, assume stable during a transaction, expose `surface.invalidate()` for apps that zoom mid-drag.
4. **Name.** `frameable` is available on npm. Alternatives welcome.
5. **Touch gestures.** Pinch to resize and two-finger rotate are natural on tablets. Separate hook `usePinch` in 1.1, or fold into `useFrame` with a `touch` option?
6. **Server Components.** Hooks carry `'use client'`. Should `frameable-core` be usable during SSR for layout precomputation? It has no DOM dependency, so yes by construction, but it needs to be documented.

## Roadmap

- **0.1**: `useFrame`, `Surface`, `toStyle`, `snapToGrid`, keyboard. Enough to replace `react-rnd`.
- **0.2**: `useSelection`, `useGroup`, `snapToFrames`, `Transformer`. Enough to replace `react-moveable` plus `react-selecto` for 80 % of users.
- **0.3**: `usePinch`, guides rendering helpers, Vue bindings from `frameable-core`.
- **1.0**: API freeze after two months without breaking changes.

## Feedback wanted

Reply on this thread with:

- Which of the five problem clusters you hit, and whether the proposed API would have prevented it.
- A snippet of the `Moveable` or `Rnd` code you would be replacing. Real usage beats hypothetical usage.
- Whether you would try a 0.1 that only does `useFrame`.
