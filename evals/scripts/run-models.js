#!/usr/bin/env node
/**
 * Run skill eval suites under one or more agent (system-under-test) models.
 *
 * The default eval flow (`npm run eval:all`) runs each suite once on the
 * model named by AGENT_MODEL (Sonnet 4 by default). This script lets you
 * quickly compare the same suites across multiple models — typically to
 * answer "does my SKILL.md still pass on Haiku, or did I overfit to
 * Sonnet?" — without juggling .env edits.
 *
 * Usage:
 *   node scripts/run-models.js --model=haiku
 *   node scripts/run-models.js --model=sonnet --only=aiconfig-create
 *   node scripts/run-models.js --models=haiku,sonnet,opus
 *   node scripts/run-models.js --model=claude-something-newer-2026 \
 *                              --only=aiconfig-create,aiconfig-tools
 *
 * Aliases (haiku/sonnet/opus) are resolved via scripts/_models.js. Any
 * non-alias value is passed straight through as a raw Anthropic model id.
 *
 * Output:
 *   - <suite>/results.<alias>.json  (full promptfoo output, per (model, suite))
 *   - Summary table printed to stdout comparing pass-counts and average
 *     scores across all (model, suite) pairs that ran.
 *   - Does NOT touch the canonical eval-scores.json — that remains the
 *     baseline produced by `npm run eval:all` so PR-blocking thresholds
 *     are not perturbed by experimental cross-model runs. To aggregate a
 *     particular model run into eval-scores.json, copy
 *     `<suite>/results.<alias>.json` over `<suite>/results.json` and then
 *     run `npm run eval:aggregate`.
 *
 * Exit codes:
 *   0 if every (model, suite) pair produced parseable results.json (note:
 *     individual test failures inside promptfoo are not script failures —
 *     they're surfaced in the summary).
 *   1 if any pair failed to launch promptfoo or wrote no results.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { SUITES } = require("./_manifest");
const { resolveModel, aliasFor, MODEL_ALIASES } = require("./_models");

const EVALS_DIR = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { models: [], only: null };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--model=")) {
      args.models.push(arg.slice("--model=".length));
    } else if (arg.startsWith("--models=")) {
      args.models.push(
        ...arg
          .slice("--models=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg.startsWith("--only=")) {
      args.only = arg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    } else {
      console.error(`run-models.js: unknown arg "${arg}"`);
      process.stdout.write(usage());
      process.exit(1);
    }
  }
  if (args.models.length === 0) {
    console.error(
      "run-models.js: at least one --model=<alias|id> is required",
    );
    process.stdout.write(usage());
    process.exit(1);
  }
  return args;
}

function usage() {
  return [
    "Usage: node scripts/run-models.js --model=<alias|id> [--only=<slug,...>]",
    "       node scripts/run-models.js --models=haiku,sonnet,opus",
    "",
    "Aliases (edit scripts/_models.js to update):",
    ...Object.entries(MODEL_ALIASES).map(
      ([alias, id]) => `  ${alias.padEnd(8)}${id}`,
    ),
    "",
    "Examples:",
    "  npm run eval:haiku",
    "  npm run eval:matrix",
    "  node scripts/run-models.js --model=haiku --only=aiconfig-create",
    "",
  ].join("\n");
}

function selectSuites(only) {
  if (!only || only.length === 0) return SUITES.slice();
  const set = new Set(only);
  const matched = SUITES.filter((s) => set.has(s.suite));
  const unknown = only.filter(
    (s) => !SUITES.find((suite) => suite.suite === s),
  );
  if (unknown.length > 0) {
    console.error(
      `run-models.js: unknown suite slugs in --only: ${unknown.join(", ")}`,
    );
    console.error(`Known suites: ${SUITES.map((s) => s.suite).join(", ")}`);
    process.exit(1);
  }
  return matched;
}

function runSuiteWithModel(suite, modelId, alias) {
  const outputPath = `${suite.suite}/results.${alias}.json`;
  const args = [
    "exec",
    "--",
    "promptfoo",
    "eval",
    "-c",
    "shared/defaults.yaml",
    "-c",
    `${suite.suite}/promptfooconfig.yaml`,
    "-o",
    outputPath,
    "--env-file",
    ".env",
    "--no-cache",
  ];
  console.log(
    `\n[run-models] suite=${suite.suite} model=${alias} (${modelId})`,
  );
  console.log(`             output -> ${outputPath}`);

  const env = { ...process.env, AGENT_MODEL: modelId };
  const result = spawnSync("npm", args, {
    cwd: EVALS_DIR,
    stdio: "inherit",
    env,
  });
  if (result.error) {
    console.error(
      `[run-models] failed to launch promptfoo: ${result.error.message}`,
    );
    return false;
  }
  // promptfoo exits 100 on assertion failures; that's not a script error.
  return true;
}

function readResults(suite, alias) {
  const resultsPath = path.join(
    EVALS_DIR,
    suite.suite,
    `results.${alias}.json`,
  );
  if (!fs.existsSync(resultsPath))
    return { error: `missing ${path.basename(resultsPath)}` };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  } catch (e) {
    return { error: `unparseable ${path.basename(resultsPath)}: ${e.message}` };
  }
  return { parsed };
}

function summarise(parsed) {
  const inner = parsed.results || {};
  const rawResults = inner.results || parsed.results || [];
  const stats = inner.stats || parsed.stats || {};
  const successes =
    stats.successes ?? rawResults.filter((r) => r && r.success).length;
  const failures =
    stats.failures ?? rawResults.filter((r) => r && r.success === false).length;
  const errors = stats.errors ?? rawResults.filter((r) => r && r.error).length;
  const total = rawResults.length || successes + failures + errors;

  const numeric = rawResults
    .map((r) =>
      typeof r.score === "number"
        ? r.score
        : r.gradingResult && typeof r.gradingResult.score === "number"
          ? r.gradingResult.score
          : null,
    )
    .filter((s) => typeof s === "number");
  const avgScore =
    numeric.length > 0
      ? Math.round(
          (numeric.reduce((s, x) => s + x, 0) / numeric.length) * 100,
        )
      : null;

  return { successes, failures, errors, total, avgScore };
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printMatrix(rows, models, suites) {
  const aliasWidth = Math.max(
    6,
    ...models.map((m) => m.length),
  );
  const suiteWidth = Math.max(
    6,
    ...suites.map((s) => s.suite.length),
  );
  const header =
    "  " +
    pad("suite", suiteWidth) +
    "  " +
    models.map((m) => pad(m, 14)).join("  ");
  const sep =
    "  " +
    "-".repeat(suiteWidth) +
    "  " +
    models.map(() => "-".repeat(14)).join("  ");
  console.log("\n[run-models] Summary (passed/total · score):");
  console.log(header);
  console.log(sep);
  for (const suite of suites) {
    const cells = models.map((alias) => {
      const cell = rows[`${alias}::${suite.suite}`];
      if (!cell) return pad("(no results)", 14);
      if (cell.error) return pad("error", 14);
      return pad(
        `${cell.successes}/${cell.total} · ${cell.avgScore ?? "-"}`,
        14,
      );
    });
    console.log("  " + pad(suite.suite, suiteWidth) + "  " + cells.join("  "));
  }
}

function main() {
  const args = parseArgs(process.argv);
  const suites = selectSuites(args.only);
  const modelEntries = args.models.map((m) => ({
    input: m,
    id: resolveModel(m),
    alias: aliasFor(resolveModel(m)),
  }));

  console.log("[run-models] running:");
  console.log(
    "             models = " +
      modelEntries.map((m) => `${m.alias}(${m.id})`).join(", "),
  );
  console.log(
    "             suites = " + suites.map((s) => s.suite).join(", "),
  );

  let launchFailures = 0;
  for (const m of modelEntries) {
    for (const suite of suites) {
      const ok = runSuiteWithModel(suite, m.id, m.alias);
      if (!ok) launchFailures += 1;
    }
  }

  // Aggregate results into a flat map keyed by `<alias>::<suite>`.
  const rows = {};
  let aggFailures = 0;
  for (const m of modelEntries) {
    for (const suite of suites) {
      const { parsed, error } = readResults(suite, m.alias);
      const key = `${m.alias}::${suite.suite}`;
      if (error) {
        rows[key] = { error };
        aggFailures += 1;
        continue;
      }
      rows[key] = summarise(parsed);
    }
  }

  printMatrix(
    rows,
    modelEntries.map((m) => m.alias),
    suites,
  );

  if (launchFailures > 0 || aggFailures > 0) {
    console.error(
      `\n[run-models] ${launchFailures} launch failure(s), ${aggFailures} missing/unparseable result(s)`,
    );
    process.exit(1);
  }
}

main();
