#!/usr/bin/env node
/**
 * Print the slugs (suite names) whose source has changed since their last
 * recorded `lastCommit` in eval-scores.json. Output is one slug per line on
 * stdout, suitable for piping into:
 *
 *   node scripts/aggregate.js --run --only=$(node scripts/diff-changed-skills.js | paste -sd,)
 *
 * Or consumed directly by the CI workflow which parses each line.
 *
 * Modes:
 *   - With no eval-scores.json on disk, every suite is considered changed
 *     (the first run materialises the baseline).
 *   - When a suite's lastCommit is missing or unreachable in git history,
 *     it is treated as changed.
 *   - GLOBAL_TRIGGERS (evals/providers, evals/shared, evals/tools,
 *     evals/mocks) cause every suite to be flagged when changed since
 *     the most recent `updatedAt` -> last commit; the diff target there is
 *     the most recent suite-specific lastCommit, since global tooling
 *     applies to all suites.
 *
 * Flags:
 *   --json     emit a JSON array instead of newline-separated slugs
 *   --verbose  log reasoning to stderr
 *   --base=<commit>  override what HEAD is compared against (defaults to
 *     each suite's recorded lastCommit). Useful for "show what would
 *     change if we merged this branch" pre-merge analysis.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { SUITES, GLOBAL_TRIGGERS } = require("./_manifest");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCORES_PATH = path.join(REPO_ROOT, "eval-scores.json");

function parseArgs(argv) {
  const args = { json: false, verbose: false, base: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--json") args.json = true;
    else if (arg === "--verbose" || arg === "-v") args.verbose = true;
    else if (arg.startsWith("--base=")) args.base = arg.slice("--base=".length);
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        `Usage: diff-changed-skills.js [--json] [--verbose] [--base=<commit>]\n`,
      );
      process.exit(0);
    }
  }
  return args;
}

function log(verbose, msg) {
  if (verbose) process.stderr.write(`[diff] ${msg}\n`);
}

function loadScores() {
  if (!fs.existsSync(SCORES_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SCORES_PATH, "utf-8"));
  } catch (e) {
    process.stderr.write(`[diff] eval-scores.json unparseable (${e.message})\n`);
    return null;
  }
}

function git(args) {
  return spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function commitExists(sha) {
  if (!sha) return false;
  const r = git(["cat-file", "-e", `${sha}^{commit}`]);
  return r.status === 0;
}

/**
 * Returns true if any commit in `sinceSha..HEAD` touched any of `paths`.
 */
function hasChangesIn(sinceSha, paths) {
  const r = git([
    "log",
    `${sinceSha}..HEAD`,
    "--name-only",
    "--pretty=format:",
    "--",
    ...paths,
  ]);
  if (r.status !== 0) return null;
  const touched = r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return touched.length > 0;
}

function pathsForSuite(suite) {
  return [
    `${suite.skillDir}/SKILL.md`,
    `${suite.skillDir}/references`,
    `${suite.skillDir}/marketplace.json`,
    `evals/${suite.suite}`,
  ];
}

function main() {
  const args = parseArgs(process.argv);
  const verbose = args.verbose;
  const scores = loadScores();
  const changed = [];

  if (!scores) {
    log(verbose, "no eval-scores.json found - flagging every suite as changed");
    for (const s of SUITES) changed.push(s.suite);
    emit(args, changed);
    return;
  }

  const skillsRecord = scores.skills || {};

  // Pick a single "global baseline" commit for global trigger checks: the
  // most recent lastCommit across all suites. If any of evals/providers,
  // evals/shared, evals/tools, evals/mocks changed since that commit, we
  // re-run every suite (they share that infrastructure).
  const globalBaseline = newestRecordedCommit(skillsRecord);
  const globalChanged = globalBaseline
    ? hasChangesIn(globalBaseline, GLOBAL_TRIGGERS)
    : true;
  if (globalChanged) {
    log(
      verbose,
      `global triggers changed since ${globalBaseline || "(none)"} - flagging every suite`,
    );
    emit(args, SUITES.map((s) => s.suite));
    return;
  }

  for (const suite of SUITES) {
    const record = skillsRecord[suite.skillKey];
    const baseline = args.base || (record && record.lastCommit) || null;

    if (!baseline) {
      log(verbose, `${suite.suite}: no recorded lastCommit - flagging as changed`);
      changed.push(suite.suite);
      continue;
    }

    if (!commitExists(baseline)) {
      log(verbose, `${suite.suite}: baseline ${baseline} not in git history - flagging as changed`);
      changed.push(suite.suite);
      continue;
    }

    const result = hasChangesIn(baseline, pathsForSuite(suite));
    if (result === null) {
      log(verbose, `${suite.suite}: git log failed against ${baseline} - flagging as changed`);
      changed.push(suite.suite);
      continue;
    }
    if (result) {
      log(verbose, `${suite.suite}: changes since ${baseline} - flagging as changed`);
      changed.push(suite.suite);
    } else {
      log(verbose, `${suite.suite}: no changes since ${baseline} - skipping`);
    }
  }

  emit(args, changed);
}

function newestRecordedCommit(skillsRecord) {
  // Use the suite with the most recent lastRun timestamp as the global
  // baseline. Falls back to the first non-null lastCommit if timestamps
  // are missing.
  const entries = Object.values(skillsRecord || {}).filter(
    (e) => e && e.lastCommit,
  );
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    const ta = Date.parse(a.lastRun || "") || 0;
    const tb = Date.parse(b.lastRun || "") || 0;
    return tb - ta;
  });
  return entries[0].lastCommit;
}

function emit(args, slugs) {
  if (args.json) {
    process.stdout.write(JSON.stringify(slugs) + "\n");
    return;
  }
  for (const slug of slugs) process.stdout.write(slug + "\n");
}

main();
