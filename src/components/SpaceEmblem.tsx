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

export type OneLyfMarkVariant = 'light' | 'dark' | 'app-icon'

export const MARK_URLS: Record<OneLyfMarkVariant, string> = {
  light: markLightUrl, dark: markDarkUrl, 'app-icon': appIconUrl,
}

export interface OneLyfMarkProps {
  /** light = transparent, for light grounds; dark = transparent, for night grounds;
   *  app-icon = square with the night ground baked in. */
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
