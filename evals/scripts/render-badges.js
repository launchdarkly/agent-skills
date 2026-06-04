#!/usr/bin/env node
/**
 * Sync per-skill README badges from eval-scores.json.
 *
 * Locates the marker block in each skill's README:
 *   <!-- eval-score:start -->
 *   ...
 *   <!-- eval-score:end -->
 *
 * and rewrites only the contents between markers. If markers are missing the
 * block is appended to the end of the README. If no README exists a minimal
 * stub is created.
 *
 * Run via `npm run eval:badges` from evals/.
 */

const fs = require("node:fs");
const path = require("node:path");

const { SUITES } = require("./_manifest");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCORES_PATH = path.join(REPO_ROOT, "eval-scores.json");
const START = "<!-- eval-score:start -->";
const END = "<!-- eval-score:end -->";

function loadScores() {
  if (!fs.existsSync(SCORES_PATH)) {
    console.error(`[render-badges] no eval-scores.json at ${SCORES_PATH}; run \`npm run eval:all\` first`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SCORES_PATH, "utf-8"));
}

function badgeContent(entry) {
  if (!entry || typeof entry.score !== "number") {
    return [START, "_Eval score not yet recorded._", END].join("\n");
  }
  const date = (entry.lastRun || "").slice(0, 10) || "unknown";
  const status = entry.status === "passing" ? "passing" : "needs attention";
  return [
    START,
    `**Eval score:** ${entry.score}/100 (${entry.passed}/${entry.total} passing, ${status}) — last run ${date}`,
    END,
  ].join("\n");
}

function rewriteReadme(content, block) {
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return content.replace(/\n+$/, "") + "\n\n" + block + "\n";
  }
  return content.slice(0, startIdx) + block + content.slice(endIdx + END.length);
}

function main() {
  const scores = loadScores();
  const entries = scores.skills || {};
  let updated = 0, skipped = 0, stubs = 0;

  for (const suite of SUITES) {
    if (!suite.readme) { skipped++; continue; }
    const readmePath = path.join(REPO_ROOT, suite.readme);
    const readmeDir = path.dirname(readmePath);

    if (!fs.existsSync(readmeDir)) {
      console.warn(`[render-badges] skipping ${suite.skillKey}: directory not found`);
      skipped++;
      continue;
    }

    const isNewStub = !fs.existsSync(readmePath);
    const before = isNewStub
      ? `# ${suite.skillKey}\n\nSee [SKILL.md](./SKILL.md) for the skill's contents.\n`
      : fs.readFileSync(readmePath, "utf-8");

    const block = badgeContent(entries[suite.skillKey]);
    const after = rewriteReadme(before, block);

    if (after === before && !isNewStub) { skipped++; continue; }

    fs.writeFileSync(readmePath, after, "utf-8");
    if (isNewStub) {
      stubs++;
      console.log(`[render-badges] created ${path.relative(REPO_ROOT, readmePath)} (stub)`);
    } else {
      updated++;
      console.log(`[render-badges] updated ${path.relative(REPO_ROOT, readmePath)}`);
    }
  }

  console.log(`[render-badges] done: ${updated} updated, ${stubs} stubs created, ${skipped} unchanged`);
}

main();
