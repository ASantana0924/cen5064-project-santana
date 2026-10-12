import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

import { getDeveloper, getRecentDevelopers, setDeveloper, subscribeToDeveloper } from './developer'

const getRecentJson = () => JSON.stringify(getRecentDevelopers())

/**
 * The current "Acting as" name and the recent names, kept in sync across
 * components and browser tabs.
 */
export function useDeveloper() {
  // If storage is blocked, this keeps the chosen name until the page reloads.
  const [fallback, setFallback] = useState('')
  const stored = useSyncExternalStore(subscribeToDeveloper, getDeveloper)
  const recentJson = useSyncExternalStore(subscribeToDeveloper, getRecentJson)
  const recentDevelopers = useMemo(() => JSON.parse(recentJson) as string[], [recentJson])

  const choose = useCallback((name: string) => {
    setFallback(name.trim())
    setDeveloper(name)
  }, [])

  return { developer: stored || fallback, recentDevelopers, setDeveloper: choose }
}
