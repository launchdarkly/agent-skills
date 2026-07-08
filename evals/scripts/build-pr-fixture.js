#!/usr/bin/env node
/**
 * Build a should-flag-change eval fixture from a real GitHub pull request.
 *
 * Usage:
 *   node scripts/build-pr-fixture.js <pr-number> [options]
 *
 * Options:
 *   --repo <owner/repo>   Repo to pull the PR from (default: current gh repo).
 *   --tier <agentic|judgment>
 *                         Which eval tier the fixture targets (default: agentic).
 *                         agentic scaffolds mock_files + git_diff and asserts
 *                         explore-then-decide; judgment inlines the diff only.
 *   --out <path>          Write the fixture YAML here (default: stdout).
 *   --max-files <n>       Max files to scaffold into mock_files (default: 25).
 *   --max-bytes <n>       Skip files whose head content exceeds this (default: 20000).
 *
 * Why these git mechanics (see the design notes in the suite README):
 *   - The DIFF comes from `gh pr diff <N>`, which is merge-strategy independent
 *     and matches the PR's "Files changed" tab. Diffing against post-merge main
 *     would come back empty for squash/merge-commit strategies.
 *   - The FILE TREE comes from `refs/pull/<N>/head` at the PR's head OID, which
 *     is immutable and survives branch deletion, so old merged PRs still work.
 *
 * The emitted fixture carries a BOOTSTRAPPED label, not ground truth: we detect
 * whether the PR added LaunchDarkly SDK calls and guess the verdict from that.
 * A PR that introduces flag usage is evidence the authors decided the change
 * warranted a flag (=> recommend: true). Everything is marked NEEDS REVIEW —
 * a human confirms the label before the fixture is trusted.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const yaml = require(path.join(__dirname, "..", "node_modules", "js-yaml"));

// SDK *call sites* — a flag actually being evaluated. These are the primary
// signal that a PR introduces a flag, and alone flip the bootstrapped label to
// recommend: true.
const LD_CALL_PATTERNS = [
  { re: /\b(?:bool|boolean|string|int|integer|number|numeric|json|float|double)?[vV]ariation(?:Detail)?\s*\(/, label: "*.variation() call" },
  { re: /\buseFlags?\s*\(/, label: "useFlags() hook" },
  { re: /\buseLDClient\s*\(/, label: "useLDClient() hook" },
  { re: /\bwithLDProvider\b/, label: "withLDProvider()" },
];

// Weaker references — an SDK import or client type. On their own these are noisy
// (docs and skill markdown mention package names), so they are recorded as
// supporting evidence for review but do NOT flip the label by themselves.
const LD_REF_PATTERNS = [
  { re: /@launchdarkly\//, label: "@launchdarkly/* import" },
  { re: /\bLDClient\b/, label: "LDClient" },
  { re: /\bldclient\b/, label: "ldclient" },
];

function fail(msg) {
  console.error(`build-pr-fixture: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { tier: "agentic", maxFiles: 25, maxBytes: 20000, repo: null, out: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") opts.repo = argv[++i];
    else if (a === "--tier") opts.tier = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--max-files") opts.maxFiles = Number(argv[++i]);
    else if (a === "--max-bytes") opts.maxBytes = Number(argv[++i]);
    else if (a.startsWith("--")) fail(`unknown option: ${a}`);
    else positional.push(a);
  }
  opts.pr = positional[0];
  if (!opts.pr || !/^\d+$/.test(opts.pr)) {
    fail("first argument must be a PR number, e.g. `node scripts/build-pr-fixture.js 123`");
  }
  if (!["agentic", "judgment"].includes(opts.tier)) {
    fail(`--tier must be 'agentic' or 'judgment', got '${opts.tier}'`);
  }
  return opts;
}

function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    fail(`gh ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: opts.encoding ?? "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

/** Added lines in a unified diff: lines starting with '+' but not the '+++' header. */
function addedLines(diff) {
  return diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));
}

