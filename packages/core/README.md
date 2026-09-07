# @frameable/core

Framework-agnostic math for dragging, resizing and rotating frames on a 2D surface. No React, no DOM, no dependencies. 2.9 kB min+gzip.

This is the engine behind [`@frameable/react`](https://www.npmjs.com/package/@frameable/react). Use it directly to build bindings for Vue, Svelte or vanilla JS, or to precompute layouts on the server.

```bash
npm i @frameable/core
```

## Frame

All values are in surface units, never screen pixels.

```ts
type Frame = { x: number; y: number; width: number; height: number; rotation: number };
```

`x` and `y` are the top-left corner before rotation. `rotation` is in degrees, clockwise, around the center.

## Operations

```ts
import { move, resize, rotate, rotationFromPointer } from '@frameable/core';

move(frame, { x: 10, y: 0 }, { axisLock: true });

resize(frame, { handle: 'se', delta: { x: 24, y: 12 }, preserveAspect: true, minWidth: 40 });

rotate(frame, { to: 47, step: 15 });

rotationFromPointer(initialFrame, startPoint, currentPoint);
```

`resize` keeps the handle opposite to the one being dragged fixed in surface space, for any rotation. `fromCenter: true` keeps the center fixed instead.

## Coordinate systems

```ts
import { fromViewport, multiply, screenToSurface, screenDeltaToSurface } from '@frameable/core';

const matrix = fromViewport({ zoom: 2, pan: { x: 100, y: 40 } });
screenToSurface({ x: 300, y: 140 }, matrix);
screenDeltaToSurface({ x: 10, y: 10 }, matrix);
```

Matrices compose with `multiply`, so an outer CSS scale and an inner viewport resolve through one call.

## Snapping and constraints

```ts
import { runSnappers, snapToGrid, applyBounds } from '@frameable/core';

const { frame, guides } = runSnappers(candidate, [snapToGrid(8)], { kind: 'move', threshold: 4 });
applyBounds(frame, { x: 0, y: 0, width: 1200, height: 800, rotation: 0 });
```

## Geometry helpers

`center`, `corners`, `aabb`, `handlePosition`, `localToSurface`, `surfaceToLocal`, `pointerAngle`, `normalizeAngle`, `frameDelta`, `toStyle`, `toSVGTransform`.

## License

MIT
