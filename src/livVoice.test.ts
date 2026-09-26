// Run with: node --test src/livVoice.test.ts
// Liv's canon voice (Jeff, 2026-09-26): the film's take, pinned. These keep the pin from drifting
// and keep the direction tags away from models that would read them out loud.
import test from 'node:test'
import assert from 'node:assert/strict'
import { LIV_VOICE, livDirected, livVoiceModel } from './livVoice.ts'

test('the canon is the film voice: "Liv" on ElevenLabs, v3 to read aloud, flash live', () => {
  assert.equal(LIV_VOICE.provider, 'elevenlabs')
  assert.equal(LIV_VOICE.voiceId, 'TLeBnGDqmcwGf936zZyW')
  assert.equal(livVoiceModel('readAloud'), 'eleven_v3')
  assert.equal(livVoiceModel('live'), 'eleven_flash_v2_5')
  assert.ok([0, 0.5, 1].includes(LIV_VOICE.readAloud.settings.stability), 'eleven_v3 only takes stability 0, 0.5 or 1')
})

test('direction tags go in front for eleven_v3 only', () => {
  assert.equal(livDirected('Hi, I\'m Liv.', 'eleven_v3'), '[warmly] [clearly] Hi, I\'m Liv.')
  assert.equal(livDirected('Hi, I\'m Liv.', 'eleven_flash_v2_5'), 'Hi, I\'m Liv.')
  assert.equal(livDirected('Hi, I\'m Liv.', 'eleven_turbo_v2_5'), 'Hi, I\'m Liv.')
})

test('text that brings its own direction keeps it, and blank stays blank', () => {
  assert.equal(livDirected('[reassuringly] It\'s okay.', 'eleven_v3'), '[reassuringly] It\'s okay.')
  assert.equal(livDirected('   ', 'eleven_v3'), '')
})
