import { browser } from "$app/environment"

export interface JournalEntry {
    id: string
    type: 'session' | 'free'
    text: string
    sessionStats?: {
        correct: number
        errors: number
        accuracy: number
        bestCombo: number
        wordsTyped: number
    }
    tags: string[]
    timestamp: number
}

const STORAGE_KEY = "mindDojoJournal"

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function loadEntries(): JournalEntry[] {
    if (!browser) return []
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    } catch {
        return []
    }
}

function saveEntries(entries: JournalEntry[]) {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export class Journal {
    entries: JournalEntry[] = $state(loadEntries())

    createEntry(type: 'session' | 'free', text: string, _chargedWords: string[] = [], sessionStats?: JournalEntry['sessionStats']): JournalEntry {
        const entry: JournalEntry = {
            id: generateId(),
            type,
            text,
            sessionStats,
            tags: [],
            timestamp: Date.now(),
        }
        this.entries.unshift(entry)
        saveEntries(this.entries)
        return entry
    }

    updateEntry(id: string, text: string, tags: string[]) {
        const entry = this.entries.find(e => e.id === id)
        if (entry) {
            entry.text = text
            entry.tags = tags
            saveEntries(this.entries)
        }
    }

    deleteEntry(id: string) {
        this.entries = this.entries.filter(e => e.id !== id)
        saveEntries(this.entries)
    }

    getEntriesByDay(): { date: string; label: string; entries: JournalEntry[] }[] {
        const dayMap = new Map<string, JournalEntry[]>()
        for (const entry of this.entries) {
            const d = new Date(entry.timestamp)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const existing = dayMap.get(key) || []
            existing.push(entry)
            dayMap.set(key, existing)
        }

        return [...dayMap.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, entries]) => ({
                date,
                label: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                entries: entries.sort((a, b) => b.timestamp - a.timestamp),
            }))
    }

    search(query: string): JournalEntry[] {
        const q = query.toLowerCase().trim()
        if (!q) return this.entries
        return this.entries.filter(e =>
            e.text.toLowerCase().includes(q) ||
            e.tags.some(t => t.toLowerCase().includes(q))
        )
    }
}
