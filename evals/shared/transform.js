/**
 * Default output transform applied to every test via shared/defaults.yaml.
 *
 * The skill-agent provider serializes its result as a JSON string so the
 * promptfoo runner has a single string to render in its UI. Parsing it here
 * once means every assertion downstream receives `output` already as an object
 * with { response, first_assistant_text, kickoff_text, assistant_turns,
 * trajectory, tools_called, turn_count, terminated } instead of a raw string.
 *
 * If parsing fails the raw string is returned unchanged so `output_valid`
 * can flag the failure clearly.
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
