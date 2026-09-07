'use client';
import {
  applyBounds,
  center,
  frameDelta,
  move,
  pointerAngle,
  resize,
  rotate,
  runSnappers,
  screenToSurface,
} from 'frameable-core';
import type {
  Constraints,
  Frame,
  Guide,
  Handle,
  Matrix,
  Modifiers,
  Operation,
  Point,
  Snapper,
  Transaction,
  TransactionSource,
} from 'frameable-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { useSurface } from './Surface';

export type UseFrameOptions = {
  frame: Frame;
  onChange: (frame: Frame) => void;
  onTransaction?: (transaction: Transaction) => void;
  constraints?: Constraints;
  snap?: Snapper | Snapper[];
  snapThreshold?: number;
  disabled?: boolean;
  interactiveSelector?: string | false;
  modifiers?: boolean;
  label?: string;
};

export type PointerProps = {
  onPointerDown: (event: PointerEvent<Element>) => void;
  onPointerMove: (event: PointerEvent<Element>) => void;
  onPointerUp: (event: PointerEvent<Element>) => void;
  onPointerCancel: (event: PointerEvent<Element>) => void;
  style: CSSProperties;
  'data-frameable': Operation;
  'data-frameable-handle'?: Handle;
};

export type KeyboardProps = {
  tabIndex: number;
  role: string;
  'aria-label': string;
  'aria-roledescription': string;
  onKeyDown: (event: KeyboardEvent<Element>) => void;
};

export type UseFrameResult = {
  frame: Frame;
  isActive: boolean;
  transaction: Transaction | null;
  guides: Guide[];
  getDragProps: () => PointerProps;
  getHandleProps: (handle: Handle) => PointerProps;
  getRotateProps: () => PointerProps;
  getKeyboardProps: () => KeyboardProps;
};

type Session = {
  id: string;
  kind: Operation;
  handle?: Handle;
  pointerId: number;
  target: Element;
  initial: Frame;
  matrix: Matrix;
  start: Point;
  startAngle: number;
  latest: { point: Point; modifiers: Modifiers } | null;
  raf: number;
};

const DEFAULT_INTERACTIVE =
  'input, textarea, select, button, a, [contenteditable], [data-frameable-ignore]';

let transactionCounter = 0;

function nextId(): string {
  transactionCounter += 1;
  return `t${transactionCounter}`;
}

