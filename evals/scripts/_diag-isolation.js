#!/usr/bin/env node
/**
 * Compares SDK skill discovery between the unscoped default and a
 * HOME-isolated invocation, so we can confirm that pointing the SDK
 * at an empty user-config dir actually drops the ambient skills from
 * `init.skills` without breaking anything else.
 */

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const EVALS_DIR = path.resolve(__dirname, "..");
const ISOLATED_HOME = path.join(EVALS_DIR, ".tmp-isolated-home");

async function dumpInit({ env, label }) {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  const tinyMcp = sdk.createSdkMcpServer({ name: "noop", tools: [] });
  const q = sdk.query({
    prompt: "ping",
    options: {
      cwd: EVALS_DIR,
      settingSources: ["project"],
      mcpServers: { noop: tinyMcp },
      maxTurns: 1,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      tools: [],
      ...(env ? { env } : {}),
      agent: "diag",
      agents: {
        diag: {
          description: "diagnostic",
          prompt: "Reply DONE.",
          skills: ["aiconfig-create"],
        },
      },
    },
  });

  for await (const msg of q) {
    if (msg.type === "system" && msg.subtype === "init") {
      console.error(`\n=== ${label} ===`);
      console.error("init.skills:", msg.skills);
    }
    if (msg.type === "result") break;
  }
}

async function main() {
  await dumpInit({ env: undefined, label: "DEFAULT (no HOME override)" });

  await dumpInit({
    env: {
      ...process.env,
      HOME: ISOLATED_HOME,
      USERPROFILE: ISOLATED_HOME,
    },
    label: `HOME=${ISOLATED_HOME}`,
  });

  await dumpInit({
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: path.join(ISOLATED_HOME, ".claude"),
    },
    label: `CLAUDE_CONFIG_DIR=${path.join(ISOLATED_HOME, ".claude")}`,
  });
}

main().catch((err) => {
  console.error("[diag] failed:", err);
  process.exit(1);
});
