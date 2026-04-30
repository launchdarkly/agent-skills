#!/usr/bin/env node
/**
 * Sync per-skill README badges from eval-scores.json.
 *
 * For each entry in eval-scores.json -> skills, find the skill's README,
 * locate the marker block:
 *
 *   <!-- eval-score:start -->
 *   ... anything ...
 *   <!-- eval-score:end -->
 *
 * and rewrite only the contents between markers. If the markers are
 * missing, the block is appended to the end of the README. Manual
 * content outside the marker block is preserved exactly.
 *
 * If a skill ships only a SKILL.md without a README, a minimal stub
 * README is created with the badge block plus a pointer to SKILL.md.
 *
 * Run via `npm run eval:badges` from evals/.
 */

const fs = require("node:fs");
const path = require("node:path");

const { SUITES } = require("./_manifest");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCORES_PATH = path.join(REPO_ROOT, "eval-scores.json");

const START_MARKER = "<!-- eval-score:start -->";
const END_MARKER = "<!-- eval-score:end -->";

function loadScores() {
  if (!fs.existsSync(SCORES_PATH)) {
    console.error(
      `[render-badges] no eval-scores.json at ${path.relative(REPO_ROOT, SCORES_PATH)}; run \`npm run eval:all\` first`,
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SCORES_PATH, "utf-8"));
}

function badgeContent(entry) {
  if (!entry || entry.score === null || typeof entry.score !== "number") {
    return [
      "<!-- eval-score:start -->",
      "_Eval score not yet recorded._",
      "<!-- eval-score:end -->",
    ].join("\n");
  }
  const date = (entry.lastRun || "").slice(0, 10) || "unknown";
  const status = entry.status === "passing" ? "passing" : "needs attention";
  return [
    START_MARKER,
    `**Eval score:** ${entry.score}/100 (${entry.passed}/${entry.total} passing, ${status}) - last run ${date}`,
    END_MARKER,
  ].join("\n");
}

function rewriteReadme(content, block) {
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    const sep = content.endsWith("\n") ? "\n" : "\n\n";
    return content.replace(/\n+$/, "") + sep + block + "\n";
  }

  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx + END_MARKER.length);
  return before + block + after;
}

function ensureReadme(readmePath, skillName) {
  if (fs.existsSync(readmePath)) return fs.readFileSync(readmePath, "utf-8");
  // Minimal stub for skills without a README.
  return [
    `# ${skillName}`,
    "",
    `See [SKILL.md](./SKILL.md) for the skill's contents.`,
    "",
  ].join("\n");
}

function main() {
  const scores = loadScores();
  const entries = scores.skills || {};

  let updated = 0;
  let skipped = 0;
  let createdStubs = 0;

  for (const suite of SUITES) {
    const readmePath = path.join(REPO_ROOT, suite.readme);
    const readmeDir = path.dirname(readmePath);
    if (!fs.existsSync(readmeDir)) {
      console.warn(`[render-badges] skipping ${suite.skillKey}: ${path.relative(REPO_ROOT, readmeDir)} does not exist`);
      skipped += 1;
      continue;
    }

    const isNewStub = !fs.existsSync(readmePath);
    const before = ensureReadme(readmePath, suite.skillKey);
    const block = badgeContent(entries[suite.skillKey]);
    const after = rewriteReadme(before, block);

    if (after === before && !isNewStub) {
      skipped += 1;
      continue;
    }

    fs.writeFileSync(readmePath, after, "utf-8");
    if (isNewStub) {
      createdStubs += 1;
      console.log(`[render-badges] created ${path.relative(REPO_ROOT, readmePath)} (stub)`);
    } else {
      updated += 1;
      console.log(`[render-badges] updated ${path.relative(REPO_ROOT, readmePath)}`);
    }
  }

  console.log(
    `[render-badges] done: ${updated} updated, ${createdStubs} stubs created, ${skipped} unchanged`,
  );
}

main();
