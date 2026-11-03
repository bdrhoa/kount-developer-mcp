# Handoff workflow

Use this procedure when wrapping up meaningful work, switching agents, or
checkpointing before a context reset. Both tools' `handoff` skills read this
same file; edit the procedure here.

1. Read `AGENTS.md`, the latest `HANDOFF.md` entry, and `DECISIONS.md`. Inspect
   `git status --short --branch` and relevant diffs. Preserve unrelated changes.
2. Summarize what actually changed, including important file paths and the
   reason. Identify unfinished work and any useful failed approach to avoid
   repeating. Do not perform new implementation simply to prepare a handoff.
3. Record checks actually run and their outcomes. State what was not checked
   and why. A documentation-only checkpoint need not run application tests.
4. Add newly accepted decisions to `DECISIONS.md` with the user's authority or
   the existing authorization. Put proposals or unresolved disagreements in
   the handoff instead. Update `README.md` if setup commands changed.
5. Prepend an entry below the `HANDOFF.md` introduction, above earlier entries.
   Use local time with an explicit UTC offset and sign with the actual agent
   name (Codex or Claude Code). Do not include secrets or raw chat transcripts.
6. Read the entry back for accuracy. Report the checkpoint to the user and,
   when switching tools, stop editing so the next agent can take over.

Use this shape, adapting detail to the work:

```markdown
## YYYY-MM-DD HH:MM UTC±HH:MM — Agent name — Short task title

### Current state
- Goal, current phase, branch, and relevant commits or uncommitted changes.

### Completed
- Concrete changes and useful file paths.

### Verification
- Commands/checks and their actual results; unrun checks and limits.

### Decisions and open questions
- Accepted decision IDs; proposed changes, blockers, or missing user input.

### Next steps
1. A specific starting point for the next agent.
2. Remaining implementation or verification work.
```

Keep earlier entries intact. For a long log, move older entries to a dated file
under `docs/handoffs/` and leave a link in `HANDOFF.md`; keep the latest entry
and all unresolved next steps available in the main file.

This is a cooperative checkpoint, not an automatic backup or a concurrency
lock. Save it during long work as well as at the end of a session.
