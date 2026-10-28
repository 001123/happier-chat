// Lesson drawings and diagrams draw their strokes in as they are revealed, like a hand sketching them.

/**
 * Lets the stroke of a shape draw in when it is revealed: the dash pattern needs its length, which is measured
 * rather than normalised with pathLength, since browsers do not all honour that on basic shapes. Strokes that are
 * already dashed only fade in.
 */
export function markDrawable(el: Element) {
  if (el.hasAttribute('data-draw') || el.hasAttribute('stroke-dasharray')) return
  const shape = el as SVGGeometryElement
  if (typeof shape.getTotalLength !== 'function') return
  const length = shape.getTotalLength()
  if (!length) return
  shape.style.setProperty('--len', length.toFixed(1))
  shape.setAttribute('data-draw', '')
}
