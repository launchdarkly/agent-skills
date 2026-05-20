/**
 * Sanity assertion: did the transform succeed in parsing the agent's output?
 *
 * Weight 0 in shared/defaults.yaml so it does not affect the score — it just
 * surfaces a clear "output was not JSON" reason when the provider's
 * serialization breaks, instead of letting suite assertions throw with
 * confusing stack traces.
 */
module.exports = (output) => {
  const isObj = output !== null && typeof output === "object" && !Array.isArray(output);
  return {
    pass: isObj,
    score: isObj ? 1 : 0,
    reason: isObj
      ? "output parsed as JSON object"
      : "output was not parseable as JSON object",
  };
};
