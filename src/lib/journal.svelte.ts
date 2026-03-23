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
const MIGRATION_KEY = "mindDojoJournalMigratedToMd"

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Convert HTML to basic markdown for migration */
function htmlToMarkdown(html: string): string {
    if (!html || !html.includes('<')) return html // already plain text/markdown
    let md = html
    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    // Bold, italic, strike
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    md = md.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
    // Code
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n')
    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Lists
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n')
    // Blockquote
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) =>
        content.split('\n').map((l: string) => `> ${l}`).join('\n') + '\n'
    )
    // HR
    md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n')
    // Paragraphs and breaks
    md = md.replace(/<br[^>]*\/?>/gi, '\n')
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Strip remaining tags
    md = md.replace(/<[^>]*>/g, '')
    // Decode entities
    md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    // Clean up whitespace
    md = md.replace(/\n{3,}/g, '\n\n').trim()
    return md
}

function loadEntries(): JournalEntry[] {
    if (!browser) return []
    try {
        const entries: JournalEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
        // Auto-migrate HTML entries to markdown (one-time)
        if (!localStorage.getItem(MIGRATION_KEY) && entries.length > 0) {
            let migrated = false
            for (const entry of entries) {
                if (entry.text && entry.text.includes('<')) {
                    entry.text = htmlToMarkdown(entry.text)
                    migrated = true
                }
            }
            if (migrated) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
            }
            localStorage.setItem(MIGRATION_KEY, '1')
        }
        return entries
    } catch {
        return []
    }
}

