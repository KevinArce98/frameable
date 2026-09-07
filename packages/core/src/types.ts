export type Point = { x: number; y: number };

export type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };

export type Viewport = { zoom?: number; pan?: Point };

export type Operation = 'move' | 'resize' | 'rotate';

export type TransactionKind = Operation | 'select';

export type TransactionPhase = 'start' | 'update' | 'end' | 'cancel';

export type TransactionSource = 'pointer' | 'keyboard' | 'programmatic';

export type Modifiers = { shift: boolean; alt: boolean; meta: boolean; ctrl: boolean };

export type Transaction = {
  id: string;
  kind: TransactionKind;
  phase: TransactionPhase;
  handle?: Handle;
  initial: Frame;
  frame: Frame;
  delta: Partial<Frame>;
  modifiers: Modifiers;
  source: TransactionSource;
};

export type Constraints = {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number | 'preserve';
  bounds?: Frame;
  operations?: Operation[];
  rotationStep?: number;
};

export type Guide = { axis: 'x' | 'y'; position: number; from?: number; to?: number };

export type SnapContext = {
  kind: TransactionKind;
  handle?: Handle;
  threshold: number;
};

export type SnapResult = { frame: Frame; guides: Guide[] };

export type Snapper = (candidate: Frame, ctx: SnapContext) => SnapResult | null;