function readModifiers(event: {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): Modifiers {
  return { shift: event.shiftKey, alt: event.altKey, meta: event.metaKey, ctrl: event.ctrlKey };
}

function allowed(constraints: Constraints | undefined, operation: Operation): boolean {
  return !constraints?.operations || constraints.operations.includes(operation);
}

export function useFrame(options: UseFrameOptions): UseFrameResult {
  const surface = useSurface();
  const latest = useRef(options);
  latest.current = options;

  const session = useRef<Session | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const emit = useCallback((t: Transaction) => {
    latest.current.onTransaction?.(t);
  }, []);

  const compute = useCallback(
    (s: Session, point: Point, modifiers: Modifiers): { frame: Frame; guides: Guide[] } => {
      const {
        constraints,
        snap,
        snapThreshold,
        modifiers: modifiersEnabled = true,
      } = latest.current;
      const mods = modifiersEnabled
        ? modifiers
        : { shift: false, alt: false, meta: false, ctrl: false };
      const delta = { x: point.x - s.start.x, y: point.y - s.start.y };
      let frame: Frame;
      if (s.kind === 'move') {
        frame = applyBounds(move(s.initial, delta, { axisLock: mods.shift }), constraints?.bounds);
      } else if (s.kind === 'resize' && s.handle) {
        const ratio = constraints?.aspectRatio;
        frame = resize(s.initial, {
          handle: s.handle,
          delta,
          preserveAspect: mods.shift || ratio === 'preserve',
          ...(typeof ratio === 'number' ? { aspectRatio: ratio } : {}),
          fromCenter: mods.alt,
          ...(constraints?.minWidth !== undefined ? { minWidth: constraints.minWidth } : {}),
          ...(constraints?.minHeight !== undefined ? { minHeight: constraints.minHeight } : {}),
          ...(constraints?.maxWidth !== undefined ? { maxWidth: constraints.maxWidth } : {}),
          ...(constraints?.maxHeight !== undefined ? { maxHeight: constraints.maxHeight } : {}),
        });
        frame = applyBounds(frame, constraints?.bounds);
      } else {
        const to = s.initial.rotation + pointerAngle(center(s.initial), point) - s.startAngle;
        const step = mods.shift ? 15 : constraints?.rotationStep;
        frame = rotate(s.initial, step === undefined ? { to } : { to, step });
      }
      return runSnappers(frame, snap, {
        kind: s.kind,
        ...(s.handle ? { handle: s.handle } : {}),
        threshold: snapThreshold ?? 4,
      });
    },
    []
  );

  const flush = useCallback(() => {
    const s = session.current;
    if (!s || !s.latest) return;
    s.raf = 0;
    const result = compute(s, s.latest.point, s.latest.modifiers);
    const t: Transaction = {
      id: s.id,
      kind: s.kind,
      phase: 'update',
      ...(s.handle ? { handle: s.handle } : {}),
      initial: s.initial,
      frame: result.frame,
      delta: frameDelta(s.initial, result.frame),
      modifiers: s.latest.modifiers,
      source: 'pointer',
    };
    latest.current.onChange(result.frame);
    setTransaction(t);
    setGuides(result.guides);
    emit(t);
  }, [compute, emit]);

  const finish = useCallback(
    (phase: 'end' | 'cancel') => {
      const s = session.current;
      if (!s) return;
      if (s.raf) cancelAnimationFrame(s.raf);
      session.current = null;
      const modifiers = s.latest?.modifiers ?? {
        shift: false,
        alt: false,
        meta: false,
        ctrl: false,
      };
      const frame =
        phase === 'cancel' || !s.latest ? s.initial : compute(s, s.latest.point, modifiers).frame;
      latest.current.onChange(frame);
      const t: Transaction = {
        id: s.id,
        kind: s.kind,
        phase,
        ...(s.handle ? { handle: s.handle } : {}),
        initial: s.initial,
        frame,
        delta: frameDelta(s.initial, frame),
        modifiers,
        source: 'pointer',
      };
      try {
        s.target.releasePointerCapture(s.pointerId);
      } catch {
        void 0;
      }
      setTransaction(null);
      setGuides([]);
      emit(t);
    },
    [compute, emit]
  );

  const begin = useCallback(
    (kind: Operation, event: PointerEvent<Element>, handle?: Handle) => {
      const { disabled, constraints, frame, interactiveSelector } = latest.current;
      if (disabled || session.current || event.button !== 0 || !allowed(constraints, kind)) return;
      if (kind === 'move') {
        const selector =
          interactiveSelector === undefined ? DEFAULT_INTERACTIVE : interactiveSelector;
        const target = event.target as Element;
        if (selector && target !== event.currentTarget && target.closest(selector)) return;
      }
      event.preventDefault();
      event.stopPropagation();
      const matrix = surface.getMatrix();
      const start = screenToSurface({ x: event.clientX, y: event.clientY }, matrix);
      const modifiers = readModifiers(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      const focusTarget =
        kind === 'move'
          ? event.currentTarget
          : event.currentTarget.closest('[data-frameable="move"]');
      if (focusTarget instanceof HTMLElement && focusTarget.tabIndex >= 0)
        focusTarget.focus({ preventScroll: true });
      const s: Session = {
        id: nextId(),
        kind,
        ...(handle ? { handle } : {}),
        pointerId: event.pointerId,
        target: event.currentTarget,
        initial: frame,
        matrix,
        start,
        startAngle: pointerAngle(center(frame), start),
        latest: null,
        raf: 0,
      };
      session.current = s;
      const t: Transaction = {
        id: s.id,
        kind,
        phase: 'start',
        ...(handle ? { handle } : {}),
        initial: frame,
        frame,
        delta: {},
        modifiers,
        source: 'pointer',
      };
      setTransaction(t);
      emit(t);
    },
    [emit, surface]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<Element>) => {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      s.latest = {
        point: screenToSurface({ x: event.clientX, y: event.clientY }, s.matrix),
        modifiers: readModifiers(event),
      };
      if (!s.raf) s.raf = requestAnimationFrame(flush);
    },
    [flush]
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<Element>) => {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      s.latest = {
        point: screenToSurface({ x: event.clientX, y: event.clientY }, s.matrix),
        modifiers: readModifiers(event),
      };
      finish('end');
    },
    [finish]
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<Element>) => {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      finish('cancel');
    },
    [finish]
  );

  const active = transaction !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') finish('cancel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  useEffect(
    () => () => {
      if (session.current?.raf) cancelAnimationFrame(session.current.raf);
    },
    []
  );

  const pointerProps = useCallback(
    (kind: Operation, handle?: Handle): PointerProps => ({
      onPointerDown: event => begin(kind, event, handle),
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style: { touchAction: 'none' },
      'data-frameable': kind,
      ...(handle ? { 'data-frameable-handle': handle } : {}),
    }),
    [begin, onPointerMove, onPointerUp, onPointerCancel]
  );

  const getDragProps = useCallback(() => pointerProps('move'), [pointerProps]);
  const getHandleProps = useCallback(
    (handle: Handle) => pointerProps('resize', handle),
    [pointerProps]
  );
  const getRotateProps = useCallback(() => pointerProps('rotate'), [pointerProps]);

  const keyboardTransaction = useCallback(
    (kind: Operation, next: Frame, modifiers: Modifiers) => {
      const { frame, constraints, snap, snapThreshold } = latest.current;
      const snapped = runSnappers(next, snap, { kind, threshold: snapThreshold ?? 4 });
      const bounded =
        kind === 'rotate' ? snapped.frame : applyBounds(snapped.frame, constraints?.bounds);
      const id = nextId();
      const source: TransactionSource = 'keyboard';
      const base = { id, kind, initial: frame, modifiers, source };
      emit({ ...base, phase: 'start', frame, delta: {} });
      latest.current.onChange(bounded);
      emit({ ...base, phase: 'update', frame: bounded, delta: frameDelta(frame, bounded) });
      emit({ ...base, phase: 'end', frame: bounded, delta: frameDelta(frame, bounded) });
    },
    [emit]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<Element>) => {
      const { disabled, frame, constraints } = latest.current;
      if (disabled || session.current) return;
      const modifiers = readModifiers(event);
      const amount = modifiers.shift ? 10 : 1;
      const arrows: Record<string, Point> = {
        ArrowLeft: { x: -amount, y: 0 },
        ArrowRight: { x: amount, y: 0 },
        ArrowUp: { x: 0, y: -amount },
        ArrowDown: { x: 0, y: amount },
      };
      const arrow = arrows[event.key];
      if (arrow) {
        event.preventDefault();
        if (modifiers.alt) {
          if (!allowed(constraints, 'resize')) return;
          const next = resize(frame, {
            handle: 'se',
            delta: arrow,
            ...(constraints?.minWidth !== undefined ? { minWidth: constraints.minWidth } : {}),
            ...(constraints?.minHeight !== undefined ? { minHeight: constraints.minHeight } : {}),
            ...(constraints?.maxWidth !== undefined ? { maxWidth: constraints.maxWidth } : {}),
            ...(constraints?.maxHeight !== undefined ? { maxHeight: constraints.maxHeight } : {}),
          });
          keyboardTransaction('resize', next, modifiers);
        } else {
          if (!allowed(constraints, 'move')) return;
          keyboardTransaction('move', move(frame, arrow), modifiers);
        }
        return;
      }
      if ((modifiers.meta || modifiers.ctrl) && (event.key === '[' || event.key === ']')) {
        if (!allowed(constraints, 'rotate')) return;
        event.preventDefault();
        const step = modifiers.shift ? 15 : 1;
        const direction = event.key === ']' ? 1 : -1;
        keyboardTransaction(
          'rotate',
          rotate(frame, { to: frame.rotation + direction * step }),
          modifiers
        );
      }
    },
    [keyboardTransaction]
  );

  const getKeyboardProps = useCallback(
    (): KeyboardProps => ({
      tabIndex: 0,
      role: 'group',
      'aria-label': latest.current.label ?? 'Frame',
      'aria-roledescription': 'movable frame',
      onKeyDown,
    }),
    [onKeyDown]
  );

  return useMemo(
    () => ({
      frame: options.frame,
      isActive: active,
      transaction,
      guides,
      getDragProps,
      getHandleProps,
      getRotateProps,
      getKeyboardProps,
    }),
    [
      options.frame,
      active,
      transaction,
      guides,
      getDragProps,
      getHandleProps,
      getRotateProps,
      getKeyboardProps,
    ]
  );
}
