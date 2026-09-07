import { HANDLES, screenToSurface } from '@frameable/core'
import type { Frame, Snapper, Transaction } from '@frameable/core'
import { Surface, snapToGrid, toStyle, useFrame } from '@frameable/react'
import type { SurfaceHandle } from '@frameable/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent } from 'react'
import { CheckIcon, CopyIcon, FrameIcon, GithubIcon, ImageIcon, MinusIcon, PlusIcon, ResetIcon } from './icons'

type Kind = 'card' | 'image' | 'note'
type Item = { id: string; kind: Kind; name: string; frame: Frame }

const initialItems: Item[] = [
  { id: 'card', kind: 'card', name: 'Pricing card', frame: { x: 96, y: 96, width: 260, height: 190, rotation: 0 } },
  { id: 'image', kind: 'image', name: 'Cover image', frame: { x: 440, y: 150, width: 220, height: 220, rotation: 12 } },
  { id: 'note', kind: 'note', name: 'Sticky note', frame: { x: 200, y: 360, width: 240, height: 130, rotation: -6 } },
]

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function LayerContent({ item }: { item: Item }) {
  if (item.kind === 'image') {
    return (
      <div className="layer__body">
        <ImageIcon size={32} />
      </div>
    )
  }
  if (item.kind === 'note') {
    return (
      <div className="layer__body">
        <div className="layer__title">Sticky note</div>
        <p className="layer__text">Drag anywhere on the note. Rotate from the handle on top.</p>
      </div>
    )
  }
  return (
    <div className="layer__body">
      <div className="layer__title">Pricing card</div>
      <p className="layer__text">Inputs inside a frame keep working.</p>
      <input className="layer__input" placeholder="Type here, no drag starts" aria-label="Example input inside a frame" />
      <button type="button" className="layer__cta">
        Buttons too
      </button>
    </div>
  )
}

