# onelyf-design-system

## Engineering standards — REQUIRED (applies to all apps, going forward)

Binding for every session, Small Council seat or one-off. Full 10-rule text + source
(Andrej Karpathy's "CLAUDE.md" field notes) lives in `onelyf-planning/CLAUDE.md`'s
"Engineering standards" section. Condensed: read before you write; think before you code (name
the interpretation you picked on anything ambiguous); minimum code for the problem in front of
you, not every future version of it; diffs as small as the task allows, no drive-by reformatting
or refactoring; write the failing test first when fixing a bug; state a success criterion before
writing code; investigate bugs, don't guess, change one thing at a time; every dependency is
permanent code you don't control; say what you did and why, not just the diff; watch for the
Kitchen Sink, Wrong Abstraction, Optimistic Path, and Runaway Refactor failure modes — stop, don't
push through.

## OneLyf platform architecture (local note, 2026-06-28 — not pushed)

OneLyf is now a **federated marketplace**: apps stay their own deploys and federate against a
central platform — shared "Sign in with OneLyf" identity (Supabase Auth) + cross-app grant
tokens. The platform lives in the HomCuisine Supabase project `eygblycimvebrtlrgjsu` (OneLyf
org; to be renamed "OneLyf"), in an **isolated `platform` schema** reached only by `platform-*`
edge functions. Platform repo: `~/onelyf-platform` (local). Full status + sequencing:
`~/onelyf-planning/ACTIVE-TASKS.md` (LIVE THREAD).

**Guardrails:** never create/edit a `platform.*` schema object or a `platform-*` edge function
from an app repo (name collisions clobber the broker). Don't wire billing. Pricing is deferred
(Cash Stash + HomCuisine ~$30 one-time each; ClawDex/Shanti Sprouts/LittleKnight free).

**THIS REPO** is the shared OneLyf design system; the marketplace demo + apps can consume it. Nothing platform-specific to do now.
