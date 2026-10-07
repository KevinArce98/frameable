import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { center, useGroup } from '../src';
import type { Frame, GroupTransaction, GroupUpdate, UseGroupResult } from '../src';

type Item = { id: string; frame: Frame };

const initial: Item[] = [
  { id: 'a', frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 } },
  { id: 'b', frame: { x: 200, y: 100, width: 60, height: 80, rotation: 0 } },
];

function Harness({
  start = initial,
  onTransaction,
  expose,
}: {
  start?: Item[];
  onTransaction?: (t: GroupTransaction) => void;
  expose: (group: UseGroupResult, items: Item[], setItems: (items: Item[]) => void) => void;
}) {
  const [items, setItems] = useState(start);
  const group = useGroup({
    items,
    getFrame: item => item.frame,
    onChange: (updates: GroupUpdate[]) =>
      setItems(list =>
        list.map(item => {
          const update = updates.find(candidate => candidate.id === item.id);
          return update ? { ...item, frame: update.frame } : item;
        })
      ),
    ...(onTransaction ? { onTransaction } : {}),
  });
  expose(group, items, setItems);
  return (
    <div data-testid="root" {...group.getKeyboardProps()}>
      <div data-testid="drag" {...group.getDragProps()} />
    </div>
  );
}

function setup(props: { start?: Item[]; onTransaction?: (t: GroupTransaction) => void } = {}) {
  const state = {} as {
    group: UseGroupResult;
    items: Item[];
    setItems: (items: Item[]) => void;
  };
  render(
    <Harness
      {...props}
      expose={(group, items, setItems) => {
        state.group = group;
        state.items = items;
        state.setItems = setItems;
      }}
    />
  );
  return { state, root: screen.getByTestId('root') };
}

const pointer = (clientX: number, clientY: number) => ({
  pointerId: 1,
  button: 0,
  clientX,
  clientY,
});

describe('useGroup', () => {
  beforeAll(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it('exposes the bounding frame of its items', () => {
    const { state } = setup();
    expect(state.group.frame).toEqual({ x: 0, y: 0, width: 260, height: 180, rotation: 0 });
  });

  it('has no frame for an empty selection', () => {
    const { state } = setup({ start: [] });
    expect(state.group.frame).toBeNull();
  });

  it('moves every member by a keyboard nudge and reports member changes', () => {
    const onTransaction = vi.fn();
    const { state, root } = setup({ onTransaction });
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(state.items.map(item => item.frame.x)).toEqual([1, 201]);
    const phases = onTransaction.mock.calls.map(([t]) => t.phase);
    expect(phases).toEqual(['start', 'update', 'end']);
    const end = onTransaction.mock.calls[2]![0] as GroupTransaction;
    expect(end.members.map(member => member.id)).toEqual(['a', 'b']);
    expect(end.members[0]!.initial.x).toBe(0);
    expect(end.members[0]!.frame.x).toBe(1);
  });

  it('keeps the rotation of the group after a rotate transaction', () => {
    const { state, root } = setup();
    const pivot = center(state.group.frame!);
    for (let step = 0; step < 3; step += 1) {
      fireEvent.keyDown(root, { key: ']', ctrlKey: true, shiftKey: true });
    }
    expect(state.group.frame!.rotation).toBeCloseTo(45, 6);
    const next = center(state.group.frame!);
    expect(next.x).toBeCloseTo(pivot.x, 6);
    expect(next.y).toBeCloseTo(pivot.y, 6);
  });

  it('falls back to an unrotated frame when the items change outside the group', () => {
    const { state, root } = setup();
    fireEvent.keyDown(root, { key: ']', ctrlKey: true, shiftKey: true });
    expect(state.group.frame!.rotation).toBeCloseTo(15, 6);
    act(() => {
      state.setItems(
        state.items.map(item =>
          item.id === 'a' ? { ...item, frame: { ...item.frame, x: item.frame.x + 50 } } : item
        )
      );
    });
    expect(state.group.frame!.rotation).toBe(0);
  });

  it('ignores key events that come from nested controls', () => {
    const onTransaction = vi.fn();
    render(<Harness onTransaction={onTransaction} expose={() => undefined} />);
    const root = screen.getByTestId('root');
    const input = document.createElement('input');
    root.appendChild(input);
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
    });
    expect(onTransaction).not.toHaveBeenCalled();
  });

  it('moves every member with a pointer drag', () => {
    const { state } = setup();
    const drag = screen.getByTestId('drag');
    fireEvent.pointerDown(drag, pointer(0, 0));
    fireEvent.pointerUp(drag, pointer(30, 10));
    expect(state.items.map(item => [item.frame.x, item.frame.y])).toEqual([
      [30, 10],
      [230, 110],
    ]);
  });

  it('does not rewrite members on a click without movement', () => {
    const onTransaction = vi.fn();
    const { state } = setup({ onTransaction });
    const before = state.items;
    const drag = screen.getByTestId('drag');
    fireEvent.pointerDown(drag, pointer(5, 5));
    fireEvent.pointerUp(drag, pointer(5, 5));
    expect(state.items).toBe(before);
  });

  it('restores the original members when the drag is cancelled', () => {
    const { state } = setup();
    const before = state.items;
    const drag = screen.getByTestId('drag');
    fireEvent.pointerDown(drag, pointer(0, 0));
    fireEvent.pointerMove(drag, pointer(40, 40));
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(state.items.map(item => item.frame)).toEqual(before.map(item => item.frame));
  });
});
