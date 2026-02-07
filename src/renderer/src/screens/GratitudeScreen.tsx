import { useState, useCallback } from 'react'
import ScreenShell from '../components/ScreenShell'
import { getEntries, addEntry, deleteEntry } from '../lib/gratitude'
import type { GratitudeEntry } from '../types/lyra'

interface GratitudeScreenProps {
  onBack: () => void
}

export default function GratitudeScreen({ onBack }: GratitudeScreenProps) {
  const [entries, setEntries] = useState<GratitudeEntry[]>(getEntries)
  const [newText, setNewText] = useState('')

  const handleAdd = useCallback(() => {
    if (!newText.trim()) return
    const entry = addEntry(newText.trim())
    setEntries((prev) => [entry, ...prev])
    setNewText('')
  }, [newText])

  const handleDelete = useCallback((id: string) => {
    deleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Group entries by date
  const grouped = entries.reduce<Record<string, GratitudeEntry[]>>((acc, entry) => {
    ;(acc[entry.date] ??= []).push(entry)
    return acc
  }, {})

  return (
    <ScreenShell>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3">
        <h1 className="text-sm font-semibold text-lyra-text">Gratitude journal</h1>
        <button
          onClick={onBack}
          className="text-xs text-lyra-text-muted hover:text-lyra-text
                     transition-colors duration-300
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent rounded px-2 py-1"
        >
          Back to Lyra
        </button>
      </div>

      {/* Add entry */}
      <div className="px-6 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Something that felt okay today..."
            className="flex-1 px-3 py-2 rounded-lg bg-lyra-surface text-sm text-lyra-text
                       placeholder:text-lyra-text-muted/50
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="px-4 py-2 rounded-lg bg-lyra-accent text-white text-sm font-medium
                       hover:opacity-90 transition-opacity duration-300
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {Object.keys(grouped).length === 0 && (
          <p className="text-sm text-lyra-text-muted text-center pt-8">
            No entries yet. Start by adding one above.
          </p>
        )}
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="animate-fade-in">
            <p className="text-xs text-lyra-text-muted font-medium mb-2">{formatDate(date)}</p>
            <div className="space-y-2">
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between px-3 py-2 rounded-lg bg-lyra-surface"
                >
                  <p className="text-sm text-lyra-text leading-relaxed">{entry.text}</p>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="ml-2 text-lyra-text-muted/50 hover:text-lyra-crisis
                               transition-colors flex-shrink-0 text-xs"
                    aria-label="Delete entry"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  )
}

function formatDate(iso: string): string {
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return 'Today'
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (iso === yesterday) return 'Yesterday'
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
