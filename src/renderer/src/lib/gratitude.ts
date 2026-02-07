import type { GratitudeEntry } from '../types/lyra'

const STORAGE_KEY = 'lyra-gratitude'

export function getEntries(): GratitudeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addEntry(text: string): GratitudeEntry {
  const entries = getEntries()
  const entry: GratitudeEntry = {
    id: crypto.randomUUID(),
    text,
    date: new Date().toISOString().slice(0, 10),
  }
  entries.unshift(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  return entry
}

export function deleteEntry(id: string): void {
  const entries = getEntries().filter((e) => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}
