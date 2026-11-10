import type { CSSProperties } from 'react'
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * shadcn's Sonner wrapper. The app follows the system light or dark setting
 * (see index.css), so the toasts do too; there is no theme provider.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-info" />,
        warning: <TriangleAlert className="size-4" />,
        error: <CircleAlert className="size-4 text-destructive" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
