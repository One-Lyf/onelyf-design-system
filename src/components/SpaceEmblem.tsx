// ─── SpaceEmblem + OneLyfMark ────────────────────────────────────────────────
// Each branch's emblem: a woven patch — interlaced bands (over/under, like the crest's knot)
// stitched as embroidery, on the branch's token accent. And the OneLyf mark: the live Liv glyph
// at the centre, the seven branches as nodes, joined by mycelium hyphae.
// Generated vector art (scripts/emblems/build.py), imported `?no-inline` like the Root Glyph so
// each consumer's Vite content-hashes the files and only fetches what it renders.
import finlyfUrl from '../assets/emblems/finlyf.svg?no-inline'
import homlyfUrl from '../assets/emblems/homlyf.svg?no-inline'
import hlthlyfUrl from '../assets/emblems/hlthlyf.svg?no-inline'
import gudlyfUrl from '../assets/emblems/gudlyf.svg?no-inline'
import wrklyfUrl from '../assets/emblems/wrklyf.svg?no-inline'
import skoollyfUrl from '../assets/emblems/skoollyf.svg?no-inline'
import wavesUrl from '../assets/emblems/waves.svg?no-inline'
import markLightUrl from '../assets/onelyf-mark-light.svg?no-inline'
import markDarkUrl from '../assets/onelyf-mark-dark.svg?no-inline'
import appIconUrl from '../assets/onelyf-app-icon.svg?no-inline'
import wovenLightUrl from '../assets/onelyf-mark-woven-light.svg?no-inline'
import wovenDarkUrl from '../assets/onelyf-mark-woven-dark.svg?no-inline'
import wovenAppIconUrl from '../assets/onelyf-app-icon-woven.svg?no-inline'
import faviconUrl from '../assets/onelyf-favicon.svg?no-inline'
import lockupHLightUrl from '../assets/lockups/onelyf-lockup-horizontal-light.svg?no-inline'
import lockupHDarkUrl from '../assets/lockups/onelyf-lockup-horizontal-dark.svg?no-inline'
import lockupSLightUrl from '../assets/lockups/onelyf-lockup-stacked-light.svg?no-inline'
import lockupSDarkUrl from '../assets/lockups/onelyf-lockup-stacked-dark.svg?no-inline'
import { spaces, type BranchKey } from '../tokens'

/** The OneLyf tagline. Title Case, always. */
export const ONELYF_TAGLINE = 'Many Spaces, Woven Together'

export const EMBLEM_URLS: Record<BranchKey, string> = {
  finlyf: finlyfUrl, homlyf: homlyfUrl, hlthlyf: hlthlyfUrl, gudlyf: gudlyfUrl,
  wrklyf: wrklyfUrl, skoollyf: skoollyfUrl, waves: wavesUrl,
}

/** What each emblem depicts (its default alt text). */
export const EMBLEM_NAMES: Record<BranchKey, string> = {
  finlyf: 'Coin Pouch', homlyf: 'Crossed-Gable Hearth', hlthlyf: 'Twined Heart-Leaf', gudlyf: 'Kite',
  wrklyf: 'Toolbox', skoollyf: 'Lamp & Book', waves: 'Braided Waveform',
}

export interface SpaceEmblemProps {
  space: BranchKey
  /** Rendered diameter in px. */
  size?: number
  alt?: string
}

export function SpaceEmblem({ space, size = 48, alt }: SpaceEmblemProps) {
  return (
    <img
      src={EMBLEM_URLS[space]}
      alt={alt ?? `${spaces[space].label} ${EMBLEM_NAMES[space]}`}
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size }}
    />
  )
}

// The woven cut (scripts/emblems/woven_mark.py) is the embroidered mark from the brand film:
// satin glyph, couched cord, running-stitch rings, on a round linen patch. Day = the crest in
// bronze (OneLyf at rest), night = the live glyph in gold. The flat cut stays as the fallback
// for print, tiny sizes and reduced-texture contexts. PNG exports live in assets/icons/.
export type OneLyfMarkVariant =
  | 'light' | 'dark' | 'app-icon'
  | 'woven-light' | 'woven-dark' | 'woven-app-icon' | 'favicon'

export const MARK_URLS: Record<OneLyfMarkVariant, string> = {
  light: markLightUrl, dark: markDarkUrl, 'app-icon': appIconUrl,
  'woven-light': wovenLightUrl, 'woven-dark': wovenDarkUrl, 'woven-app-icon': wovenAppIconUrl, favicon: faviconUrl,
}

/** Woven wordmark lockups: the mark with "OneLyf" and the tagline, lettering outlined (no font
 *  needed). light / dark follow the page ground, like the marks. */
export type OneLyfLockup = 'horizontal-light' | 'horizontal-dark' | 'stacked-light' | 'stacked-dark'
export const LOCKUP_URLS: Record<OneLyfLockup, string> = {
  'horizontal-light': lockupHLightUrl, 'horizontal-dark': lockupHDarkUrl,
  'stacked-light': lockupSLightUrl, 'stacked-dark': lockupSDarkUrl,
}

export interface OneLyfMarkProps {
  /** light / dark = flat, transparent, for light or night grounds; app-icon = flat, night square.
   *  woven-light / woven-dark = embroidered on a round linen patch; woven-app-icon = the glyph in a
   *  cord ring on night linen; favicon = the small cut (glyph + seven branch dots). */
  variant?: OneLyfMarkVariant
  size?: number
  alt?: string
}

export function OneLyfMark({ variant = 'light', size = 128, alt = 'OneLyf' }: OneLyfMarkProps) {
  return (
    <img src={MARK_URLS[variant]} alt={alt} width={size} height={size}
      style={{ display: 'block', width: size, height: size }} />
  )
}

export default SpaceEmblem
