import { useId } from 'react'
import { cn } from '@/lib/utils'

const PETALS = Array.from({ length: 12 }, (_, i) => (
  <ellipse key={i} cx="12" cy="4.6" rx="1.9" ry="3.4" transform={`rotate(${i * 30} 12 12)`} />
))

const SEEDS = [
  [12, 12],
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3
    return [12 + 2 * Math.cos(a), 12 + 2 * Math.sin(a)]
  }),
]

export function Logo({ className }: { className?: string }) {
  // The centre is cut out with a mask instead of painted with the page colour,
  // so the logo stays clean on any surface (sidebar, hover highlight, cards).
  const maskId = useId()
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('group/logo text-primary', className)}
      aria-hidden
    >
      <mask id={maskId}>
        <rect width="24" height="24" fill="white" />
        <circle cx="12" cy="12" r="4.4" fill="black" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <g className="origin-center transition-transform duration-700 ease-out [transform-box:fill-box] group-hover/logo:rotate-120 motion-reduce:transition-none">
          {PETALS}
        </g>
      </g>
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth={1.4} />
      {SEEDS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.7" />
      ))}
    </svg>
  )
}
