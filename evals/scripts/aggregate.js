#!/usr/bin/env node
/**
 * Run skill eval suites and aggregate results into eval-scores.json at the
 * repo root.
 *
 * Modes:
 *   node scripts/aggregate.js              # rebuild from existing results.json
 *   node scripts/aggregate.js --run        # run every suite then aggregate
 *   node scripts/aggregate.js --run --only=configs-create,configs-update
 *
 * Exits 0 on success, 1 on failure.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { SUITES } = require("./_manifest");

const REPO_ROOT = path.resolve(__dirname, "../..");
const EVALS_DIR = path.resolve(__dirname, "..");
const SCORES_PATH = path.join(REPO_ROOT, "eval-scores.json");
const PROMPTFOO_BIN = path.join(EVALS_DIR, "node_modules", ".bin", "promptfoo");

function parseArgs(argv) {
  const args = { run: false, only: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--run") args.run = true;
    else if (arg.startsWith("--only=")) {
      args.only = arg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write("Usage: aggregate.js [--run] [--only=<slug,slug,...>]\n");
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
    console.error(`aggregate.js: unknown suite slugs: ${unknown.join(", ")}`);
    console.error(`Known suites: ${SUITES.map((s) => s.suite).join(", ")}`);
    process.exit(1);
  }
  return matched;
}

function headCommit() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

function runSuite(suite) {
  const outFile = path.join(EVALS_DIR, suite.suite, "results.json");
  console.log(`\n▶ Running eval suite: ${suite.suite}`);

  const result = spawnSync(
    PROMPTFOO_BIN,
    [
      "eval",
      "-c", path.join(EVALS_DIR, "shared", "defaults.yaml"),
      "-c", path.join(EVALS_DIR, suite.suite, "promptfooconfig.yaml"),
      ...(fs.existsSync(path.join(EVALS_DIR, ".env")) ? ["--env-file", path.join(EVALS_DIR, ".env")] : []),
      "--no-cache",
      "-o", outFile,
    ],
    { cwd: EVALS_DIR, stdio: "inherit", env: { ...process.env } },
  );

  // promptfoo exits 100 when tests ran but some failed — that's a valid run,
  // results.json is still written. Treat any other non-zero as a hard failure.
  if (result.status !== 0 && result.status !== 100) {
    console.error(`✗ Suite ${suite.suite} exited with status ${result.status}`);
    return false;
  }
  return true;
}

function readResults(suite) {
  const outFile = path.join(EVALS_DIR, suite.suite, "results.json");
  if (!fs.existsSync(outFile)) {
    console.error(`aggregate.js: results.json not found for "${suite.suite}" — run with --run first`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(outFile, "utf-8"));
  } catch (e) {
    console.error(`aggregate.js: failed to parse results.json for "${suite.suite}": ${e.message}`);
    return null;
  }
}

function summarize(suite, results, commit) {
  const tests = results?.results?.results || results?.results || [];
  const arr = Array.isArray(tests) ? tests : [];
  const knownRed = new Set(suite.knownRed || []);
  const total = arr.length;
  const passed = arr.filter((t) => t.success).length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  // promptfoo stores the fixture's `description` under testCase, not at the top
  // level; fall back to a slice of the prompt only when neither is present.
  const describe = (t) =>
    t.testCase?.description || t.description || t.vars?.user_request?.slice(0, 80) || "";
  const perTest = arr.map((t) => {
    const description = describe(t);
    return {
      description,
      pass: t.success,
      score: t.score ?? (t.success ? 1.0 : 0.0),
      knownRed: knownRed.has(description),
    };
  });

  // The gate ignores intentionally-red fixtures so a tracked capability gap
  // doesn't fail CI — but the reported score/badge stays honest (below) so the
  // red signal remains visible. A known-red fixture that starts passing is
  // surfaced (unexpectedGreen) so its allowlist entry can be removed.
  const gated = perTest.filter((t) => !t.knownRed);
  const gatePassed = gated.filter((t) => t.pass).length;
  const gateScore = gated.length > 0 ? Math.round((gatePassed / gated.length) * 100) : 100;
  const unexpectedGreen = perTest
    .filter((t) => t.knownRed && t.pass)
    .map((t) => t.description);

  return {
    score,
    passed,
    total,
    status: score >= 75 ? "passing" : "failing",
    gateScore,
    knownRed: perTest.filter((t) => t.knownRed).map((t) => t.description),
    unexpectedGreen,
    lastCommit: commit || null,
    lastRun: new Date().toISOString(),
    perTest,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const suites = selectSuites(args.only);
  const commit = headCommit();

  if (args.run) {
    let anyFailed = false;
    for (const suite of suites) {
      if (!runSuite(suite)) anyFailed = true;
    }
    if (anyFailed) {
      console.error("\naggregate.js: one or more suites failed to run.");
      process.exit(1);
    }
  }

  let existing = {};
  if (fs.existsSync(SCORES_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(SCORES_PATH, "utf-8")).skills || {};
    } catch {
      existing = {};
    }
  }

  const skills = { ...existing };
  let anyError = false;

  for (const suite of suites) {
    const results = readResults(suite);
    if (!results) { anyError = true; continue; }
    skills[suite.skillKey] = summarize(suite, results, commit);
    const s = skills[suite.skillKey];
    const icon = s.status === "passing" ? "✓" : "✗";
    const redNote = s.knownRed.length > 0 ? ` [${s.knownRed.length} known-red tolerated]` : "";
    console.log(`${icon} ${suite.skillKey}: ${s.passed}/${s.total} passed (${s.score}%)${redNote}`);
    for (const desc of s.unexpectedGreen) {
      console.warn(`  ⚠ known-red fixture now PASSES: "${desc}" — remove it from knownRed in scripts/_manifest.js`);
    }
  }

  const output = { schemaVersion: 1, updatedAt: new Date().toISOString(), skills };
  fs.writeFileSync(SCORES_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nWrote ${SCORES_PATH}`);

  // Gate on gateScore, which excludes intentionally-red fixtures. The reported
  // score above stays honest; only unexpected (non-allowlisted) failures fail CI.
  const belowThreshold = suites
    .filter((suite) => skills[suite.skillKey] && skills[suite.skillKey].gateScore < 75)
    .map((suite) => suite.skillKey);
  if (belowThreshold.length > 0) {
    console.error(`\naggregate.js: suites below 75% threshold (excluding known-red): ${belowThreshold.join(", ")}`);
  }
  if (anyError || belowThreshold.length > 0) process.exit(1);
}

if (require.main === module) main();

module.exports = { summarize, selectSuites };
