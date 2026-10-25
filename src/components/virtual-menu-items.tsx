import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

// First guess for a row; real heights are measured, because they follow the UI scale setting.
const ROW_HEIGHT = 36
// Short lists render plainly: virtualizing them would only add moving parts.
const VIRTUALIZE_FROM = 50

/** Spread onto each row's `<li>` so the virtualizer can measure it. */
export type RowProps = { ref: (element: HTMLElement | null) => void; 'data-index': number }

/**
 * Renders sidebar menu items, windowed against the sidebar's own scroll area once the list is long.
 * `render` must return one `<li>` per item, keyed by `getKey` and spreading `rowProps` when given.
 */
export function VirtualMenuItems<T>({
  items,
  getKey,
  render,
}: {
  items: Array<T>
  getKey: (item: T) => string
  render: (item: T, rowProps?: RowProps) => React.ReactNode
}) {
  if (items.length < VIRTUALIZE_FROM) return items.map((item) => render(item))
  return <Windowed items={items} getKey={getKey} render={render} />
}

function Windowed<T>({ items, getKey, render }: { items: Array<T>; getKey: (item: T) => string; render: (item: T, rowProps?: RowProps) => React.ReactNode }) {
  const anchor = React.useRef<HTMLLIElement>(null)
  const [scroller, setScroller] = React.useState<HTMLElement | null>(null)
  const [margin, setMargin] = React.useState(0)

  React.useLayoutEffect(() => {
    const el = anchor.current
    if (!el) return
    const parent = el.closest<HTMLElement>('[data-sidebar="content"]')
    if (parent !== scroller) setScroller(parent)
    // Where this list starts inside the scroll area; groups above it can open and close, so measure on every render.
    if (parent) {
      const offset = el.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop
      if (Math.abs(offset - margin) > 0.5) setMargin(offset)
    }
  })

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW_HEIGHT,
    scrollMargin: margin,
    overscan: 10,
    getItemKey: (index) => getKey(items[index]),
  })
  const visible = virtualizer.getVirtualItems()

  return (
    <li ref={anchor} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      <ul
        className="absolute inset-x-0 top-0 flex flex-col"
        style={{ transform: `translateY(${(visible[0]?.start ?? margin) - margin}px)` }}
      >
        {visible.map((row) => render(items[row.index], { ref: virtualizer.measureElement, 'data-index': row.index }))}
      </ul>
    </li>
  )
}
