'use client';
import { applyToGroup, framesEqual, groupBounds } from 'frameable-core';
import type { Frame, Transaction } from 'frameable-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from './useFrame';
import type { FrameController, UseFrameOptions, UseFrameResult } from './useFrame';
import { useLatest } from './useLatest';

export type GroupUpdate = { id: string; frame: Frame };

export type GroupMemberChange = { id: string; initial: Frame; frame: Frame };

export type GroupTransaction = Transaction & { members: GroupMemberChange[] };

type GroupOptionsBase<T> = Omit<UseFrameOptions, 'frame' | 'onChange' | 'onTransaction'> & {
  items: readonly T[];
  getFrame: (item: T) => Frame;
  onChange: (updates: GroupUpdate[]) => void;
  onTransaction?: (transaction: GroupTransaction) => void;
};

export type UseGroupOptions<T> = GroupOptionsBase<T> &
  ([T] extends [{ id: string }] ? { getId?: (item: T) => string } : { getId: (item: T) => string });

export type UseGroupResult = Omit<UseFrameResult, 'frame'> & {
  frame: Frame | null;
  getTransformerProps: () => { controller: FrameController };
};

type Member = { id: string; frame: Frame };

type Origin = { members: Member[]; group: Frame; dirty: boolean };

const EMPTY_FRAME: Frame = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

const SETTLE_EPSILON = 1e-6;

function sameMembers(a: readonly Member[], b: readonly Member[]): boolean {
  return (
    a.length === b.length &&
    a.every((member, index) => {
      const other = b[index] as Member;
      const x = member.frame;
      const y = other.frame;
      return (
        member.id === other.id &&
        x.x === y.x &&
        x.y === y.y &&
        x.width === y.width &&
        x.height === y.height &&
        x.rotation === y.rotation
      );
    })
  );
}

function changesFor(members: readonly Member[], frames: readonly Frame[]): GroupMemberChange[] {
  return members.map((member, index) => ({
    id: member.id,
    initial: member.frame,
    frame: frames[index] as Frame,
  }));
}

export function useGroup<T>(options: UseGroupOptions<T>): UseGroupResult {
  const latest = useLatest(options);
  const {
    items,
    getFrame,
    getId: customGetId,
    onChange: ignoredOnChange,
    onTransaction: ignoredOnTransaction,
    ...frameOptions
  } = options as GroupOptionsBase<T> & { getId?: (item: T) => string };
  void ignoredOnChange;
  void ignoredOnTransaction;
  const getId = customGetId ?? ((item: T) => (item as { id: string }).id);

  const stableMembers = useRef<Member[]>([]);
  const nextMembers = items.map(item => ({ id: getId(item), frame: getFrame(item) }));
  if (!sameMembers(stableMembers.current, nextMembers)) stableMembers.current = nextMembers;
  const members = stableMembers.current;
  const membersRef = useLatest(members);

  const [settled, setSettled] = useState<{ rotation: number; frames: Frame[] } | null>(null);
  const [live, setLive] = useState<Frame | null>(null);
  const origin = useRef<Origin | null>(null);

  const rotation =
    settled &&
    settled.frames.length === members.length &&
    members.every((member, index) =>
      framesEqual(member.frame, settled.frames[index] as Frame, SETTLE_EPSILON)
    )
      ? settled.rotation
      : 0;

  const bounds = useMemo(
    () =>
      groupBounds(
        members.map(member => member.frame),
        rotation
      ),
    [members, rotation]
  );
  const frame = live ?? bounds;

  const handleChange = useCallback(
    (next: Frame) => {
      const current = origin.current;
      if (!current) return;
      if (!current.dirty && framesEqual(next, current.group)) return;
      current.dirty = true;
      setLive(next);
      const frames = applyToGroup(
        current.members.map(member => member.frame),
        current.group,
        next
      );
      latest.current.onChange(
        current.members.map((member, index) => ({ id: member.id, frame: frames[index] as Frame }))
      );
    },
    [latest]
  );

  const handleTransaction = useCallback(
    (transaction: Transaction) => {
      if (transaction.phase === 'start') {
        origin.current = { members: membersRef.current, group: transaction.initial, dirty: false };
      }
      const current = origin.current;
      if (!current) return;
      const frames =
        transaction.phase === 'start'
          ? current.members.map(member => member.frame)
          : applyToGroup(
              current.members.map(member => member.frame),
              current.group,
              transaction.frame
            );
      if (transaction.phase === 'end' || transaction.phase === 'cancel') {
        if (transaction.phase === 'end' && current.dirty) {
          setSettled({ rotation: transaction.frame.rotation, frames });
        }
        origin.current = null;
        setLive(null);
      }
      latest.current.onTransaction?.({
        ...transaction,
        members: changesFor(current.members, frames),
      });
    },
    [latest, membersRef]
  );

  const result = useFrame({
    ...frameOptions,
    frame: frame ?? EMPTY_FRAME,
    disabled: frameOptions.disabled || frame === null,
    onChange: handleChange,
    onTransaction: handleTransaction,
  });

  const idsKey = members.map(member => member.id).join('\u0000');
  const { cancel } = result;
  useEffect(() => () => cancel(), [idsKey, cancel]);

  const controller = useMemo<FrameController>(() => ({ ...result, frame }), [result, frame]);
  const getTransformerProps = useCallback(() => ({ controller }), [controller]);

  return useMemo(() => ({ ...controller, getTransformerProps }), [controller, getTransformerProps]);
}
