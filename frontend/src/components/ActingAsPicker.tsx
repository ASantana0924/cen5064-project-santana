import { useState, type FormEvent } from 'react'
import { Check, ChevronDown, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDeveloper } from '@/lib/useDeveloper'
import { cn } from '@/lib/utils'

/** Header control for the "Acting as" name. The name is saved in the browser (ADR-005). */
export function ActingAsPicker() {
  const { developer, recentDevelopers, setDeveloper } = useDeveloper()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')

  function choose(name: string) {
    setDeveloper(name)
    setNewName('')
    setOpen(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (newName.trim() !== '') {
      choose(newName)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={developer ? `Acting as ${developer}` : 'Choose a name'}>
          <UserRound aria-hidden="true" />
          {developer ? (
            <span className="max-w-28 truncate sm:max-w-48">
              <span className="hidden text-muted-foreground sm:inline">Acting as </span>
              {developer}
            </span>
          ) : (
            <span>
              Choose <span className="hidden sm:inline">a </span>name
            </span>
          )}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <p className="text-sm text-muted-foreground">
          Your name is recorded on every action. There is no login.
        </p>
        {recentDevelopers.length > 0 && (
          <ul aria-label="Recent names" className="space-y-0.5">
            {recentDevelopers.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => choose(name)}
                  aria-current={name === developer ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    name === developer && 'font-medium',
                  )}
                >
                  {name}
                  {name === developer && <Check aria-hidden="true" className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={onSubmit} className="space-y-2">
          <Label htmlFor="acting-as-name">{recentDevelopers.length > 0 ? 'Another name' : 'Your name'}</Label>
          <div className="flex gap-2">
            <Input
              id="acting-as-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoComplete="off"
              placeholder="e.g. alex"
            />
            <Button type="submit" size="sm" className="h-9" disabled={newName.trim() === ''}>
              Use
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
