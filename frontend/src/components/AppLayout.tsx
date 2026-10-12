import { Link, NavLink, Outlet } from 'react-router'
import { Plus, ShieldCheck } from 'lucide-react'

import { ActingAsPicker } from '@/components/ActingAsPicker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppLayout() {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck aria-hidden="true" className="size-5 text-info" />
            VerifAI
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2.5 py-1.5 text-sm transition-colors hover:text-foreground',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                )
              }
            >
              Tasks
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm">
              <Link to="/tasks/new">
                <Plus aria-hidden="true" />
                <span className="hidden sm:inline">New task</span>
                <span className="sr-only sm:hidden">New task</span>
              </Link>
            </Button>
            <ActingAsPicker />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
