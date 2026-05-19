#!/usr/bin/env node
/**
 * Print the suite slugs whose source has changed since their last recorded
 * `lastCommit` in eval-scores.json. Output is one slug per line on stdout,
 * suitable for:
 *
 *   node scripts/aggregate.js --run --only=$(node scripts/diff-changed-skills.js | paste -sd,)
 *
 * Modes:
 *   - No eval-scores.json on disk → every suite is flagged (first run).
 *   - A suite's lastCommit missing or unreachable → treated as changed.
 *   - GLOBAL_TRIGGERS (evals/providers, evals/shared, evals/tools, evals/mocks)
 *     changed since the most-recent recorded commit → every suite flagged.
 *
 * Flags:
 *   --json      emit a JSON array instead of newline-separated slugs
 *   --verbose   log reasoning to stderr
 *   --base=SHA  compare all suites against this commit instead of their
 *               recorded lastCommit (useful for pre-merge analysis)
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
      process.stdout.write("Usage: diff-changed-skills.js [--json] [--verbose] [--base=<sha>]\n");
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
    process.stderr.write(`[diff] eval-scores.json unparseable: ${e.message}\n`);
    return null;
  }
}

function git(args) {
  return spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf-8" });
}

function commitExists(sha) {
  if (!sha) return false;
  return git(["cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

/** Returns true if any commit in sinceSha..HEAD touched any of `paths`. */
function hasChangesIn(sinceSha, paths) {
  const r = git(["log", `${sinceSha}..HEAD`, "--name-only", "--pretty=format:", "--", ...paths]);
  if (r.status !== 0) return null;
  const touched = r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
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

/** Pick the most recent lastCommit across all suites as the global baseline. */
function newestRecordedCommit(skillsRecord) {
  const entries = Object.values(skillsRecord || {}).filter((e) => e && e.lastCommit);
  if (entries.length === 0) return null;
  entries.sort((a, b) => (Date.parse(b.lastRun || "") || 0) - (Date.parse(a.lastRun || "") || 0));
  return entries[0].lastCommit;
}

function emit(args, slugs) {
  if (args.json) {
    process.stdout.write(JSON.stringify(slugs) + "\n");
  } else {
    for (const slug of slugs) process.stdout.write(slug + "\n");
  }
}

function main() {
  const args = parseArgs(process.argv);
  const scores = loadScores();
  const changed = [];

  if (!scores) {
    log(args.verbose, "no eval-scores.json — flagging every suite as changed");
    emit(args, SUITES.map((s) => s.suite));
    return;
  }

  const skillsRecord = scores.skills || {};
  const globalBaseline = newestRecordedCommit(skillsRecord);

  if (globalBaseline) {
    const globalChanged = hasChangesIn(globalBaseline, GLOBAL_TRIGGERS);
    if (globalChanged) {
      log(args.verbose, `global triggers changed since ${globalBaseline} — flagging every suite`);
      emit(args, SUITES.map((s) => s.suite));
      return;
    }
  }

  for (const suite of SUITES) {
    const record = skillsRecord[suite.skillKey];
    const baseline = args.base || (record && record.lastCommit) || null;

    if (!baseline) {
      log(args.verbose, `${suite.suite}: no recorded lastCommit — flagging as changed`);
      changed.push(suite.suite);
      continue;
    }

    if (!commitExists(baseline)) {
      log(args.verbose, `${suite.suite}: baseline ${baseline} not in history — flagging as changed`);
      changed.push(suite.suite);
      continue;
    }

    const result = hasChangesIn(baseline, pathsForSuite(suite));
    if (result === null) {
      log(args.verbose, `${suite.suite}: git log failed — flagging as changed`);
      changed.push(suite.suite);
    } else if (result) {
      log(args.verbose, `${suite.suite}: changes since ${baseline} — flagging`);
      changed.push(suite.suite);
    } else {
      log(args.verbose, `${suite.suite}: no changes since ${baseline} — skipping`);
    }
  }

  emit(args, changed);
}

main();
