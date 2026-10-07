'use client';
import {
  combineSelection,
  marqueeFrame,
  screenToSurface,
  selectInMarquee,
  toggleSelection,
} from 'frameable-core';
import type {
  Frame,
  Matrix,
  Modifiers,
  Point,
  SelectionMode,
  TransactionPhase,
  Viewport,
} from 'frameable-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, RefObject } from 'react';
import { measureSurface, useSurface } from './Surface';
import type { SurfaceHandle } from './Surface';
import { DEFAULT_INTERACTIVE, readModifiers } from './useFrame';
import { useLatest } from './useLatest';

export type SelectionTransaction = {
  id: string;
  kind: 'select';
  phase: TransactionPhase;
  initial: readonly string[];
  selected: readonly string[];
  marquee: Frame | null;
  modifiers: Modifiers;
  source: 'pointer';
};

type SelectionOptionsBase<T> = {
  items: readonly T[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  onTransaction?: (transaction: SelectionTransaction) => void;
  getFrame: (item: T) => Frame;
  mode?: SelectionMode;
  disabled?: boolean;
  dragThreshold?: number;
  interactiveSelector?: string | false;
  surface?: RefObject<SurfaceHandle | null>;
  viewport?: Viewport;
};

export type UseSelectionOptions<T> = SelectionOptionsBase<T> &
  ([T] extends [{ id: string }] ? { getId?: (item: T) => string } : { getId: (item: T) => string });

export type SelectionSurfaceProps = {
  onPointerDown: (event: PointerEvent<Element>) => void;
  onPointerMove: (event: PointerEvent<Element>) => void;
  onPointerUp: (event: PointerEvent<Element>) => void;
  onPointerCancel: (event: PointerEvent<Element>) => void;
  style: CSSProperties;
  'data-frameable-surface': '';
};

export type SelectionItemProps = {
  onPointerDownCapture: (event: PointerEvent<Element>) => void;
  'data-frameable-item': string;
  'data-frameable-selected'?: '';
};

type SurfaceUserProps = Partial<
  Pick<
    SelectionSurfaceProps,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'style'
  >
>;

type ItemUserProps = Partial<Pick<SelectionItemProps, 'onPointerDownCapture'>>;

export type UseSelectionResult = {
  selected: readonly string[];
  marquee: Frame | null;
  isSelected: (id: string) => boolean;
  clear: () => void;
  getSurfaceProps: <P extends SurfaceUserProps>(
    userProps?: P
  ) => Omit<P, keyof SelectionSurfaceProps> & SelectionSurfaceProps;
  getItemProps: <P extends ItemUserProps>(
    id: string,
    userProps?: P
  ) => Omit<P, keyof SelectionItemProps> & SelectionItemProps;
};

type Session = {
  id: string;
  pointerId: number;
  target: Element;
  matrix: Matrix;
  startScreen: Point;
  start: Point;
  base: readonly string[];
  active: boolean;
  down: Modifiers;
  latest: { point: Point; modifiers: Modifiers };
  removeKeyListener: () => void;
  raf: number;
};

const OWNED_ELEMENT = '[data-frameable-item], [data-frameable]';

let selectionCounter = 0;

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

type Handler<E> = ((event: E) => void) | undefined;

function compose<E extends { defaultPrevented: boolean }>(
  user: Handler<E>,
  ours: (event: E) => void
) {
  return (event: E) => {
    user?.(event);
    if (!event.defaultPrevented) ours(event);
  };
}

export function useSelection<T>(options: UseSelectionOptions<T>): UseSelectionResult {
  const contextSurface = useSurface();
  const latest = useLatest(options);
  const session = useRef<Session | null>(null);
  const [marquee, setMarquee] = useState<Frame | null>(null);

  const selectedSet = useMemo(() => new Set(options.selected), [options.selected]);

  const emit = useCallback(
    (s: Session, phase: TransactionPhase, selected: readonly string[], frame: Frame | null) => {
      latest.current.onTransaction?.({
        id: s.id,
        kind: 'select',
        phase,
        initial: s.base,
        selected,
        marquee: frame,
        modifiers: s.latest.modifiers,
        source: 'pointer',
      });
    },
    [latest]
  );

  const resolve = useCallback(
    (s: Session): { ids: string[]; frame: Frame } => {
      const { items, getFrame, mode } = latest.current;
      const getId =
        (latest.current as { getId?: (item: T) => string }).getId ??
        ((item: T) => (item as { id: string }).id);
      const frame = marqueeFrame(s.start, s.latest.point);
      const hits = selectInMarquee(items, frame, getFrame, mode).map(getId);
      return { ids: combineSelection(s.base, hits, s.latest.modifiers), frame };
    },
    [latest]
  );

  const commit = useCallback(
    (ids: string[]) => {
      if (!sameIds(ids, latest.current.selected)) latest.current.onChange(ids);
    },
    [latest]
  );

  const flush = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.raf = 0;
    const { ids, frame } = resolve(s);
    setMarquee(frame);
    commit(ids);
    emit(s, 'update', ids, frame);
  }, [resolve, commit, emit]);

  const finish = useCallback(
    (cancel: boolean) => {
      const s = session.current;
      if (!s) return;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.removeKeyListener();
      session.current = null;
      try {
        s.target.releasePointerCapture(s.pointerId);
      } catch {
        void 0;
      }
      setMarquee(null);
      let ids: string[];
      let frame: Frame | null = null;
      if (cancel) ids = [...s.base];
      else if (!s.active) ids = s.down.shift || s.down.alt ? [...s.base] : [];
      else {
        const resolved = resolve(s);
        ids = resolved.ids;
        frame = resolved.frame;
      }
      commit(ids);
      emit(s, cancel ? 'cancel' : 'end', ids, frame);
    },
    [commit, resolve, emit]
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<Element>) => {
      const { disabled, selected, surface, viewport, interactiveSelector } = latest.current;
      if (disabled || session.current || event.button !== 0) return;
      const target = event.target as Element;
      const owned = target.closest(OWNED_ELEMENT);
      if (owned && owned !== event.currentTarget && event.currentTarget.contains(owned)) return;
      const selector =
        interactiveSelector === undefined ? DEFAULT_INTERACTIVE : interactiveSelector;
      if (selector && target !== event.currentTarget && target.closest(selector)) return;
      event.preventDefault();
      const handle = surface?.current ?? (contextSurface.element() ? contextSurface : null);
      const matrix = handle
        ? handle.getMatrix()
        : measureSurface(event.currentTarget as HTMLElement, viewport);
      const startScreen = { x: event.clientX, y: event.clientY };
      const start = screenToSurface(startScreen, matrix);
      const modifiers = readModifiers(event);
      const onKey = (keyEvent: globalThis.KeyboardEvent) => {
        if (keyEvent.key === 'Escape') finish(true);
      };
      window.addEventListener('keydown', onKey);
      const s: Session = {
        id: `s${(selectionCounter += 1)}`,
        pointerId: event.pointerId,
        target: event.currentTarget,
        matrix,
        startScreen,
        start,
        base: selected,
        active: false,
        down: modifiers,
        latest: { point: start, modifiers },
        removeKeyListener: () => window.removeEventListener('keydown', onKey),
        raf: 0,
      };
      session.current = s;
      emit(s, 'start', selected, null);
    },
    [contextSurface, latest, finish, emit]
  );

  const track = useCallback(
    (s: Session, event: PointerEvent<Element>) => {
      s.latest = {
        point: screenToSurface({ x: event.clientX, y: event.clientY }, s.matrix),
        modifiers: readModifiers(event),
      };
      if (s.active) return;
      const threshold = latest.current.dragThreshold ?? 3;
      const moved = Math.hypot(event.clientX - s.startScreen.x, event.clientY - s.startScreen.y);
      if (moved < threshold) return;
      s.active = true;
      try {
        s.target.setPointerCapture(s.pointerId);
      } catch {
        void 0;
      }
    },
    [latest]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<Element>) => {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      track(s, event);
      if (s.active && !s.raf) s.raf = requestAnimationFrame(flush);
    },
    [track, flush]
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<Element>) => {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      track(s, event);
      finish(false);
    },
    [track, finish]
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<Element>) => {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      finish(true);
    },
    [finish]
  );

  useEffect(
    () => () => {
      const s = session.current;
      if (!s) return;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.removeKeyListener();
      session.current = null;
    },
    []
  );

  const getSurfaceProps = useCallback(
    <P extends SurfaceUserProps>(userProps?: P) => {
      const {
        onPointerDown: down,
        onPointerMove: move,
        onPointerUp: up,
        onPointerCancel: cancel,
        style,
        ...rest
      } = (userProps ?? {}) as SurfaceUserProps;
      return {
        ...rest,
        onPointerDown: compose(down, onPointerDown),
        onPointerMove: compose(move, onPointerMove),
        onPointerUp: compose(up, onPointerUp),
        onPointerCancel: compose(cancel, onPointerCancel),
        style: { ...style, touchAction: 'none' },
        'data-frameable-surface': '',
      } as Omit<P, keyof SelectionSurfaceProps> & SelectionSurfaceProps;
    },
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel]
  );

  const getItemProps = useCallback(
    <P extends ItemUserProps>(id: string, userProps?: P) => {
      const { onPointerDownCapture: user, ...rest } = (userProps ?? {}) as ItemUserProps;
      const select = (event: PointerEvent<Element>) => {
        const { disabled, selected, onChange } = latest.current;
        if (disabled || event.button !== 0) return;
        if (event.shiftKey) onChange(toggleSelection(selected, id));
        else if (!selectedSet.has(id)) onChange([id]);
      };
      return {
        ...rest,
        onPointerDownCapture: compose(user, select),
        'data-frameable-item': id,
        ...(selectedSet.has(id) ? { 'data-frameable-selected': '' as const } : {}),
      } as Omit<P, keyof SelectionItemProps> & SelectionItemProps;
    },
    [latest, selectedSet]
  );

  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);
  const clear = useCallback(() => latest.current.onChange([]), [latest]);

  return useMemo(
    () => ({
      selected: options.selected,
      marquee,
      isSelected,
      clear,
      getSurfaceProps,
      getItemProps,
    }),
    [options.selected, marquee, isSelected, clear, getSurfaceProps, getItemProps]
  );
}
