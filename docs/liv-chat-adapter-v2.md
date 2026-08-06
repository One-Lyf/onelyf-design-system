# LivChat Adapter v2 — spec + migration plan for Commis + Advisor

**Status:** DRAFT. Written 2026-08-06 without Jeff in the room; contains product-shape
questions for him below. Nothing in this doc is implemented. Ship review of THIS doc first;
code lands only after the flagged questions are answered.

**Why this exists.** Canonical `LivChat` is live and consumed by OneLyf Federation's Liv
Console. `docs/ui-overhaul.md` flagship #3 is "standardized Liv chat window across
Advisor/Commis/all hats." Federation was the easy migration — its previous chat was already
built against the same session/message/BYOK model. **Commis (Tummyful) and Advisor (Cash
Stash) are the hard ones**, and dropping them onto today's `LivChat` unchanged would silently
lose real features. This doc catalogs what's missing and proposes the minimum shape to add.

**Engineering standards apply** (Karpathy, per repo CLAUDE.md): minimum code for the problem
in front of us, not every future consumer; small diffs; investigate don't guess; watch for
the Wrong Abstraction and Runaway Refactor failure modes. Every proposal below is scored
against those.

---

## 1. What today's `LivChat` owns

Anything a consumer already gets for free — do not rebuild these in Commis/Advisor:

- **Sessions rail** — list / create / rename (inline) / delete (confirm) via `adapter.sessions.*`.
  Server-generated summary titles arrive on a delayed refresh.
- **Message list + optimistic user bubble** — `adapter.messages.list(sessionId)` on select,
  optimistic append on send, activeId-ref guard so a slow reply for session A never paints
  over session B.
- **Streaming reply** with a tool-activity line ("Searching the web…", "Reading a page…")
  that replaces the frozen caret while a tool round runs.
- **BYOK settings panel** — `adapter.key.get`/`set`, hides when `hat.enableKey === false` or
  the adapter has no `key`.
- **Model selector** (inline in composer + full picker in settings panel) — driven by
  `hat.models` and `adapter.key.set({model})`.
- **Attachments** — `adapter.attachments.signedUrl(path)`, optimistic blob previews revoked
  after the server-confirmed message arrives.
- **Voice** — hands-free TTS uses `adapter.voice.speak()` if provided, else browser
  `speechSynthesis`; mic dictation via browser `SpeechRecognition` (feature-gated).
- **Token + cost meter** — accumulates `LivUsage` on each `chat.send` result, prices by
  model tier, tap-to-reset.
- **Empty state** — glyph + `hat.name` + `hat.description` + `hat.pills` + `hat.suggestions`
  chips (each fills the composer).
- **Dock header controls** — chevron-down / close render when `onMinimize` / `onClose` are
  passed (persistent-dock hosts).
- **Mobile session rail** — overlay sheet below 620px.
- **Message copy** — per-bubble copy-to-clipboard with 1.5s "Copied" flash.

**Identity surface** (`LivHat`): `name`, `subtitle`, `accent`, `placeholder`, `emptyText`,
`intro`, `enableAttachments`, `enableKey`, `models`, `glyph`, `description`, `pills`,
`suggestions`, `toolIcon`.

**Adapter surface** (`LivChatAdapter`): `sessions.{list,create,rename,delete}` ·
`messages.list` · `chat.send(args, onChunk)` (chunks are strings OR `LivToolActivity`) ·
optional `attachments.signedUrl` · optional `key.{get,set}` · optional `voice.{speak,stop}`.

---

## 2. What Commis (Tummyful) has today that `LivChat` does not

Read [`homlyf-tummyful/src/components/Commis.tsx`](../../homlyf-tummyful/src/components/Commis.tsx)
(1,536 LOC) and [`ActionCardsList.tsx`](../../homlyf-tummyful/src/components/ActionCardsList.tsx)
before removing any of these:

1. **Action cards inline in the transcript** — after a Liv reply, Commis renders a stack of
   proposed database mutations (`add_to_meal_plan`, `mark_recipe_cooked`, `create_meal_kit`,
   `edit_meal_kit`, `log_consumed`, plus save-recipe / add-to-shopping / add-to-pantry / etc.).
   Each card has per-type pickers — recipe/pantry/shopping-item/substitution selects, plan
   date + meal + batch-scale, contextual notes for the "opens a review" cards. A batch
   summary with **Apply all (N)** appears when ≥2 cards are queued.
