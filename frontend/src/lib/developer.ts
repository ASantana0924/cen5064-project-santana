// The "Acting as" name. There is no login (ADR-005), so the browser remembers
// who is acting and every action request sends that name as `developer`.

export const CURRENT_KEY = 'verifai.developer'
export const RECENT_KEY = 'verifai.recentDevelopers'
export const MAX_RECENT = 5

const CHANGE_EVENT = 'verifai:developer-change'

/** Returns the saved name, or an empty string when none is saved or storage is unavailable. */
export function getDeveloper(): string {
  try {
    return localStorage.getItem(CURRENT_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Returns up to MAX_RECENT names, most recent first. */
export function getRecentDevelopers(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === 'string').slice(0, MAX_RECENT)
      : []
  } catch {
    return []
  }
}

/** Saves the name as current and moves it to the front of the recent list. Blank names are ignored. */
export function setDeveloper(name: string): void {
  const trimmed = name.trim()
  if (trimmed === '') {
    return
  }
  const recent = [trimmed, ...getRecentDevelopers().filter((other) => other !== trimmed)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(CURRENT_KEY, trimmed)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  } catch {
    // Storage is full or blocked. The name still applies until the page reloads.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: trimmed }))
}

/** Calls the listener whenever the name changes in this tab or another tab. Returns an unsubscribe function. */
export function subscribeToDeveloper(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CURRENT_KEY || event.key === RECENT_KEY) {
      listener()
    }
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
