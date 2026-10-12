import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max: number
  label: string
  className?: string
}

/**
 * A row of segments, one per step, filled up to value. Used for passed checks
 * ("3 of 6") so each check reads as its own unit.
 */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const done = Math.min(Math.max(value, 0), max)
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${max}`}
      className={cn('flex items-center gap-2', className)}
    >
      <div className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={cn('h-2 w-3 rounded-[2px]', index < done ? 'bg-success' : 'bg-muted-foreground/20')}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {done}/{max}
      </span>
    </div>
  )
}
