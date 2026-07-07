# Autonomous Operation

This skill is built to run unattended — triggered by a label, a webhook, or a CI job, with no human watching each step. That raises the bar on discipline: an interactive agent can be corrected mid-task, an automated one cannot. The rules below keep an unattended run from making a PR worse.

## The validation gate (hard stop)

Before committing, run the project's checks for **every file you created or modified**, and fix what you broke:

- **Format** (e.g. the project's formatter) — must produce no diff on a re-run
- **Lint** — resolve or auto-fix
- **Type-check** — must pass
- **Build/compile** — must pass
- **Tests** touching the changed code — must pass

**Hard stop:** if any check still fails after a reasonable fix attempt and the failure is caused by your wiring, **do not commit and do not push**. Narrow the scope of your change — or revert to the smallest viable wiring — rather than push broken code. Pushing a commit that fails formatting, lint, type-check, build, or tests leaves the branch less mergeable than you found it, which is the single worst outcome for this step.

Discover the actual commands from the repo (its `package.json` scripts, `Makefile`, CI config, or contributor docs) rather than assuming — toolchains differ per project.

## Idempotency

The pipeline may fire more than once on the same PR (new commits, retries, re-labels). Every action must be safe to repeat:

- **Flag creation:** check for the key first (`list-flags`) or handle the duplicate error by reusing via `get-flag`. Never fail a run because the flag already exists.
- **Code wiring:** if the target code is already wrapped in this flag, leave it. Don't double-wrap or stack conditionals.
- **Commits:** if there's nothing new to commit, don't create an empty commit.

## Commit discipline

- Make one focused commit for the flag wiring with a clear, scoped message (e.g. `feat: wire <change> behind <flag-key>`).
- Only commit files you intended to change. Don't sweep unrelated edits, generated artifacts, or local config into the commit.
- Follow the repository's own commit and attribution conventions.
- Do not wait on long-running external checks (full CI) to finish — commit and push once your local validation gate is green, and let CI run.

## Scope and blast radius

- Touch only the files the brief identifies (plus their unavoidable dependencies, e.g. a central flag-constants file).
- Do not opportunistically refactor, reformat untouched files, or "clean up" beyond the flag wiring. The smaller the diff, the easier the human review and the lower the risk to the control path.

## Reporting

End with a structured, parseable result so the orchestrator and the next step don't have to read prose: `flag_key`, `flag_created`, `files_modified`, `evaluation_pattern`, `control_path_preserved`, whether validation passed, and any skipped/edge-case notes. Surface failures loudly — a silent partial success is worse than a clear failure the pipeline can route to a human.

## Secrets and credentials

Never print API keys, tokens, or SDK keys into logs, commit messages, or PR comments. Use the credentials your runner injects via environment/secret store; don't hard-code or echo them.