function saveEntries(entries: JournalEntry[]) {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

const VAULT_PATH_KEY = "mindDojoVaultPath"

function getVaultPath(): string | null {
    if (!browser) return null
    return localStorage.getItem(VAULT_PATH_KEY)
}

/** Build a filename for a journal entry: YYYY-MM-DD-HHmmss-id.md */
function entryFilename(entry: JournalEntry): string {
    const d = new Date(entry.timestamp)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const time = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
    return `${date}-${time}-${entry.id}.md`
}

/** Build markdown file content with YAML frontmatter */
function entryToMarkdownFile(entry: JournalEntry): string {
    const lines: string[] = ['---']
    lines.push(`id: "${entry.id}"`)
    lines.push(`type: "${entry.type}"`)
    lines.push(`date: "${new Date(entry.timestamp).toISOString()}"`)
    if (entry.tags.length > 0) {
        lines.push(`tags: [${entry.tags.map(t => `"${t}"`).join(', ')}]`)
    }
    if (entry.sessionStats) {
        lines.push(`session:`)
        lines.push(`  correct: ${entry.sessionStats.correct}`)
        lines.push(`  errors: ${entry.sessionStats.errors}`)
        lines.push(`  accuracy: ${entry.sessionStats.accuracy}`)
        lines.push(`  bestCombo: ${entry.sessionStats.bestCombo}`)
        lines.push(`  wordsTyped: ${entry.sessionStats.wordsTyped}`)
    }
    lines.push('---')
    lines.push('')
    lines.push(entry.text)
    return lines.join('\n')
}

/** Parse a markdown file with frontmatter back into a JournalEntry */
function parseMarkdownFile(content: string, filename: string): JournalEntry | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!fmMatch) return null

    const fm = fmMatch[1]
    const text = fmMatch[2].trim()

    const getId = fm.match(/id:\s*"([^"]+)"/)
    const getType = fm.match(/type:\s*"([^"]+)"/)
    const getDate = fm.match(/date:\s*"([^"]+)"/)
    const getTags = fm.match(/tags:\s*\[([^\]]*)\]/)

    const id = getId?.[1] || filename.replace('.md', '')
    const type = (getType?.[1] as 'session' | 'free') || 'free'
    const timestamp = getDate ? new Date(getDate[1]).getTime() : Date.now()
    const tags = getTags ? getTags[1].split(',').map(t => t.trim().replace(/"/g, '')).filter(Boolean) : []

    let sessionStats: JournalEntry['sessionStats']
    const sessionMatch = fm.match(/session:\n([\s\S]*?)(?=\n\w|\n---|\n$|$)/)
    if (sessionMatch) {
        const s = sessionMatch[1]
        const correct = parseInt(s.match(/correct:\s*(\d+)/)?.[1] || '0')
        const errors = parseInt(s.match(/errors:\s*(\d+)/)?.[1] || '0')
        const accuracy = parseInt(s.match(/accuracy:\s*(\d+)/)?.[1] || '0')
        const bestCombo = parseInt(s.match(/bestCombo:\s*(\d+)/)?.[1] || '0')
        const wordsTyped = parseInt(s.match(/wordsTyped:\s*(\d+)/)?.[1] || '0')
        sessionStats = { correct, errors, accuracy, bestCombo, wordsTyped }
    }

    return { id, type, text, tags, timestamp, sessionStats }
}

export class Journal {
    entries: JournalEntry[] = $state(loadEntries())
    vaultPath: string | null = $state(getVaultPath())

    /** Call after construction to load vault entries (async) */
    async init() {
        if (this.vaultPath) await this.loadFromVault()
    }

    get hasElectron(): boolean {
        return typeof window !== 'undefined' && !!window.electronAPI
    }

    async pickVaultDirectory(): Promise<string | null> {
        if (!this.hasElectron) return null
        const dir = await window.electronAPI!.pickDirectory()
        if (dir) {
            this.vaultPath = dir
            localStorage.setItem(VAULT_PATH_KEY, dir)
            await this.syncToVault() // Write all existing entries to vault
        }
        return dir
    }

    clearVaultPath() {
        this.vaultPath = null
        localStorage.removeItem(VAULT_PATH_KEY)
    }

    /** Save a single entry to vault as .md file */
    private async saveToVault(entry: JournalEntry) {
        if (!this.vaultPath || !this.hasElectron) return
        const filePath = `${this.vaultPath}/${entryFilename(entry)}`
        await window.electronAPI!.writeFile(filePath, entryToMarkdownFile(entry))
    }

    /** Delete an entry's .md file from vault */
    private async deleteFromVault(entry: JournalEntry) {
        if (!this.vaultPath || !this.hasElectron) return
        const filePath = `${this.vaultPath}/${entryFilename(entry)}`
        await window.electronAPI!.deleteFile(filePath)
    }

    /** Write all entries to vault */
    async syncToVault() {
        if (!this.vaultPath || !this.hasElectron) return
        for (const entry of this.entries) {
            await this.saveToVault(entry)
        }
    }

    /** Load entries from vault, merging with localStorage */
    async loadFromVault() {
        if (!this.vaultPath || !this.hasElectron) return
        const result = await window.electronAPI!.readDir(this.vaultPath)
        if (!result.ok || !result.files) return

        const existingIds = new Set(this.entries.map(e => e.id))
        let added = false

        for (const file of result.files) {
            const fileResult = await window.electronAPI!.readFile(`${this.vaultPath}/${file}`)
            if (!fileResult.ok || !fileResult.content) continue
            const entry = parseMarkdownFile(fileResult.content, file)
            if (!entry) continue
            if (existingIds.has(entry.id)) {
                // Update existing entry from vault (vault is source of truth when edited externally)
                const existing = this.entries.find(e => e.id === entry.id)
                if (existing) {
                    existing.text = entry.text
                    existing.tags = entry.tags
                }
            } else {
                this.entries.push(entry)
                existingIds.add(entry.id)
                added = true
            }
        }

        if (added) {
            this.entries.sort((a, b) => b.timestamp - a.timestamp)
        }
        saveEntries(this.entries)
    }

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
        this.saveToVault(entry)
        return entry
    }

    updateEntry(id: string, text: string, tags: string[]) {
        const entry = this.entries.find(e => e.id === id)
        if (entry) {
            entry.text = text
            entry.tags = tags
            saveEntries(this.entries)
            this.saveToVault(entry)
        }
    }

    deleteEntry(id: string) {
        const entry = this.entries.find(e => e.id === id)
        if (entry) this.deleteFromVault(entry)
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
