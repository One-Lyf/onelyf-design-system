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
