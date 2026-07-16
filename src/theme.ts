// ─── OneLyf Design System — theme runtime ──────────────────────────────────
// Turns the light/dark token pairs in tokens.ts into CSS custom properties,
// plus the mode state (light / dark / system) apps toggle at runtime. Apps
// inject `themeStylesheet` once (a <style> tag or a build-time import) and
// call `initTheme()` on load; `cssVar`/`shadowVar` give components a
// theme-reactive value to read instead of a literal hex from `color`.
import { color, colorDark, shadow, shadowDark } from './tokens'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'onelyf-theme'
const VAR_PREFIX = '--ds-'
const DEFAULT_MODE: ThemeMode = 'dark'

// Broadcast so every mounted ThemeToggle (or other mode-reading component)
// stays in sync — without this, a second toggle instance on the same page
// (e.g. header + settings) never learns of a change made via the first one
// until it remounts, and its next click computes `next` off its own stale
// mode.
export const THEME_CHANGE_EVENT = 'onelyf-theme-change'

const toKebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

function colorVarLines(palette: Record<string, string>): string {
  return Object.entries(palette)
    .map(([k, v]) => `  ${VAR_PREFIX}${toKebab(k)}: ${v};`)
    .join('\n')
}
function shadowVarLines(palette: Record<string, string>): string {
  return Object.entries(palette)
    .map(([k, v]) => `  ${VAR_PREFIX}shadow-${toKebab(k)}: ${v};`)
    .join('\n')
}

// Theme-reactive references: `cssVar.bg` → `var(--ds-bg)`. Import these
// instead of `color.xxx` in anything that should follow the active theme.
export const cssVar = Object.fromEntries(
  Object.keys(color).map((k) => [k, `var(${VAR_PREFIX}${toKebab(k)})`]),
) as Record<keyof typeof color, string>

export const shadowVar = Object.fromEntries(
  Object.keys(shadow).map((k) => [k, `var(${VAR_PREFIX}shadow-${toKebab(k)})`]),
) as Record<keyof typeof shadow, string>

// Light values are the unguarded `:root` base (works with no JS at all).
// Dark applies either from an explicit `data-theme="dark"` attribute or,
// absent an explicit `data-theme="light"` override, from the OS preference.
export const themeStylesheet = `
:root {
${colorVarLines(color)}
${shadowVarLines(shadow)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${colorVarLines(colorDark)}
${shadowVarLines(shadowDark)}
  }
}
:root[data-theme="dark"] {
${colorVarLines(colorDark)}
${shadowVarLines(shadowDark)}
}
`.trim()

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_MODE
}

function applyResolvedTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolveTheme(mode))
}

// Persist + apply. Call this on toggle.
export function setThemeMode(mode: ThemeMode) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, mode)
  applyResolvedTheme(mode)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: mode }))
  }
}

let systemListenerAttached = false

// Call once on app boot: applies the stored (or default-dark) mode and keeps
// it synced with OS-level scheme changes whenever the *current* mode is
// 'system' — not just whenever it happened to be 'system' at boot time.
export function initTheme(): ThemeMode {
  const mode = getStoredThemeMode()
  applyResolvedTheme(mode)
  if (typeof window !== 'undefined' && !systemListenerAttached) {
    systemListenerAttached = true
    // Re-read the stored mode on every OS scheme change rather than closing
    // over the boot-time mode. Two bugs this avoids:
    //  1. Switching *into* 'system' via setThemeMode() after boot (i.e. not
    //     present when initTheme() ran) would otherwise never pick up OS
    //     changes until the next full page load.
    //  2. Switching *out of* 'system' into an explicit 'light'/'dark' would
    //     otherwise leave a stale listener that silently re-applies
    //     'system' resolution on the next OS change, clobbering the
    //     user's explicit choice.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredThemeMode() === 'system') applyResolvedTheme('system')
    })
  }
  return mode
}
