#!/usr/bin/env node
/**
 * Run skill eval suites and aggregate results into eval-scores.json at the
 * repo root.
 *
 * Modes:
 *   node scripts/aggregate.js              # rebuild eval-scores.json from
 *                                          # existing <suite>/results.json
 *                                          # files (no API calls).
 *   node scripts/aggregate.js --run        # run every suite then aggregate.
 *   node scripts/aggregate.js --run --only=aiconfig-create,aiconfig-tools
 *                                          # run a subset, aggregate only
 *                                          # those (other entries in
 *                                          # eval-scores.json are preserved).
 *   node scripts/aggregate.js --only=...   # aggregate from existing results.json
 *                                          # for those suites only.
 *
 * Exits 0 on success, 1 on failure (e.g. promptfoo errored, results.json
 * missing for a requested suite, etc.).
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { SUITES } = require("./_manifest");

const REPO_ROOT = path.resolve(__dirname, "../..");
const EVALS_DIR = path.resolve(__dirname, "..");
const SCORES_PATH = path.join(REPO_ROOT, "eval-scores.json");

function parseArgs(argv) {
  const args = { run: false, only: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--run") args.run = true;
    else if (arg.startsWith("--only=")) {
      args.only = arg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`Usage: aggregate.js [--run] [--only=<slug,slug,...>]\n`);
      process.exit(0);
    }
  }
  return args;
}

function selectSuites(only) {
  if (!only || only.length === 0) return SUITES.slice();
  const set = new Set(only);
  const matched = SUITES.filter((s) => set.has(s.suite));
  const unknown = only.filter((s) => !SUITES.find((suite) => suite.suite === s));
  if (unknown.length > 0) {
    console.error(
      `aggregate.js: unknown suite slugs in --only: ${unknown.join(", ")}`,
    );
    console.error(
      `Known suites: ${SUITES.map((s) => s.suite).join(", ")}`,
    );
    process.exit(1);
  }
  return matched;
}

function runSuite(suite) {
  const configs = ["-c", "shared/defaults.yaml", "-c", `${suite.suite}/promptfooconfig.yaml`];
  const out = ["-o", `${suite.suite}/results.json`];
  const args = [
    "exec",
    "--",
    "promptfoo",
    "eval",
    ...configs,
    ...out,
    "--env-file",
    ".env",
    "--no-cache",
  ];

  console.log(`\n[aggregate] running suite: ${suite.suite}`);
  console.log(`            cmd: npm ${args.join(" ")}`);
  const result = spawnSync("npm", args, {
    cwd: EVALS_DIR,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`[aggregate] failed to launch promptfoo for ${suite.suite}:`, result.error.message);
    return false;
  }
  // promptfoo exits non-zero when assertions fail (typically 100). That is
  // not a script-level failure - downstream readResults will pick up the
  // results.json that was just written. Only treat the absence of
  // results.json as fatal (handled by readResults later).
  return true;
}

function readResults(suite) {
  const resultsPath = path.join(EVALS_DIR, suite.suite, "results.json");
  if (!fs.existsSync(resultsPath)) {
    return { error: `missing ${path.relative(REPO_ROOT, resultsPath)}` };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  } catch (e) {
    return { error: `unparseable ${path.relative(REPO_ROOT, resultsPath)}: ${e.message}` };
  }
  return { parsed };
}

/**
 * Normalise a promptfoo results.json (the file written by `promptfoo eval -o`)
 * into a per-suite summary suited for eval-scores.json.
 *
 * promptfoo schema is somewhat verbose; we read defensively.
 */
function summariseSuite(suite, parsed) {
  const inner = parsed.results || {};
  const rawResults = inner.results || parsed.results || [];
  const stats = inner.stats || parsed.stats || {};
  const successes = stats.successes ?? rawResults.filter((r) => r && r.success).length;
  const failures = stats.failures ?? rawResults.filter((r) => r && r.success === false).length;
  const errors = stats.errors ?? rawResults.filter((r) => r && r.error).length;
  const total = rawResults.length || successes + failures + errors;

  const perTest = rawResults.map((r) => {
    const desc =
      (r.description && String(r.description)) ||
      (r.testCase && r.testCase.description) ||
      (r.testIdx !== undefined ? `test #${r.testIdx}` : "(unnamed)");
    const score =
      typeof r.score === "number"
        ? r.score
        : (r.gradingResult && typeof r.gradingResult.score === "number"
            ? r.gradingResult.score
            : null);
    return {
      description: desc,
      pass: Boolean(r.success),
      score: score === null ? null : Number(score.toFixed(3)),
    };
  });

  const numeric = perTest.filter((t) => typeof t.score === "number");
  const avgScore =
    numeric.length > 0
      ? numeric.reduce((s, t) => s + t.score, 0) / numeric.length
      : null;
  const score = avgScore === null ? null : Math.round(avgScore * 100);
  const status =
    errors > 0 ? "error" : failures === 0 && total > 0 ? "passing" : "failing";

  return {
    score,
    passed: successes,
    total,
    status,
    lastCommit: lastCommitFor(suite.skillDir),
    lastRun: inner.timestamp || parsed.timestamp || new Date().toISOString(),
    perTest,
  };
}

function lastCommitFor(skillDir) {
  const result = spawnSync(
    "git",
    ["log", "-1", "--format=%h", "--", skillDir],
    { cwd: REPO_ROOT, encoding: "utf-8" },
  );
  if (result.error || result.status !== 0) return null;
  const sha = result.stdout.trim();
  return sha || null;
}

function loadExistingScores() {
  if (!fs.existsSync(SCORES_PATH)) {
    return { schemaVersion: 1, updatedAt: null, skills: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(SCORES_PATH, "utf-8"));
  } catch (e) {
    console.error(`[aggregate] could not parse existing eval-scores.json (${e.message}); starting fresh`);
    return { schemaVersion: 1, updatedAt: null, skills: {} };
  }
}

function main() {
  const args = parseArgs(process.argv);
  const suites = selectSuites(args.only);

  if (args.run) {
    let runFailures = 0;
    for (const suite of suites) {
      const ok = runSuite(suite);
      if (!ok) {
        runFailures += 1;
        console.error(`[aggregate] suite ${suite.suite} could not be launched; skipping`);
      }
    }
    if (runFailures === suites.length) {
      console.error(`[aggregate] every suite failed to launch (${runFailures}/${suites.length}); aborting`);
      process.exit(1);
    }
  }

  const existing = loadExistingScores();
  const skills = { ...existing.skills };
  let aggregateFailures = 0;

  for (const suite of suites) {
    const { parsed, error } = readResults(suite);
    if (error) {
      console.error(`[aggregate] ${suite.suite}: ${error}`);
      aggregateFailures += 1;
      continue;
    }
    skills[suite.skillKey] = summariseSuite(suite, parsed);
    console.log(
      `[aggregate] ${suite.skillKey}: ${skills[suite.skillKey].passed}/${skills[suite.skillKey].total} passing, score=${skills[suite.skillKey].score}`,
    );
  }

  const out = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    skills,
  };

  fs.writeFileSync(SCORES_PATH, JSON.stringify(out, null, 2) + "\n", "utf-8");
  console.log(`[aggregate] wrote ${path.relative(REPO_ROOT, SCORES_PATH)}`);

  if (aggregateFailures > 0 && !args.run) {
    console.error(
      `[aggregate] ${aggregateFailures} suite(s) had no usable results.json; ` +
        `re-run with --run to produce them.`,
    );
    process.exit(1);
  }
}

main();
