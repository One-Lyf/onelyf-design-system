// ─── Liv's voice — the canon ────────────────────────────────────────────────
// The one voice Liv speaks in, on every surface of every OneLyf app. Pinned by Jeff, 2026-09-26:
// "the version of the Liv voice that's in the film ... as the new canon default voice", i.e. the
// narration of the brand film (film/onelyf.v4.12-woven.html, film/liv-vo-5.js).
//
// That take is the ElevenLabs voice saved as "Liv" ("Mother – Strong, Warm, Calm") on the eleven_v3
// model, directed [warmly] [clearly] (nurturing rather than sultry, clear rather than husky: the
// v4.9 to v4.11 auditions). Two surfaces, two models (Jeff's call):
//   readAloud  read-aloud / TTS and previews: eleven_v3 with the film's direction. v3 is the most
//              expressive model but slow to start, so it is for audio that is rendered, then played.
//   live       phone and hands-free conversation: the same voice on eleven_flash_v2_5, which starts
//              speaking fast enough for a live turn. v3's direction tags are not used there (flash
//              would read them out).
// A user's own voice choice (their banked Liv persona) still wins for them; this is the default.
//
// The ElevenLabs API key never lives here or in any app: synthesis happens server-side
// (platform-liv-tts in liv-console for read-aloud, the phone bridge for live). A voice id alone
// cannot synthesize anything.

export const LIV_VOICE = {
  name: 'Liv',
  provider: 'elevenlabs',
  /** ElevenLabs voice id: "Liv" / "Mother – Strong, Warm, Calm". */
  voiceId: 'TLeBnGDqmcwGf936zZyW',
  readAloud: {
    model: 'eleven_v3',
    /** eleven_v3 audio tags, prefixed to the text. The film's delivery. */
    direction: '[warmly] [clearly]',
    /** eleven_v3 takes stability 0 (creative), 0.5 (natural) or 1 (robust); the film used natural. */
    settings: { stability: 0.5, similarity_boost: 0.75 },
  },
  live: {
    model: 'eleven_flash_v2_5',
  },
  /** When ElevenLabs is unavailable (no key, or it errors): the Google voice every app falls back to. */
  fallback: { provider: 'google', voice: 'en-US-Neural2-F' },
} as const

export type LivVoiceSurface = 'readAloud' | 'live'

/** The model Liv's voice uses on a surface. */
export function livVoiceModel(surface: LivVoiceSurface): string {
  return LIV_VOICE[surface].model
}

/**
 * Text as ElevenLabs should receive it for `model`: the film's direction tags in front for
 * eleven_v3 (which performs them), unchanged for any other model (which would read them aloud).
 * Text that already opens with a tag keeps its own direction.
 */
export function livDirected(text: string, model: string): string {
  const t = text.trim()
  if (model !== LIV_VOICE.readAloud.model || !t || t.startsWith('[')) return t
  return `${LIV_VOICE.readAloud.direction} ${t}`
}
