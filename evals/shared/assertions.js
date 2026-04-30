/**
 * Trajectory helpers shared across every suite.
 *
 * The agent provider returns:
 *
 *   {
 *     response: "<final agent text>",
 *     trajectory: [
 *       { tool: "list-flags",  arguments: {...}, turn: 1, mock_response_preview: "..." },
 *       { tool: "create-flag", arguments: {...}, turn: 2, mock_response_preview: "..." },
 *       ...
 *     ],
 *     tools_called: ["list-flags", "create-flag", ...],
 *     turn_count: 5
 *   }
 *
 * shared/defaults.yaml configures `defaultTest.options.transform` so the
 * `output` value passed to every javascript assertion is already the parsed
 * object - no need to `JSON.parse(output)` first.
 *
 * Convention for "X happens after Y" trajectory checks:
 *   - Use the FIRST occurrence of the prerequisite (Y) and the LAST
 *     occurrence of the verifier (X).
 *   - Rationale: an agent commonly calls `get-foo` once before mutating and
 *     once again after mutating to verify. With `indexOf` for both, the
 *     "post-mutation get" assertion would silently pass against the
 *     pre-mutation call. lastIndexOf for the verifier closes that hole.
 *
 * promptfoo evaluates inline `type: javascript` assertions via
 *   new Function("output", "context", "process", body)
 * which means `require` is NOT in scope. So this module is consumed by
 * file://-loaded assertions, scripts (aggregator, diff-changed-skills),
 * and human readers - inline assertions in promptfooconfig.yaml mirror the
 * same patterns by hand using the FIRST/LAST convention above.
 */

function getTools(output) {
  if (!output || typeof output !== "object") return [];
  return Array.isArray(output.tools_called) ? output.tools_called : [];
}

function getTrajectory(output) {
  if (!output || typeof output !== "object") return [];
  return Array.isArray(output.trajectory) ? output.trajectory : [];
}

function firstCallOf(output, name) {
  const trajectory = getTrajectory(output);
  for (let i = 0; i < trajectory.length; i++) {
    if (trajectory[i] && trajectory[i].tool === name) {
      return { call: trajectory[i], idx: i };
    }
  }
  return { call: null, idx: -1 };
}

function lastCallOf(output, name) {
  const trajectory = getTrajectory(output);
  for (let i = trajectory.length - 1; i >= 0; i--) {
    if (trajectory[i] && trajectory[i].tool === name) {
      return { call: trajectory[i], idx: i };
    }
  }
  return { call: null, idx: -1 };
}

function called(output, name) {
  return getTools(output).includes(name);
}

function calledAny(output, names) {
  const tools = getTools(output);
  return names.some((n) => tools.includes(n));
}

function calledNone(output, names) {
  const tools = getTools(output);
  return names.every((n) => !tools.includes(n));
}

/**
 * Assert that the LAST occurrence of `after` happens after the FIRST
 * occurrence of `before`. Returns a promptfoo-shaped grading result.
 */
function expectAfter(output, { before, after }) {
  const beforeIdx = firstCallOf(output, before).idx;
  const afterIdx = lastCallOf(output, after).idx;
  const pass = beforeIdx >= 0 && afterIdx > beforeIdx;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: `${before}@${beforeIdx} ${after}@${afterIdx}`,
  };
}

/**
 * Assert that none of the listed tools were called.
 */
function expectNotCalled(output, names) {
  const tools = getTools(output);
  const hits = names.filter((n) => tools.includes(n));
  const pass = hits.length === 0;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `correctly avoided ${names.join(", ")}`
      : `called forbidden tools: ${hits.join(", ")}`,
  };
}

/**
 * Assert that at least one of the listed tools was called.
 */
function expectAnyCalled(output, names) {
  const tools = getTools(output);
  const hit = names.find((n) => tools.includes(n));
  const pass = Boolean(hit);
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `called ${hit}`
      : `none of [${names.join(", ")}] called; tools: ${tools.join(" -> ") || "(none)"}`,
  };
}

module.exports = {
  getTools,
  getTrajectory,
  firstCallOf,
  lastCallOf,
  called,
  calledAny,
  calledNone,
  expectAfter,
  expectNotCalled,
  expectAnyCalled,
};
