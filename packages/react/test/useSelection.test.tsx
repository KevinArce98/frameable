import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSelection } from '../src';
import type { Frame, SelectionTransaction } from '../src';

type Item = { id: string; frame: Frame };

const items: Item[] = [
  { id: 'a', frame: { x: 10, y: 10, width: 40, height: 40, rotation: 0 } },
  { id: 'b', frame: { x: 100, y: 10, width: 40, height: 40, rotation: 0 } },
  { id: 'c', frame: { x: 10, y: 100, width: 40, height: 40, rotation: 0 } },
];

function Harness({
  initialSelected = [],
  onTransaction,
  expose,
}: {
  initialSelected?: string[];
  onTransaction?: (t: SelectionTransaction) => void;
  expose?: (selected: readonly string[]) => void;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const sel = useSelection({
    items,
    selected,
    onChange: setSelected,
    getFrame: item => item.frame,
    ...(onTransaction ? { onTransaction } : {}),
  });
  expose?.(selected);
  return (
    <div data-testid="surface" {...sel.getSurfaceProps()}>
      {items.map(item => (
        <div key={item.id} data-testid={item.id} {...sel.getItemProps(item.id)} />
      ))}
      <output data-testid="marquee">{sel.marquee ? 'visible' : 'hidden'}</output>
    </div>
  );
}

function selectedIds(): string {
  return screen
    .getAllByTestId(/^[abc]$/)
    .filter(element => element.hasAttribute('data-frameable-selected'))
    .map(element => element.dataset.testid)
    .join(',');
}

const pointer = (clientX: number, clientY: number, extra: object = {}) => ({
  pointerId: 1,
  button: 0,
  clientX,
  clientY,
  ...extra,
});

describe('useSelection item clicks', () => {
  it('selects an item on pointer down', () => {
    render(<Harness />);
    fireEvent.pointerDown(screen.getByTestId('b'), pointer(0, 0));
    expect(selectedIds()).toBe('b');
  });

  it('toggles with shift', () => {
    render(<Harness initialSelected={['a']} />);
    fireEvent.pointerDown(screen.getByTestId('b'), pointer(0, 0, { shiftKey: true }));
    expect(selectedIds()).toBe('a,b');
    fireEvent.pointerDown(screen.getByTestId('a'), pointer(0, 0, { shiftKey: true }));
    expect(selectedIds()).toBe('b');
  });

  it('keeps a multi selection when pressing an already selected item', () => {
    render(<Harness initialSelected={['a', 'b']} />);
    fireEvent.pointerDown(screen.getByTestId('a'), pointer(0, 0));
    expect(selectedIds()).toBe('a,b');
  });
});

describe('useSelection marquee', () => {
  it('selects intersected items when the drag ends', () => {
    const onTransaction = vi.fn();
    render(<Harness onTransaction={onTransaction} />);
    const surface = screen.getByTestId('surface');
    fireEvent.pointerDown(surface, pointer(0, 0));
    fireEvent.pointerMove(surface, pointer(120, 60));
    fireEvent.pointerUp(surface, pointer(120, 60));
    expect(selectedIds()).toBe('a,b');
    const phases = onTransaction.mock.calls.map(([t]) => t.phase);
    expect(phases[0]).toBe('start');
    expect(phases[phases.length - 1]).toBe('end');
  });

  it('clears the selection on a plain background click', () => {
    render(<Harness initialSelected={['a']} />);
    const surface = screen.getByTestId('surface');
    fireEvent.pointerDown(surface, pointer(300, 300));
    fireEvent.pointerUp(surface, pointer(300, 300));
    expect(selectedIds()).toBe('');
  });

  it('keeps the selection on a shift click of the background', () => {
    render(<Harness initialSelected={['a']} />);
    const surface = screen.getByTestId('surface');
    fireEvent.pointerDown(surface, pointer(300, 300, { shiftKey: true }));
    fireEvent.pointerUp(surface, pointer(300, 300));
    expect(selectedIds()).toBe('a');
  });

  it('restores the previous selection on Escape', () => {
    const onTransaction = vi.fn();
    render(<Harness initialSelected={['c']} onTransaction={onTransaction} />);
    const surface = screen.getByTestId('surface');
    fireEvent.pointerDown(surface, pointer(0, 0));
    fireEvent.pointerMove(surface, pointer(120, 60));
    fireEvent.pointerUp(surface, pointer(120, 60));
    expect(selectedIds()).toBe('a,b');

    fireEvent.pointerDown(surface, pointer(0, 0));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(surface, pointer(120, 60));
    expect(selectedIds()).toBe('a,b');
    const last = onTransaction.mock.calls[onTransaction.mock.calls.length - 1]![0];
    expect(last.phase).toBe('cancel');
  });

  it('ignores presses that start on interactive children', () => {
    const onTransaction = vi.fn();
    render(<Harness onTransaction={onTransaction} />);
    const input = document.createElement('input');
    screen.getByTestId('surface').appendChild(input);
    fireEvent.pointerDown(input, pointer(0, 0));
    expect(onTransaction).not.toHaveBeenCalled();
  });
});