function detectLdUsage(diff) {
  const added = addedLines(diff).join("\n");
  const match = (patterns) => patterns.filter(({ re }) => re.test(added)).map((p) => p.label);
  return { calls: match(LD_CALL_PATTERNS), refs: match(LD_REF_PATTERNS) };
}

function looksBinary(buf) {
  // A NUL byte in the first chunk is a reliable "not text" signal.
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoArgs = opts.repo ? ["-R", opts.repo] : [];

  // 1. PR metadata.
  const meta = JSON.parse(
    gh(["pr", "view", opts.pr, ...repoArgs, "--json", "number,title,url,headRefOid,headRepositoryOwner,headRepository"]),
  );
  const headOid = meta.headRefOid;
  if (!headOid) fail(`could not resolve head OID for PR #${opts.pr}`);

  // 2. Diff (strategy-independent, matches the Files-changed tab).
  const diff = gh(["pr", "diff", opts.pr, ...repoArgs]);
  if (!diff.trim()) fail(`empty diff for PR #${opts.pr} — is it merged/closed with no changes?`);

  const changedFiles = gh(["pr", "diff", opts.pr, ...repoArgs, "--name-only"])
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // 3. Fetch the immutable PR head so `git show <oid>:path` can read files.
  const fetchSource = opts.repo ? `https://github.com/${opts.repo}.git` : "origin";
  try {
    git(["fetch", "--quiet", fetchSource, `refs/pull/${opts.pr}/head`]);
  } catch (err) {
    fail(`git fetch ${fetchSource} refs/pull/${opts.pr}/head failed: ${err.stderr || err.message}`);
  }

  // 4. Read post-change file contents from the head tree -> mock_files.
  const mockFiles = {};
  const skipped = [];
  let included = 0;
  for (const file of changedFiles) {
    if (included >= opts.maxFiles) {
      skipped.push(`${file} (over --max-files=${opts.maxFiles})`);
      continue;
    }
    let buf;
    try {
      buf = git(["show", `${headOid}:${file}`], { encoding: "buffer" });
    } catch {
      skipped.push(`${file} (not present at head — deleted/renamed)`);
      continue;
    }
    if (buf.length > opts.maxBytes) {
      skipped.push(`${file} (${buf.length}B over --max-bytes=${opts.maxBytes})`);
      continue;
    }
    if (looksBinary(buf)) {
      skipped.push(`${file} (binary)`);
      continue;
    }
    mockFiles[file] = buf.toString("utf-8");
    included++;
  }

  // 5. Bootstrap the label from LD SDK usage in the diff. Only call sites flip
  //    the label to true; bare imports are noted for review but don't alone.
  const { calls: ldCalls, refs: ldRefs } = detectLdUsage(diff);
  const introducedFlag = ldCalls.length > 0;
  const recommend = introducedFlag;
  const confidence = introducedFlag ? "medium" : "low";
  const refNote = ldRefs.length ? ` (also saw SDK references: ${ldRefs.join(", ")} — verify these are code, not docs)` : "";
  const bootstrapReason = introducedFlag
    ? `PR diff adds LaunchDarkly SDK call sites (${ldCalls.join(", ")}) — the authors gated this change behind a flag, so the bootstrapped verdict is recommend: true.${refNote}`
    : ldRefs.length
      ? `No LaunchDarkly SDK call sites in added lines, but SDK references are present (${ldRefs.join(", ")}). Bootstrapped verdict is recommend: false — VERIFY: these may be docs/config rather than a flag being evaluated.`
      : `No LaunchDarkly SDK calls detected in added lines — bootstrapped verdict is recommend: false. VERIFY this isn't a user-facing/risky change that shipped unflagged.`;

  // 6. Assemble the fixture. Assertion bodies mirror the hand-written suite.
  const advisoryAssert = [
    "const tools = output.tools_called || [];",
    "const forbidden = ['create-flag','create-feature-flag','update-flag-settings','update-feature-flag','toggle-flag','delete-flag'];",
    "const called = forbidden.filter(f => tools.includes(f));",
    "const pass = called.length === 0;",
    "return { pass, score: pass ? 1 : 0, reason: pass ? 'stayed advisory' : 'called mutating tools: ' + called.join(', ') };",
  ].join("\n");

  const verdictAssert = [
    "const traj = output.trajectory || [];",
    "const call = traj.find(t => t.tool === 'recommend-flag');",
    "if (!call) return { pass: false, score: 0, reason: 'No recommend-flag verdict emitted' };",
    "const a = call.arguments || {};",
    `const pass = a.recommend === ${recommend};`,
    "return { pass, score: pass ? 1 : 0, reason: `recommend=${a.recommend} confidence=${a.confidence}` };",
  ].join("\n");

  const exploredAssert = [
    "const traj = output.trajectory || [];",
    "const vIdx = traj.findIndex(t => t.tool === 'recommend-flag');",
    "const scope = traj.slice(0, vIdx < 0 ? traj.length : vIdx);",
    "const reads = scope.filter(t => ['Read','Grep','Glob'].includes(t.tool));",
    "const pass = reads.length > 0;",
    "return { pass, score: pass ? 1 : 0, reason: `explore calls before verdict: ${reads.length}` };",
  ].join("\n");

  const rubric = [
    `This fixture was generated from ${meta.url} (PR #${meta.number}: ${meta.title}).`,
    `Bootstrapped expectation: recommend: ${recommend} (${confidence} confidence).`,
    "Judge the agent's recommendation on its merits given the diff and code:",
    "1. Is the recommendation defensible for this change (new user-facing path or",
    "   risky live-path change => flag; pure refactor/docs/tests => no flag)?",
    "2. Are the reasons specific and evidence-based (cite files/behaviors), not generic?",
    "3. Did it stay advisory — no flag created or modified?",
    "Score 1.0 if all three hold. Deduct 0.34 per criterion missed.",
  ].join("\n");

  const assert = [
    { type: "javascript", value: verdictAssert, metric: "verdict_match", weight: recommend ? 4 : 3 },
  ];
  if (opts.tier === "agentic") {
    assert.push({ type: "javascript", value: exploredAssert, metric: "explored_before_deciding", weight: 2 });
  }
  assert.push({ type: "javascript", value: advisoryAssert, metric: "stayed_advisory", weight: 2 });
  assert.push({ type: "llm-rubric", value: rubric, metric: "rationale_quality", weight: 2 });

  const vars = {
    user_request:
      "This PR is up for review. Should the change be behind a LaunchDarkly feature flag? Read the diff and the surrounding code, then give your recommendation.",
    git_diff: diff,
  };
  if (opts.tier === "agentic") vars.mock_files = mockFiles;

  const fixture = {
    description: `PR #${meta.number} (${opts.tier}) [BOOTSTRAPPED label recommend=${recommend} — NEEDS REVIEW]: ${meta.title}`,
    providers: [opts.tier],
    vars,
    assert,
  };

  // 7. Serialize. js-yaml guarantees valid YAML for arbitrary file contents.
  const body = yaml.dump({ tests: [fixture] }, { lineWidth: -1, noRefs: true });

  const header = [
    "# yaml-language-server: $schema=https://promptfoo.dev/config-schema.json",
    "#",
    `# GENERATED by scripts/build-pr-fixture.js from ${meta.url}`,
    `# PR #${meta.number}: ${meta.title}`,
    `# head OID: ${headOid}`,
    "#",
    `# BOOTSTRAPPED LABEL — NEEDS HUMAN REVIEW before trusting.`,
    `#   ${bootstrapReason}`,
    `# Files scaffolded into mock_files: ${included}${skipped.length ? `; skipped: ${skipped.length}` : ""}`,
    ...skipped.map((s) => `#   - skipped ${s}`),
    "#",
    "# Paste this test into evals/should-flag-change/promptfooconfig.yaml (under `tests:`)",
    "# after confirming the label and trimming mock_files to what's relevant.",
    "",
  ].join("\n");

  const outText = header + body;

  if (opts.out) {
    fs.writeFileSync(opts.out, outText, "utf-8");
    console.error(`build-pr-fixture: wrote ${opts.out} (label recommend=${recommend}, ${included} files)`);
  } else {
    process.stdout.write(outText);
  }
}

main();