function Layer({
  item,
  selected,
  onSelect,
  onChange,
  onTransaction,
  snap,
  lockAspect,
}: {
  item: Item
  selected: boolean
  onSelect: (id: string) => void
  onChange: (id: string, frame: Frame) => void
  onTransaction: (t: Transaction) => void
  snap: Snapper | undefined
  lockAspect: boolean
}) {
  const change = useCallback((frame: Frame) => onChange(item.id, frame), [item.id, onChange])
  const f = useFrame({
    frame: item.frame,
    onChange: change,
    onTransaction,
    constraints: { minWidth: 48, minHeight: 48, ...(lockAspect ? { aspectRatio: 'preserve' as const } : {}) },
    ...(snap ? { snap } : {}),
    label: item.name,
  })
  const drag = f.getDragProps()
  const keyboard = f.getKeyboardProps()
  const live = f.transaction && f.transaction.phase === 'update' ? f.transaction : null

  let badge: ReactNode = null
  if (live?.kind === 'move') badge = `${Math.round(live.frame.x)}, ${Math.round(live.frame.y)}`
  if (live?.kind === 'resize') badge = `${Math.round(live.frame.width)} × ${Math.round(live.frame.height)}`
  if (live?.kind === 'rotate') badge = `${round(live.frame.rotation)}°`

  return (
    <div
      className={`layer layer--${item.kind}`}
      data-selected={selected}
      data-active={f.isActive}
      {...drag}
      {...keyboard}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        onSelect(item.id)
        drag.onPointerDown(event)
      }}
      style={{ ...toStyle(item.frame), ...drag.style }}
    >
      <LayerContent item={item} />
      {selected && HANDLES.map((handle) => <span key={handle} className="handle" {...f.getHandleProps(handle)} />)}
      {selected && <span className="rotate" {...f.getRotateProps()} />}
      {badge && (
        <span className="badge" style={{ transform: `translateX(-50%) rotate(${-item.frame.rotation}deg)` }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="toggle">
      <span className="toggle__label">
        <span>{label}</span>
        <span className="toggle__hint">{hint}</span>
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" />
      </span>
    </label>
  )
}

function NumberField({
  label,
  name,
  value,
  onChange,
  wide,
}: {
  label: string
  name: string
  value: number
  onChange: (value: number) => void
  wide?: boolean
}) {
  return (
    <label className={`field${wide ? ' field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      <input
        type="number"
        name={name}
        value={round(value, 1)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const next = Number(e.target.value)
          if (!Number.isNaN(next)) onChange(next)
        }}
      />
    </label>
  )
}

export function App() {
  const [items, setItems] = useState(initialItems)
  const [selected, setSelected] = useState<string | null>('card')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [cssZoom, setCssZoom] = useState(false)
  const [grid, setGrid] = useState(false)
  const [lockAspect, setLockAspect] = useState(false)
  const [log, setLog] = useState<Transaction[]>([])
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const surface = useRef<SurfaceHandle>(null)

  const snap = useMemo(() => (grid ? snapToGrid(24) : undefined), [grid])

  const onChange = useCallback((id: string, frame: Frame) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, frame } : item)))
  }, [])

  const onTransaction = useCallback((t: Transaction) => {
    if (t.phase === 'update') return
    setDragging(t.phase === 'start')
    setLog((lines) => [t, ...lines].slice(0, 6))
  }, [])

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * (event.deltaY < 0 ? 1.1 : 0.9))))
    } else {
      setPan((p) => ({ x: p.x - event.deltaX, y: p.y - event.deltaY }))
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const matrix = surface.current?.getMatrix()
    if (!matrix) return
    setPointer(screenToSurface({ x: event.clientX, y: event.clientY }, matrix))
  }

  const stepZoom = (direction: 1 | -1) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, round(z + direction * 0.25, 2))))

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText('npm i @frameable/react')
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const current = items.find((item) => item.id === selected)
  const updateCurrent = (patch: Partial<Frame>) => {
    if (current) onChange(current.id, { ...current.frame, ...patch })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            <FrameIcon size={16} />
          </span>
          <span className="brand__name">frameable</span>
          <span className="pill">v0.1</span>
          <span className="brand__tagline">You own the geometry. Frameable owns the math.</span>
        </div>
        <div className="topbar__actions">
          <div className="zoom" role="group" aria-label="Viewport zoom">
            <button type="button" className="btn btn--icon" onClick={() => stepZoom(-1)} aria-label="Zoom out">
              <MinusIcon />
            </button>
            <span className="zoom__value" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" className="btn btn--icon" onClick={() => stepZoom(1)} aria-label="Zoom in">
              <PlusIcon />
            </button>
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
              aria-label="Reset zoom and pan"
            >
              <ResetIcon />
            </button>
          </div>
          <a className="btn btn--icon" href="https://github.com" aria-label="Source on GitHub">
            <GithubIcon />
          </a>
          <button type="button" className="btn btn--primary topbar__cta" onClick={copyInstall}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            <code>npm i @frameable/react</code>
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <section className="section">
          <h2 className="section__title">Scenario</h2>
          <Toggle
            label="CSS zoom on the parent"
            hint="Applies zoom: 0.6 to the whole stage"
            checked={cssZoom}
            onChange={setCssZoom}
          />
          <Toggle label="Snap to grid" hint="24 unit grid, position and size" checked={grid} onChange={setGrid} />
          <Toggle
            label="Lock aspect ratio"
            hint="Same as holding shift while resizing"
            checked={lockAspect}
            onChange={setLockAspect}
          />
        </section>

        <section className="section">
          <h2 className="section__title">
            Frame
            {current && <span className="pill">{current.name}</span>}
          </h2>
          {current ? (
            <div className="fields">
              <NumberField label="X" name="x" value={current.frame.x} onChange={(x) => updateCurrent({ x })} />
              <NumberField label="Y" name="y" value={current.frame.y} onChange={(y) => updateCurrent({ y })} />
              <NumberField
                label="W"
                name="width"
                value={current.frame.width}
                onChange={(width) => updateCurrent({ width: Math.max(48, width) })}
              />
              <NumberField
                label="H"
                name="height"
                value={current.frame.height}
                onChange={(height) => updateCurrent({ height: Math.max(48, height) })}
              />
              <NumberField
                label="R°"
                name="rotation"
                value={current.frame.rotation}
                onChange={(rotation) => updateCurrent({ rotation })}
                wide
              />
            </div>
          ) : (
            <p className="empty">Select a layer to edit its frame. Every field writes straight to state.</p>
          )}
        </section>

        <section className="section">
          <h2 className="section__title">Transactions</h2>
          {log.length === 0 ? (
            <p className="empty">Drag, resize or rotate a layer to see the lifecycle here.</p>
          ) : (
            <ul className="log" aria-live="polite">
              {log.map((t) => (
                <li key={`${t.id}-${t.phase}`}>
                  <span className={`tag tag--${t.kind}`}>{t.kind}</span>
                  <span className={`tag tag--${t.phase}`}>{t.phase}</span>
                  <span>{t.source}</span>
                  {t.handle && <span>{t.handle}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <h2 className="section__title">Keyboard</h2>
          <dl className="shortcuts">
            <dt>
              <kbd>←</kbd>
              <kbd>→</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
            </dt>
            <dd>Nudge the focused layer by 1</dd>
            <dt>
              <kbd>shift</kbd>
            </dt>
            <dd>Nudge by 10, keep ratio, 15° steps</dd>
            <dt>
              <kbd>alt</kbd>
            </dt>
            <dd>Resize from the center</dd>
            <dt>
              <kbd>⌘</kbd>
              <kbd>[</kbd>
              <kbd>]</kbd>
            </dt>
            <dd>Rotate by 1°</dd>
            <dt>
              <kbd>esc</kbd>
            </dt>
            <dd>Cancel the current transaction</dd>
          </dl>
        </section>
      </aside>

      <main className="stage" style={cssZoom ? { zoom: 0.6 } : undefined} onWheel={onWheel} data-dragging={dragging}>
        <Surface
          ref={surface}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
          viewport={{ zoom, pan }}
          onPointerDown={() => setSelected(null)}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setPointer(null)}
        >
          <div className="viewport" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {items.map((item) => (
              <Layer
                key={item.id}
                item={item}
                selected={item.id === selected}
                onSelect={setSelected}
                onChange={onChange}
                onTransaction={onTransaction}
                snap={snap}
                lockAspect={lockAspect}
              />
            ))}
          </div>
        </Surface>
        <footer className="statusbar">
          <span>
            pointer <strong>{pointer ? `${Math.round(pointer.x)}, ${Math.round(pointer.y)}` : '—'}</strong>
          </span>
          <span>
            zoom <strong>{Math.round(zoom * 100)}%</strong>
          </span>
          <span>
            pan <strong>{`${Math.round(pan.x)}, ${Math.round(pan.y)}`}</strong>
          </span>
          {cssZoom && (
            <span>
              css zoom <strong>0.6</strong>
            </span>
          )}
          <span className="statusbar__hint">
            Scroll to pan · <kbd>ctrl</kbd> + scroll to zoom
          </span>
        </footer>
      </main>
    </div>
  )
}
