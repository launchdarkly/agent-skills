/**
 * Default output transform applied to every test via shared/defaults.yaml.
 *
 * The skill-agent providers serialize their result as a JSON string so the
 * promptfoo runner has a single string to render in its UI. By parsing that
 * string here once, every assertion downstream receives `output` already as
 * an object with `{ response, trajectory, tools_called, turn_count }`,
 * eliminating ~60 inline `JSON.parse(output)` calls across the suite.
 *
 * If parsing fails, the raw string is returned unchanged so the
 * `output_valid` assertion can flag the failure without crashing first.
 */
module.exports = (output) => {
  if (output && typeof output === "object") return output;
  if (typeof output !== "string") return output;
  try {
    return JSON.parse(output);
  } catch (_err) {
    return output;
  }
};
