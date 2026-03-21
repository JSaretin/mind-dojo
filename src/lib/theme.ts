import { browser } from "$app/environment"

export interface Theme {
    name: string
    key: string
    bg: string
    surface: string
    surfaceHover: string
    border: string
    text: string
    textMuted: string
    accent: string
    accentMuted: string
    letterActive: string
    letterGlow: string
    letterTyped: string
    letterUntyped: string
}

export const themes: Theme[] = [
    {
        name: 'Dark',
        key: 'dark',
        bg: '#0a0a0a',
        surface: '#171717',
        surfaceHover: '#262626',
        border: '#262626',
        text: '#e5e5e5',
        textMuted: '#737373',
        accent: '#f59e0b',
        accentMuted: 'rgba(245,158,11,0.15)',
        letterActive: '#fef3c7',
        letterGlow: 'rgba(251,191,36,0.4)',
        letterTyped: '#525252',
        letterUntyped: '#404040',
    },
    {
        name: 'Midnight',
        key: 'midnight',
        bg: '#0c0a1a',
        surface: '#13112a',
        surfaceHover: '#1e1b3a',
        border: '#2a2650',
        text: '#e0dff0',
        textMuted: '#6b6890',
        accent: '#818cf8',
        accentMuted: 'rgba(129,140,248,0.15)',
        letterActive: '#e0e7ff',
        letterGlow: 'rgba(129,140,248,0.4)',
        letterTyped: '#4b4870',
        letterUntyped: '#3a3760',
    },
    {
        name: 'Ember',
        key: 'ember',
        bg: '#120c08',
        surface: '#1c1410',
        surfaceHover: '#2a1f18',
        border: '#3a2a1e',
        text: '#f5e6d3',
        textMuted: '#8a7260',
        accent: '#f97316',
        accentMuted: 'rgba(249,115,22,0.15)',
        letterActive: '#ffedd5',
        letterGlow: 'rgba(249,115,22,0.4)',
        letterTyped: '#5c4a3a',
        letterUntyped: '#4a3828',
    },
    {
        name: 'Forest',
        key: 'forest',
        bg: '#080e0a',
        surface: '#0f1a12',
        surfaceHover: '#182618',
        border: '#1e3320',
        text: '#d5e8d8',
        textMuted: '#5a7a5e',
        accent: '#22c55e',
        accentMuted: 'rgba(34,197,94,0.15)',
        letterActive: '#dcfce7',
        letterGlow: 'rgba(34,197,94,0.4)',
        letterTyped: '#2d4a32',
        letterUntyped: '#1e3822',
    },
    {
        name: 'Light',
        key: 'light',
        bg: '#fafaf9',
        surface: '#ffffff',
        surfaceHover: '#f5f5f4',
        border: '#e7e5e4',
        text: '#1c1917',
        textMuted: '#78716c',
        accent: '#d97706',
        accentMuted: 'rgba(217,119,6,0.1)',
        letterActive: '#92400e',
        letterGlow: 'rgba(217,119,6,0.3)',
        letterTyped: '#d6d3d1',
        letterUntyped: '#e7e5e4',
    },
]

export function loadTheme(): string {
    if (!browser) return 'dark'
    return localStorage.getItem('mindDojoTheme') || 'dark'
}

export function saveTheme(key: string) {
    if (!browser) return
    localStorage.setItem('mindDojoTheme', key)
}

export function applyTheme(key: string) {
    if (!browser) return
    const theme = themes.find(t => t.key === key) || themes[0]
    const root = document.documentElement
    root.style.setProperty('--theme-bg', theme.bg)
    root.style.setProperty('--theme-surface', theme.surface)
    root.style.setProperty('--theme-surface-hover', theme.surfaceHover)
    root.style.setProperty('--theme-border', theme.border)
    root.style.setProperty('--theme-text', theme.text)
    root.style.setProperty('--theme-text-muted', theme.textMuted)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-accent-muted', theme.accentMuted)
    root.style.setProperty('--theme-letter-active', theme.letterActive)
    root.style.setProperty('--theme-letter-glow', theme.letterGlow)
    root.style.setProperty('--theme-letter-typed', theme.letterTyped)
    root.style.setProperty('--theme-letter-untyped', theme.letterUntyped)
    saveTheme(key)
}
