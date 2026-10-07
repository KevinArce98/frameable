'use client';
import { HANDLES, toStyle } from 'frameable-core';
import type { Frame, Guide, Handle } from 'frameable-core';
import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useFrame } from './useFrame';
import type { FrameController, UseFrameOptions } from './useFrame';

type TransformerChrome = {
  handles?: readonly Handle[] | undefined;
  rotate?: boolean | undefined;
  draggable?: boolean | undefined;
  zoom?: number | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
};

type StandaloneProps = Omit<UseFrameOptions, 'frame'> & {
  frame: Frame | null;
  controller?: undefined;
  onGuidesChange?: (guides: Guide[]) => void;
};

type ControlledProps = { controller: FrameController; frame?: undefined };

export type TransformerProps = TransformerChrome & (StandaloneProps | ControlledProps);

const EMPTY_FRAME: Frame = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

function TransformerView({
  controller,
  handles = HANDLES,
  rotate = true,
  draggable = true,
  zoom = 1,
  className,
  style,
  children,
}: TransformerChrome & { controller: FrameController }) {
  if (!controller.frame) return null;
  const drag = controller.getDragProps();
  const rotateProps = controller.getRotateProps();
  const classes = ['frameable-transformer', className].filter(Boolean).join(' ');

  return (
    <div
      {...controller.getKeyboardProps()}
      {...(draggable ? drag : {})}
      className={classes}
      data-active={controller.isActive ? '' : undefined}
      style={{
        ...toStyle(controller.frame),
        ...(draggable ? drag.style : { pointerEvents: 'none' }),
        ...({ '--frameable-zoom': zoom } as CSSProperties),
        ...style,
      }}
    >
      {handles.map(handle => {
        const props = controller.getHandleProps(handle);
        return (
          <span
            key={handle}
            {...props}
            aria-hidden="true"
            className={`frameable-handle frameable-handle--${handle}`}
            style={{ ...props.style, pointerEvents: 'auto' }}
          />
        );
      })}
      {rotate && (
        <span
          {...rotateProps}
          aria-hidden="true"
          className="frameable-rotate"
          style={{ ...rotateProps.style, pointerEvents: 'auto' }}
        />
      )}
      {children}
    </div>
  );
}

function StandaloneTransformer({
  frame,
  onGuidesChange,
  chrome,
  ...frameOptions
}: Omit<StandaloneProps, 'controller'> & { chrome: TransformerChrome }) {
  const result = useFrame({
    ...frameOptions,
    frame: frame ?? EMPTY_FRAME,
    disabled: frameOptions.disabled || frame === null,
  });
  const { guides } = result;

  useEffect(() => {
    onGuidesChange?.(guides);
  }, [guides, onGuidesChange]);

  useEffect(
    () => () => {
      onGuidesChange?.([]);
    },
    [onGuidesChange]
  );

  return <TransformerView controller={{ ...result, frame }} {...chrome} />;
}

export function Transformer(props: TransformerProps) {
  const { handles, rotate, draggable, zoom, className, style, children, ...rest } = props;
  const chrome: TransformerChrome = {
    handles,
    rotate,
    draggable,
    zoom,
    className,
    style,
    children,
  };
  if (rest.controller) return <TransformerView controller={rest.controller} {...chrome} />;
  return <StandaloneTransformer {...(rest as StandaloneProps)} chrome={chrome} />;
}
