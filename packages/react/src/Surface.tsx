'use client';
import { fromViewport, identity, multiply } from 'frameable-core';
import type { Matrix, Viewport } from 'frameable-core';
import { createContext, forwardRef, useContext, useImperativeHandle, useMemo, useRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';

export type SurfaceHandle = {
  getMatrix(): Matrix;
  element(): HTMLElement | null;
};

const SurfaceContext = createContext<SurfaceHandle | null>(null);

const fallback: SurfaceHandle = {
  getMatrix: () => identity,
  element: () => null,
};

export function useSurface(): SurfaceHandle {
  return useContext(SurfaceContext) ?? fallback;
}

export function measureSurface(
  element: HTMLElement | null,
  viewport: Viewport | undefined
): Matrix {
  if (!element) return viewport ? fromViewport(viewport) : identity;
  const rect = element.getBoundingClientRect();
  const sx = element.offsetWidth ? rect.width / element.offsetWidth : 1;
  const sy = element.offsetHeight ? rect.height / element.offsetHeight : 1;
  const base: Matrix = { a: sx, b: 0, c: 0, d: sy, e: rect.left, f: rect.top };
  return viewport ? multiply(base, fromViewport(viewport)) : base;
}

export type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  viewport?: Viewport;
  children?: ReactNode;
  style?: CSSProperties;
};

export const Surface = forwardRef(function Surface(
  { viewport, children, style, ...rest }: SurfaceProps,
  ref: Ref<SurfaceHandle>
) {
  const element = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const handle = useMemo<SurfaceHandle>(
    () => ({
      getMatrix: () => measureSurface(element.current, viewportRef.current),
      element: () => element.current,
    }),
    []
  );

  useImperativeHandle(ref, () => handle, [handle]);

  return (
    <SurfaceContext.Provider value={handle}>
      <div ref={element} style={{ position: 'relative', ...style }} {...rest}>
        {children}
      </div>
    </SurfaceContext.Provider>
  );
});
