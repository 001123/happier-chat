import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/**
 * Windows the rows of a native `<table>` inside its own scroll box. Rows keep normal table layout (sticky
 * header and pinned columns keep working); the rows left out are replaced by two spacer rows of the right height.
 * Spread `measureElement`/`data-index` onto each rendered `<tr>` so real heights are used.
 */
export function useVirtualRows({
  count,
  scrollRef,
  estimateSize = 56,
}: {
  count: number
  scrollRef: React.RefObject<HTMLElement | null>
  estimateSize?: number
}) {
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: 12,
  })
  const items = virtualizer.getVirtualItems()
  const paddingTop = items.length > 0 ? items[0].start : 0
  const paddingBottom = items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0
  return { items, paddingTop, paddingBottom, measureElement: virtualizer.measureElement }
}