2. **Structured extraction from the same round-trip** — `askCommisAuto` returns
   `{text, proposed[], usage}`; the reply text and the queued actions come back together, so
   cards can render immediately below the reply without a second turn.
3. **System-context injection at send time** — `buildKitchenContext(familyId)` (pantry +
   recipes + shopping list, refetched fresh on each send), grocery-budget summary from Cash
   Stash via the Liv bridge, and any active `cookingContext` are folded into the model
   payload as a `ctx` object.
4. **Server-side URL preprocessing** — if the user pastes an http(s) link, the app fetches
   the recipe via the app's own `recipe-fetch` edge fn and appends the parsed recipe as text
   the model sees (the displayed message stays the user's plain text). On failure it injects
   a "tell the user to paste the recipe" instruction so Commis doesn't flatly refuse.
5. **Cook Mode integration** — Commis takes props `cookingContext`, `cookStepText`,
   `voiceMode`, `onVoiceModeChange`, `cookControls: {next, prev, repeat, ingredients,
   setScale, runChecklist}`. In Cook Mode hands-free voice becomes host-controlled; short
   navigation commands (advance/back/repeat/ingredients + spoken checklist ticks) run WITHOUT
   an AI round-trip; step text is auto-read when it changes.
6. **Wake-word gate** — in hands-free voice mode, the mic stays asleep until it hears "Hey
   Commis"; a 15s window arms after each Commis reply so a natural back-and-forth doesn't
   need the wake word every turn; acknowledgement is "Yes Chef?" (kitchen persona).
7. **Camera vs photo-library attach split** — two `<input type="file">` refs, one with
   `capture="environment"` (force-camera), the other library. Prevents the "attach library
   photo" gap the single-input pattern created.
8. **Pending one-shot requests** — `pendingRequest: {prompt, imageUrl?, nonce}` from the
   dock ("Critique my plating"): pre-fills the composer, optionally attaches an image URL,
   nonce ensures each ask fires exactly once.
9. **Modal handoffs** — `mark_recipe_cooked` opens `<CookComplete>` (the same pantry-
   reconcile review the recipe page uses), `log_consumed` opens `<LogConsumed>`. Both are
   app-owned overlays, not chat surfaces.
10. **Family notifications** — `notifyFamilyActivity` fires after actions that touched shared
    state.
11. **"Turn this into…" action menu** — a chef's-knife-triggered popover below the composer
    with manual "Save as recipe / Add to shopping / Add to pantry / Log consumed / Add to
    plan" buttons; runs on the current chat when the auto-proposals miss.
12. **Abort mid-send** — Commis wires `abortRef.current?.abort()` on stop; today's `LivChat`
    has no abort surface at all (a slow reply can't be cancelled).
13. **Custom empty-state actions** — Commis renders `<ActionCardsList>` and the "turn this
    into" menu directly in the composer area; a `LivChat`-imposed empty-state would remove
    these unless the DS provides a slot.
14. **Session persistence layer** — Commis owns its own `chatSessions.js` (Supabase-backed,
    per-family, per-hat). Migrating to `LivChat`'s sessions means either (a) Commis's
    session store becomes the LivChat adapter's `sessions.*` backend, or (b) the LivChat
    session model replaces Commis's. See §5 question.

---

## 3. What Advisor (Cash Stash) has today that `LivChat` does not

Read [`finlyf-cash-stash/src/App.jsx`](../../finlyf-cash-stash/src/App.jsx) lines 1559 (batch
summary), 1606 (confirm-cards), 2131 (advisor entry), 3641 (floating bubble). Bespoke, inline
in a 4,987-line `App.jsx`, no design-system import.

1. **Action cards** — same shape as Commis's but for finance mutations (build budget from
   paycheck, categorize transaction, move envelope, etc.). Same batch-summary + Apply-all
   pattern.
2. **Advisor tier switching** — Standard vs Premium personas, gated by whether a key is set
   / shared. `advisorTier` config key. `LivChat` has model-list but no persona-tier concept.
3. **Family key sharing** — `hasOwnKey` vs `hasSharedKey`; a family member can use another
   member's shared key. `LivChat`'s `key.get`/`set` is single-key.
4. **Finance-context injection** — server-side `finance-context` edge fn (broker-mediated,
   read grants) folds a budget snapshot into the model payload each turn.
5. **Floating "Ask Liv" bubble** — separate from the main Advisor tab; same instance,
   different mount. Same pattern as CommisDock.
6. **Provider-agnostic key** — Advisor is designed for OpenAI / Anthropic / Google / custom
   provider per the "AI must be provider-agnostic" feedback memory. `LivChat`'s BYOK panel
   is Anthropic-only ("sk-ant-…" placeholder, model list hard-coded to Claude family).

---

## 4. Proposal — the minimum change to `LivChat` that unblocks both migrations

Everything below is scored *additive + backward-compatible* (Federation keeps working
unchanged). Grouped by size of change.

### Tier A — small, safe, ship anytime

**A1. `adapter.chat.abort?(): void`.** Optional. `LivChat` calls it on session-switch mid-
send and exposes a "Stop" button in the streaming bubble. Federation's `onelyf.js` already
uses `AbortController` internally — this just plumbs it through. **Everyone benefits;
Commis's abort port becomes native.**

**A2. `hat.toolLabels?: Record<string, string>`.** Complements the existing single
`hat.toolIcon`. Today `ToolActivityLine` hard-codes labels for `web_search`/`fetch_url` and
falls back to "Working" for anything else. With this map, Commis can register
`{save_recipe: 'Writing your recipe', add_to_shopping: 'Adding to shopping'…}` and get
distinct in-flight lines per tool. **Zero risk, obvious win.**

**A3. `adapter.key` provider-agnostic hints.** Add `keyProviders?: Array<{id, label,
placeholder, keyPrefix?}>` to `LivHat` so Advisor's provider-switcher fits. Today's
Anthropic-only strings become the default when omitted. Federation is unaffected.
**Depends on Q3 below** — if Jeff wants Advisor's provider switching to stay app-owned, this
addition is unnecessary and should be cut.

### Tier B — structural, needs review before build

**B1. `LivChatProps.renderInlineExtras?: (ctx: {sessionId: string | null; messages:
LivMessage[]}) => ReactNode`.** Renders in the transcript column below the last message and
above the composer. This is the single seam action cards need. The app owns the extras
state (Commis's `actionCards[]`, its "Apply all" busy flag, its recipe-book snapshot); DS
just renders whatever ReactNode the app returns.

*Rationale for keeping this dumb.* An "action cards" DS primitive would be a Wrong
Abstraction — Commis's cards have kitchen-domain pickers, Advisor's have finance pickers,
future hats will have theirs. DS provides the SLOT, not the SHAPE.

**B2. `adapter.chat.send`'s return type gains an optional `extras?: unknown`.** So Commis's
`askCommisAuto` can flow `proposed[]` back to the app through the same call the DS made.
The app's adapter implementation consumes `extras` in its own send wrapper — DS just widens
the type. **Truly zero-cost if unused; the type is already `LivChatSendResult`.**

**B3. `LivChatProps.renderComposerExtras?: () => ReactNode`.** A slot inside the composer
toolbar (right of the mic button, left of send). Commis's chef's-knife "turn this into…"
menu lives here. A hat that doesn't need it passes nothing. **Small, focused; only add if
Q4 (below) resolves to "keep the extras menu, don't retire it".**

**B4. `LivChatProps.pendingRequest?: {prompt: string; imageUrl?: string; nonce: number}`.**
DS honors it exactly like Commis does today — pre-fills the composer draft, attaches the
image once, nonce keys prevent re-firing. **Straightforward; supports any host that wants
external-injected asks.**

### Tier C — NOT proposed to add to DS; keep app-owned

These are cited in §2/§3 but do not belong in the shared component. Documenting why so a
future session doesn't try to lift them:

- **Cook Mode props / cookControls / step-text-auto-read.** Kitchen-domain. Commis is the
  correct owner. Cook Mode should keep its own Commis instance (as it does today) or wrap
  a shared LivChat with cook logic external to the DS.
- **Wake-word gate + "Hey Commis" / "Yes Chef?".** Kitchen-domain persona. No other hat
  will want this exact language; a generalized "wake phrase" API is speculative until a
  second hat needs one.
- **Kitchen-context / finance-context builders.** App-domain; the app's `chat.send`
  implementation already owns fetching them. DS doesn't need to know.
- **URL-preprocessing (recipe fetch).** App-domain; same pattern.
- **Modal handoffs (CookComplete, LogConsumed).** App-owned overlays; the action-card
  Apply handler already opens them today.
- **Family notifications.** App-domain side effect.
- **Camera-vs-library attach split.** Small enough to fit as `hat.attachModes?: ('camera'
  | 'library')[]`, but reads as YAGNI until a second hat asks for it. Defer.

### Tier D — the "keep it out of the DS entirely" recommendations

- **The Commis / CashStash "Ask Liv" bubble/dock.** Both apps have their own; Federation
  has its own (`LivDock` wrapping `LivChat`). The dock is inherently host-specific (which
  page shows the bubble, how it drags, when it dismisses per-nav). DS could ship a
  `<LivDock>` reference implementation, but not required for either migration; each app
  keeps its own dock and portals `LivChat` into it. **Recommend: no DS dock primitive
  today.**

---

## 5. Product-shape questions — Jeff-only

Cannot land migration code until these are answered.

**Q1. Sessions ownership.** Commis and Advisor each have their own Supabase-backed
`chatSessions` table + list/create/rename/delete flow (per-family, per-hat, with title
generation). LivChat's `adapter.sessions.*` port expects the app to expose *some* backend.
Two paths:
- **(a)** App's existing session store IS the adapter's backend — a thin wrapper adapts
  `listSessions/createSession/…` to the `Promise<LivResult<…>>` shape LivChat wants. Zero
  data migration; both apps keep their session tables.
- **(b)** LivChat / DS ships a canonical session store (Supabase in the app's own project,
  per-hat namespaced). Consumer apps migrate their existing sessions into it.

**Recommendation: (a).** Preserves 1,536 LOC of working code; matches the LivChat
philosophy ("the app owns WHERE the data comes from"). (b) is a Runaway Refactor risk with
no clear payoff.

**Q2. Does Tummyful take a dependency on `onelyf-design-system`?** Today Tummyful has
zero DS imports and its own CLAUDE.md says *"Don't introduce a cross-Lyf-app dependency or
import."* Reading that rule generously, it's about **app-to-app data reads** (which the
broker owns), not shared UI libraries — but the standalone stance runs deep. Options:
- **(a)** Add DS as a github-commit-pinned dep (same pattern Federation uses) — one line in
  `package.json`, one line in each import. Bundle-size cost: ~40KB pre-gzip of tokens +
  LivChat + supporting components (measure before deciding).
- **(b)** Vendor LivChat + tokens into Tummyful's own `src/lib/liv/` — no dep, but drift
  risk: bug fixes to canonical LivChat don't reach it.
- **(c)** Don't migrate Commis; leave the bespoke chat.
Same question applies to Cash Stash independently.

**Recommendation:** for Tummyful, **(a)** — the standalone rule is about data, and the DS
consumption pattern in Federation is proven. For Cash Stash, **(a)** *if* Advisor's
provider-agnostic AI direction (memory: `feedback_ai_provider_agnostic.md`) fits within Tier
A3's shape; otherwise **(c)** for now.

**Q3. Advisor's provider-agnostic direction — does LivChat pick that up or does Advisor
stay bespoke?** LivChat is Claude-family-only today. Adding real provider abstraction is
weeks of work with clear payoff only for Cash Stash. Cheapest path: A3 above (hat-level
key-provider hints; the adapter's `key.get/set` already accepts opaque strings, so any
provider works if the app's edge fn does).

**Q4. Manual "turn this into…" action menu — retire or preserve?** Now that Commis
auto-surfaces proposed actions after every turn (`proposed[]` from `askCommisAuto`), the
manual menu is a legacy fallback. If you'd rather retire it, we don't need `B3
renderComposerExtras` and the composer stays cleaner.

**Q5. Migration ordering.** Three sensible sequences:
- **(i) Federation-additive first** (A1 abort + A2 toolLabels only, no consumer migration
  yet) — safest, ships a real improvement in one PR.
- **(ii) Commis first** — bigger diff, but Commis is more mature than Advisor and its
  action-card shape is cleaner; validates B1/B2 seams.
- **(iii) Advisor first** — smaller LOC to retire (Advisor is inline, easier to graft on),
  but forces Q3 (provider-agnostic) first.

**Recommendation:** (i) → land A1/A2 as their own PR (no consumer changes) → then (ii).

---

## 6. Non-goals for this v2

Explicitly NOT proposing:

- A DS-owned `<ActionCard>` primitive.
- A DS-owned dock/bubble.
- A DS-owned session store.
- A DS-owned wake-word / voice-persona layer.
- A DS-owned modal system.
- Cross-app data reads via DS (broker's job).

Any of these can come later; none are needed to close ui-overhaul.md flagship #3.

---

## 7. Test / success criteria (state before writing code)

Adopted from the Karpathy standards: **"state a success criterion before writing code."**

**Tier A ships when:**
- A1: Session-switch mid-stream stops the in-flight reply for the old session (no orphan
  chunks bleed into the new session). Verified: switch sessions during a long reply, watch
  network tab abort.
- A2: A registered app-tool name (e.g. `save_recipe`) renders its custom label in
  the tool-activity line, not "Working". Verified: unit test on `ToolActivityLine`.
- Federation regression: `apps/marketplace/src/App.jsx` renders unchanged, no console
  warnings from missing new props.

**Commis migration ships when:**
- All 5+ action-card types render + apply correctly (mark_recipe_cooked opens CookComplete,
  log_consumed opens LogConsumed, batch Apply all works, per-card picker state persists).
- Cook Mode's docked Commis still exposes cookControls + auto-reads step text (this may
  mean Cook Mode keeps its own non-DS Commis; that's fine).
- Wake-word gate + "Hey Commis"/"Yes Chef?" still works (app-owned voice mode wrapping DS
  LivChat).
- Recipe URL preprocessing still runs (app's `chat.send` implementation).
- Kitchen context still refetched per send.
- Family notifications still fire.
- Bundle size delta measured + under 60KB gzipped.

**Advisor migration ships when:**
- Q3 resolved. Then a parallel test list against `App.jsx:2131-4926`.

---

## 8. Non-migration wins available right now

Independent of any consumer migration, these are DS-side improvements the audit surfaced:

- LivChat's `attachmentsOf` coercion silently swallows a malformed `attachments` string
  (falls through to `[]`); the earlier crash comment says the error boundary catches it, but
  we could `console.warn` on the parse error for observability.
- `speak()` and `stopSpeaking()` don't guard `typeof window !== 'undefined'` on the
  speechSynthesis fallback — fine for CSR-only apps (which is everyone today), but worth a
  guard if any consumer ever SSRs LivChat.
- The mobile session-rail overlay traps focus poorly; a `role="dialog"` + `aria-modal` +
  Escape-to-close pass would help accessibility. Not migration-blocking; note for the
  ui-quality DOD.

These are strictly optional; not part of the migration plan.

---

## 9. What lands in what order

Concrete PR sequence, given the recommendations above:

1. **DS PR "livchat: abort + toolLabels (A1 + A2)"** — additive, no consumer changes, ships
   a real Federation improvement (Stop button) and prepares the ground.
2. **Jeff answers Q1–Q5.** Decisions doc appended to this file.
3. **DS PR "livchat: renderInlineExtras + optional send.extras (B1 + B2)"** — additive,
   still no consumer changes. Includes a docs example (a toy `<pre>{JSON.stringify(extras)}</pre>`).
4. **Tummyful PR "commis: adopt canonical LivChat, keep app-owned action-cards + cook
   mode + wake words"** — the real migration. Adds DS dep. Keeps `commisActions.ts`,
   `actionCards.ts`, `commisRequest.ts`, `useDictation.ts`, `voicePrefs.ts`, `kitchenContext
   .ts`, `financeContext.ts`, `CookMode` wrapper unchanged. Replaces `Commis.tsx`'s bubble/
   composer/transcript with `<LivChat …renderInlineExtras={renderActionCards} />`.
5. **Cash Stash — decision-gated on Q3.**

---

## 10. Word to a future session

If you're picking this up: read §5's questions first. If Jeff hasn't answered them, **do not
start on step 3 above** — the shape of B1/B2 is worth revisiting once the sessions-ownership
answer is known. Step 1 (A1 + A2) is safe to do at any time without further input.
