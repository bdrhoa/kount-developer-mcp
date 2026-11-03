# Shared project instructions

These instructions apply to Codex and Claude Code. Maintain shared rules here;
`CLAUDE.md` only imports this file.

## Start or resume work

1. Read `HANDOFF.md` before editing anything. The newest entry is first.
2. Read `DECISIONS.md` for settled choices, then `README.md` for project setup.
3. Inspect the working tree (`git status --short --branch` and relevant diffs).
   Reconcile the notes with the actual files; notes can become stale.
4. Continue from the latest next steps within the user's current request.
   Record missing requirements as unknown rather than inventing them.

## Work together

- Only one agent edits this checkout at a time. Finish a handoff and stop the
  outgoing agent before switching tools. These files do not enforce a lock.
- Either agent may plan, implement, review, or test; the current task determines
  the role. Preserve the other agent's work and unrelated user changes.
- Treat accepted entries in `DECISIONS.md` as settled. If a change is needed,
  explain it in `HANDOFF.md` and obtain the user's decision before reversing it,
  unless the user has already authorized that change. Preserve the old decision
  and link its replacement rather than silently rewriting history.
- Keep durable project context in this repository, not solely in chat history
  or a tool's private memory. Keep credentials and sensitive payloads out of it.
- Verify changed behavior using the project's documented commands once they
  exist. Distinguish passed, failed, and unrun checks; never invent commands or
  claim verification without evidence.

## Finish or switch agents

- Follow `docs/HANDOFF_WORKFLOW.md` after meaningful work, before switching
  tools, and before a planned session end or context reset. Checkpoint during
  long tasks so an unexpected interruption leaves useful context.
- Prepend a signed entry to `HANDOFF.md` with completed and unfinished work,
  checks, decisions, blockers, working-tree state, and concrete next steps.
- Update `README.md` when setup changes and `DECISIONS.md` when the user settles
  a durable choice. Keep these files concise; do not copy chat transcripts.
- Invoke the repository's `handoff` skill when available: `$handoff` in Codex or
  `/handoff` in Claude Code. If unavailable, read the shared workflow directly.
