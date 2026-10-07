import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Surface, snapToFrames, snapToGrid, useFrame } from '../src';
import type { Constraints, Frame, Snapper } from '../src';

const start: Frame = { x: 10, y: 10, width: 100, height: 50, rotation: 0 };

function Harness({
  snap,
  constraints,
  expose,
}: {
  snap?: Snapper | Snapper[];
  constraints?: Constraints;
  expose: (frame: Frame) => void;
}) {
  const [frame, setFrame] = useState(start);
  const f = useFrame({
    frame,
    onChange: setFrame,
    ...(snap ? { snap } : {}),
    ...(constraints ? { constraints } : {}),
  });
  expose(f.frame);
  return (
    <Surface>
      <div data-testid="box" {...f.getKeyboardProps()} {...f.getDragProps()}>
        <input data-testid="field" />
        <span data-testid="handle" {...f.getHandleProps('e')} />
      </div>
    </Surface>
  );
}

const pointer = (clientX: number, clientY: number, extra: object = {}) => ({
  pointerId: 1,
  button: 0,
  clientX,
  clientY,
  ...extra,
});

describe('useFrame', () => {
  beforeAll(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it('does not snap keyboard nudges back to the grid', () => {
    let frame = start;
    render(<Harness snap={snapToGrid(24)} expose={next => (frame = next)} />);
    fireEvent.keyDown(screen.getByTestId('box'), { key: 'ArrowRight' });
    expect(frame.x).toBe(11);
  });

  it('ignores key events from nested inputs', () => {
    let frame = start;
    render(<Harness expose={next => (frame = next)} />);
    fireEvent.keyDown(screen.getByTestId('field'), { key: 'ArrowRight' });
    expect(frame.x).toBe(10);
  });

  it('discards a snap that would break the minimum size', () => {
    const others: Frame[] = [{ x: 107, y: 0, width: 20, height: 10, rotation: 0 }];
    let frame = start;
    render(
      <Harness
        snap={snapToFrames(others)}
        constraints={{ minWidth: 100 }}
        expose={next => (frame = next)}
      />
    );
    const handle = screen.getByTestId('handle');
    fireEvent.pointerDown(handle, pointer(110, 20));
    fireEvent.pointerUp(handle, pointer(102, 20));
    expect(frame.width).toBe(100);
  });

  it('would have snapped that same resize without the minimum size', () => {
    const others: Frame[] = [{ x: 107, y: 0, width: 20, height: 10, rotation: 0 }];
    let frame = start;
    render(<Harness snap={snapToFrames(others)} expose={next => (frame = next)} />);
    const handle = screen.getByTestId('handle');
    fireEvent.pointerDown(handle, pointer(110, 20));
    fireEvent.pointerUp(handle, pointer(106, 20));
    expect(frame.x + frame.width).toBe(107);
  });

  it('snaps a resize when the result stays valid', () => {
    const others: Frame[] = [{ x: 200, y: 0, width: 50, height: 10, rotation: 0 }];
    let frame = start;
    render(<Harness snap={snapToFrames(others)} expose={next => (frame = next)} />);
    const handle = screen.getByTestId('handle');
    fireEvent.pointerDown(handle, pointer(110, 20));
    fireEvent.pointerUp(handle, pointer(198, 20));
    expect(frame.x + frame.width).toBe(200);
  });
});
