#!/usr/bin/env node
/**
 * Run skill eval suites under one or more agent (system-under-test) models.
 *
 * The default eval flow (`npm run eval:all`) runs each suite once on the model
 * named by AGENT_MODEL (claude-sonnet-4-6 by default). This script lets you
 * compare the same suites across multiple models — e.g. "does my SKILL.md
 * still pass on Haiku, or did I overfit to Sonnet?" — without juggling .env edits.
 *
 * Usage:
 *   node scripts/run-models.js --model=haiku
 *   node scripts/run-models.js --model=sonnet --only=aiconfig-create
 *   node scripts/run-models.js --models=haiku,sonnet,opus
 *
 * Output:
 *   - <suite>/results.<alias>.json  per (model, suite)
 *   - Summary table comparing pass-counts and average scores across all pairs
 *   - Does NOT touch eval-scores.json — that baseline is only written by `eval:all`
 *
 * To promote a model run to the canonical scores, copy
 * `<suite>/results.<alias>.json` -> `<suite>/results.json` then run `eval:aggregate`.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { SUITES } = require("./_manifest");
const { resolveModel, aliasFor, MODEL_ALIASES } = require("./_models");

const EVALS_DIR = path.resolve(__dirname, "..");
const PROMPTFOO_BIN = path.join(EVALS_DIR, "node_modules", ".bin", "promptfoo");

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
      console.log(usage());
      process.exit(0);
    } else {
      console.error(`run-models.js: unknown arg "${arg}"`);
      console.log(usage());
      process.exit(1);
    }
  }
  if (args.models.length === 0) {
    console.error("run-models.js: at least one --model=<alias|id> is required");
    console.log(usage());
    process.exit(1);
  }
  return args;
}

function usage() {
  return [
    "Usage: node scripts/run-models.js --model=<alias|id> [--only=<slug,...>]",
    "       node scripts/run-models.js --models=haiku,sonnet,opus",
    "",
    "Aliases:",
    ...Object.entries(MODEL_ALIASES).map(([a, id]) => `  ${a.padEnd(8)}${id}`),
    "",
    "Examples:",
    "  npm run eval:haiku",
    "  npm run eval:matrix",
    "  node scripts/run-models.js --model=haiku --only=aiconfig-create",
  ].join("\n");
}

function selectSuites(only) {
  if (!only || only.length === 0) return SUITES.slice();
  const set = new Set(only);
  const matched = SUITES.filter((s) => set.has(s.suite));
  const unknown = only.filter((s) => !SUITES.find((suite) => suite.suite === s));
  if (unknown.length > 0) {
    console.error(`run-models.js: unknown suites: ${unknown.join(", ")}`);
    process.exit(1);
  }
  return matched;
}

function runSuiteWithModel(suite, modelId, alias) {
  const outputPath = path.join(EVALS_DIR, suite.suite, `results.${alias}.json`);
  console.log(`\n[run-models] suite=${suite.suite} model=${alias} (${modelId})`);

  const result = spawnSync(
    PROMPTFOO_BIN,
    [
      "eval",
      "-c", "shared/defaults.yaml",
      "-c", `${suite.suite}/promptfooconfig.yaml`,
      "-o", outputPath,
      "--env-file", ".env",
      "--no-cache",
    ],
    { cwd: EVALS_DIR, stdio: "inherit", env: { ...process.env, AGENT_MODEL: modelId } },
  );

  if (result.error) {
    console.error(`[run-models] launch error: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0 && result.status !== 100) {
    console.error(`[run-models] suite ${suite.suite} exited with status ${result.status}`);
    return false;
  }
  return true;
}

function readResults(suite, alias) {
  const p = path.join(EVALS_DIR, suite.suite, `results.${alias}.json`);
  if (!fs.existsSync(p)) return { error: `missing results.${alias}.json` };
  try {
    return { parsed: JSON.parse(fs.readFileSync(p, "utf-8")) };
  } catch (e) {
    return { error: `unparseable: ${e.message}` };
  }
}

function summarise(parsed) {
  const rawResults = parsed.results?.results || parsed.results || [];
  const arr = Array.isArray(rawResults) ? rawResults : [];
  const successes = arr.filter((r) => r && r.success).length;
  const total = arr.length;
  const scores = arr
    .map((r) => r?.score ?? r?.gradingResult?.score)
    .filter((s) => typeof s === "number");
  const avgScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
      : null;
  return { successes, total, avgScore };
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printMatrix(rows, aliases, suites) {
  const suiteWidth = Math.max(6, ...suites.map((s) => s.suite.length));
  const header = "  " + pad("suite", suiteWidth) + "  " + aliases.map((a) => pad(a, 16)).join("  ");
  const sep = "  " + "-".repeat(suiteWidth) + "  " + aliases.map(() => "-".repeat(16)).join("  ");
  console.log("\n[run-models] Summary (passed/total · avg_score%):");
  console.log(header);
  console.log(sep);
  for (const suite of suites) {
    const cells = aliases.map((alias) => {
      const cell = rows[`${alias}::${suite.suite}`];
      if (!cell) return pad("(no results)", 16);
      if (cell.error) return pad("error", 16);
      return pad(`${cell.successes}/${cell.total} · ${cell.avgScore ?? "-"}%`, 16);
    });
    console.log("  " + pad(suite.suite, suiteWidth) + "  " + cells.join("  "));
  }
}

function main() {
  const args = parseArgs(process.argv);
  const suites = selectSuites(args.only);
  const modelEntries = args.models.map((m) => ({
    id: resolveModel(m),
    alias: aliasFor(resolveModel(m)),
  }));

  console.log("[run-models] models = " + modelEntries.map((m) => `${m.alias}(${m.id})`).join(", "));
  console.log("[run-models] suites = " + suites.map((s) => s.suite).join(", "));

  let launchFailures = 0;
  for (const m of modelEntries) {
    for (const suite of suites) {
      if (!runSuiteWithModel(suite, m.id, m.alias)) launchFailures++;
    }
  }

  const rows = {};
  let aggFailures = 0;
  for (const m of modelEntries) {
    for (const suite of suites) {
      const key = `${m.alias}::${suite.suite}`;
      const { parsed, error } = readResults(suite, m.alias);
      rows[key] = error ? { error } : summarise(parsed);
      if (error) aggFailures++;
    }
  }

  printMatrix(rows, modelEntries.map((m) => m.alias), suites);

  if (launchFailures > 0 || aggFailures > 0) {
    console.error(`\n[run-models] ${launchFailures} launch failure(s), ${aggFailures} missing result(s)`);
    process.exit(1);
  }
}

main();
