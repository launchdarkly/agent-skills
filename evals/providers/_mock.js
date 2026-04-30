/**
 * Mock-response renderer used by claude-skill-agent-sdk.js to fill in the
 * canned tool responses from mocks/tool-responses.json before handing them
 * back to the agent through the in-process MCP server.
 *
 * Two layers:
 *
 *   1. Stateless template rendering (the original behaviour) walks the parsed
 *      mock template object, substituting `{{placeholder}}` tokens inside
 *      string leaves with values from the tool input. Quote/backslash chars
 *      in tool inputs are safe because substitution only touches strings.
 *
 *   2. Stateful overlay (added later) keeps an in-memory map of configs and
 *      tools per `callApi` invocation. Write tools (create/setup/clone/
 *      update/delete) record into the state; read tools (get-ai-config,
 *      get-ai-config-health) build their response from state when one
 *      exists, falling back to the template otherwise. This stops the agent
 *      from believing its own writes failed when the static template returns
 *      generic placeholder data, which was the root cause of three
 *      "false-failure" trajectories in the AI-Configs eval suites.
 */

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/**
 * Build the lookup table used for placeholder substitution. Mirrors the
 * conventions previously hard-coded in each provider so existing
 * mocks/tool-responses.json templates continue to render the same way.
 */
function buildReplacements(input) {
  const safe = input || {};
  return {
    flagKey: safe.flagKey || safe.key || "unknown-flag",
    flagName: safe.flagName || safe.name || "Unknown Flag",
    configKey: safe.configKey || safe.key || "unknown-config",
    configName: safe.configName || safe.name || "Unknown Config",
    variationKey:
      safe.variationKey || safe.sourceVariationKey || safe.key || "default",
    variationName: safe.variationName || safe.name || "Default",
    toolKey: safe.toolKey || safe.key || "unknown-tool",
    modelConfigKey: safe.modelConfigKey || "OpenAI.gpt-4o",
    modelName: safe.modelName || "gpt-4o",
    mode: safe.mode || "completion",
    toolDescription: safe.description || "A tool",
  };
}

function renderString(value, replacements) {
  return value.replace(PLACEHOLDER_RE, (match, key) =>
    Object.prototype.hasOwnProperty.call(replacements, key)
      ? String(replacements[key])
      : match,
  );
}

function walk(node, replacements) {
  if (typeof node === "string") return renderString(node, replacements);
  if (Array.isArray(node)) return node.map((item) => walk(item, replacements));
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = walk(node[k], replacements);
    return out;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Stateful overlay
// ---------------------------------------------------------------------------

/**
 * Seeds for configs that appear in the `list-ai-configs` mock. When the agent
 * calls `get-ai-config` against one of these (e.g. to inspect an existing
 * config before mutating it), we hydrate a copy into state so subsequent
 * reads/writes operate on consistent data. Only seeded on first reference.
 */
const SEED_CONFIGS = {
  "support-chatbot": {
    key: "support-chatbot",
    name: "Support Chatbot",
    mode: "agent",
    description: "AI-powered support agent for customer tickets",
    tags: ["support", "production"],
    archived: false,
    variations: [
      {
        key: "default",
        name: "Default",
        modelConfigKey: "OpenAI.gpt-4o",
        modelName: "gpt-4o",
        instructions:
          "You are a helpful assistant that answers questions concisely.",
        parameters: { temperature: 0.7, max_tokens: 2048 },
        tools: [],
        status: "active",
      },
    ],
  },
  "code-reviewer": {
    key: "code-reviewer",
    name: "Code Review Assistant",
    mode: "completion",
    description: "Automated code review assistant for pull requests",
    tags: ["engineering"],
    archived: false,
    variations: [
      {
        key: "default",
        name: "Default",
        modelConfigKey: "OpenAI.gpt-4o",
        modelName: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert code reviewer." },
        ],
        parameters: { temperature: 0.7 },
        tools: [],
        status: "active",
      },
    ],
  },
  "content-writer": {
    key: "content-writer",
    name: "Content Writer",
    mode: "completion",
    description: "Marketing content generation",
    tags: ["marketing"],
    archived: false,
    variations: [
      {
        key: "default",
        name: "Default",
        modelConfigKey: "OpenAI.gpt-4o",
        modelName: "gpt-4o",
        messages: [
          { role: "system", content: "You write compelling marketing copy." },
        ],
        parameters: { temperature: 0.7 },
        tools: [],
        status: "active",
      },
    ],
  },
  "ecommerce-assistant": {
    key: "ecommerce-assistant",
    name: "Ecommerce Assistant",
    mode: "agent",
    description: "Helps customers shop and find products",
    tags: ["ecommerce"],
    archived: false,
    variations: [
      {
        key: "default",
        name: "Default",
        modelConfigKey: "OpenAI.gpt-4o",
        modelName: "gpt-4o",
        instructions: "You are an ecommerce shopping assistant.",
        parameters: { temperature: 0.7 },
        tools: [],
        status: "active",
      },
    ],
  },
  "travel-assistant": {
    key: "travel-assistant",
    name: "Travel Assistant",
    mode: "agent",
    description: "Helps users plan travel",
    tags: ["travel"],
    archived: false,
    variations: [
      {
        key: "default",
        name: "Default",
        modelConfigKey: "OpenAI.gpt-4o",
        modelName: "gpt-4o",
        instructions: "You help users plan travel itineraries.",
        parameters: { temperature: 0.7 },
        tools: [],
        status: "active",
      },
    ],
  },
};

const SEED_TOOLS = {
  "search-docs": {
    key: "search-docs",
    description: "Search internal documentation",
    schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
  },
  "run-query": {
    key: "run-query",
    description: "Run a database query",
    schema: null,
  },
};

function deepClone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Create a fresh per-test state container. The provider creates one of these
 * per `callApi` invocation so tests stay isolated.
 */
function createMockState() {
  return {
    configs: new Map(),
    tools: new Map(),
  };
}

function ensureConfig(state, cfgKey, init) {
  if (!cfgKey) return null;
  if (!state.configs.has(cfgKey)) {
    if (SEED_CONFIGS[cfgKey] && !init) {
      state.configs.set(cfgKey, deepClone(SEED_CONFIGS[cfgKey]));
    } else if (init) {
      state.configs.set(cfgKey, {
        key: cfgKey,
        name: init.name || cfgKey,
        mode: init.mode || "completion",
        description: init.description || "",
        tags: init.tags || [],
        archived: false,
        variations: [],
      });
    } else {
      return null;
    }
  }
  return state.configs.get(cfgKey);
}

function ensureTool(state, toolKey) {
  if (!toolKey) return null;
  if (!state.tools.has(toolKey) && SEED_TOOLS[toolKey]) {
    state.tools.set(toolKey, deepClone(SEED_TOOLS[toolKey]));
  }
  return state.tools.get(toolKey) || null;
}

function buildVariationFromInput(input, defaults = {}) {
  return stripUndefined({
    key: input.variationKey || input.key,
    name: input.variationName || input.name,
    modelConfigKey: input.modelConfigKey,
    modelName: input.modelName,
    instructions: input.instructions,
    messages: input.messages,
    parameters: input.parameters || defaults.parameters || { temperature: 0.7 },
    tools: input.tools || defaults.tools || [],
    status: "active",
  });
}

function applyToolCall(state, toolName, input) {
  const cfgKey = input.configKey || input.key;

  switch (toolName) {
    case "setup-ai-config": {
      const cfg = ensureConfig(state, input.key, {
        name: input.name,
        mode: input.mode,
        description: input.description,
        tags: input.tags,
      });
      if (!cfg) break;
      if (input.name !== undefined) cfg.name = input.name;
      if (input.mode !== undefined) cfg.mode = input.mode;
      if (input.description !== undefined) cfg.description = input.description;
      if (input.tags !== undefined) cfg.tags = input.tags;
      // Replace variations with the single variation passed in.
      cfg.variations = [buildVariationFromInput(input)];
      break;
    }

    case "create-ai-config": {
      ensureConfig(state, input.key, {
        name: input.name,
        mode: input.mode,
        description: input.description,
        tags: input.tags,
      });
      break;
    }

    case "create-ai-config-variation": {
      const cfg = ensureConfig(state, cfgKey, { mode: "completion" });
      if (!cfg) break;
      const newVar = buildVariationFromInput(input);
      const existingIdx = cfg.variations.findIndex((v) => v.key === newVar.key);
      if (existingIdx >= 0) cfg.variations[existingIdx] = newVar;
      else cfg.variations.push(newVar);
      break;
    }

    case "clone-ai-config-variation": {
      const cfg = ensureConfig(state, cfgKey);
      if (!cfg) break;
      const src = cfg.variations.find(
        (v) => v.key === input.sourceVariationKey,
      );
      const base = src ? deepClone(src) : {};
      const overrides = stripUndefined({
        modelConfigKey: input.modelConfigKey,
        modelName: input.modelName,
        instructions: input.instructions,
        messages: input.messages,
        parameters: input.parameters,
        tools: input.tools,
      });
      const cloned = {
        ...base,
        ...overrides,
        key: input.key,
        name: input.name,
        status: "active",
      };
      const existingIdx = cfg.variations.findIndex((v) => v.key === cloned.key);
      if (existingIdx >= 0) cfg.variations[existingIdx] = cloned;
      else cfg.variations.push(cloned);
      break;
    }

    case "update-ai-config": {
      const cfg = ensureConfig(state, cfgKey);
      if (!cfg) break;
      if (input.name !== undefined) cfg.name = input.name;
      if (input.description !== undefined) cfg.description = input.description;
      if (input.tags !== undefined) cfg.tags = input.tags;
      if (input.archived !== undefined) cfg.archived = Boolean(input.archived);
      break;
    }

    case "update-ai-config-variation": {
      const cfg = ensureConfig(state, cfgKey);
      if (!cfg) break;
      let v = cfg.variations.find((x) => x.key === input.variationKey);
      if (!v) {
        v = {
          key: input.variationKey,
          name: input.variationKey,
          parameters: {},
          tools: [],
          status: "active",
        };
        cfg.variations.push(v);
      }
      for (const f of [
        "name",
        "modelConfigKey",
        "modelName",
        "instructions",
        "messages",
        "parameters",
        "tools",
      ]) {
        if (input[f] !== undefined) v[f] = input[f];
      }
      break;
    }

    case "delete-ai-config": {
      if (input.confirm) state.configs.delete(cfgKey);
      break;
    }

    case "delete-ai-config-variation": {
      if (!input.confirm) break;
      const cfg = state.configs.get(cfgKey);
      if (cfg) {
        cfg.variations = cfg.variations.filter(
          (v) => v.key !== input.variationKey,
        );
      }
      break;
    }

    case "create-ai-tool": {
      state.tools.set(input.key, {
        key: input.key,
        description: input.description || "",
        schema: input.schema || { type: "object", properties: {} },
      });
      break;
    }

    case "get-ai-config":
    case "get-ai-config-health":
      // Read-only: trigger seed-on-first-reference but make no changes.
      ensureConfig(state, cfgKey);
      break;

    case "get-ai-tool":
      ensureTool(state, input.key);
      break;

    default:
      break;
  }
}

function renderConfigDetail(cfg) {
  const out = deepClone(cfg);
  if (!Array.isArray(out.tags)) out.tags = [];
  if (typeof out.archived !== "boolean") out.archived = Boolean(out.archived);
  if (!Array.isArray(out.variations)) out.variations = [];
  return out;
}

function renderHealth(cfg) {
  const issues = [];
  const variations = (cfg.variations || []).map((v) => {
    const hasModel = !!v.modelConfigKey;
    const hasPrompts =
      (typeof v.instructions === "string" && v.instructions.length > 0) ||
      (Array.isArray(v.messages) && v.messages.length > 0);
    if (!hasModel)
      issues.push({ variationKey: v.key, code: "no_model", severity: "error" });
    if (!hasPrompts)
      issues.push({
        variationKey: v.key,
        code: "no_prompts",
        severity: "warning",
      });
    return {
      key: v.key,
      name: v.name,
      hasModel,
      hasPrompts,
      toolsAttached: Array.isArray(v.tools) ? v.tools.length : 0,
    };
  });
  if ((cfg.variations || []).length === 0)
    issues.push({ code: "no_variations", severity: "error" });
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const verdict = hasError ? "unhealthy" : hasWarning ? "warning" : "healthy";
  return {
    key: cfg.key,
    name: cfg.name,
    mode: cfg.mode,
    health: verdict,
    variationsCount: (cfg.variations || []).length,
    issues,
    variations,
  };
}

function buildStatefulResponse(state, toolName, input, fallback) {
  const cfgKey = input.configKey || input.key;

  switch (toolName) {
    case "setup-ai-config":
    case "get-ai-config": {
      const cfg = state.configs.get(cfgKey);
      if (cfg) return renderConfigDetail(cfg);
      return fallback;
    }

    case "list-ai-configs": {
      const stateConfigs = Array.from(state.configs.values()).map((cfg) => ({
        key: cfg.key,
        name: cfg.name,
        mode: cfg.mode,
        description: cfg.description || "",
        tags: cfg.tags || [],
        variationsCount: (cfg.variations || []).length,
        archived: !!cfg.archived,
      }));
      // Merge seed list (from list-ai-configs template) with state overrides
      // by key, preferring state. Avoids surprising the agent with stale
      // entries after archive/delete in the same test.
      const seedList = (fallback && fallback.configs) || [];
      const byKey = new Map();
      for (const c of seedList) byKey.set(c.key, c);
      for (const c of stateConfigs) byKey.set(c.key, c);
      // Hide archived configs from the list (matches LD UI behaviour for
      // the default active filter).
      const merged = Array.from(byKey.values()).filter((c) => !c.archived);
      return { configs: merged, totalCount: merged.length };
    }

    case "get-ai-config-health": {
      const cfg = ensureConfig(state, cfgKey);
      if (cfg) return renderHealth(cfg);
      return fallback;
    }

    case "create-ai-config": {
      const cfg = state.configs.get(cfgKey);
      if (cfg)
        return {
          key: cfg.key,
          name: cfg.name,
          mode: cfg.mode,
          description: cfg.description,
          tags: cfg.tags,
        };
      return fallback;
    }

    case "create-ai-config-variation": {
      const cfg = state.configs.get(cfgKey);
      const v = cfg && cfg.variations.find((x) => x.key === input.key);
      if (v) return { configKey: cfgKey, variation: deepClone(v) };
      return fallback;
    }

    case "update-ai-config": {
      const cfg = state.configs.get(cfgKey);
      if (cfg)
        return {
          key: cfg.key,
          name: cfg.name,
          description: cfg.description,
          tags: cfg.tags,
          archived: !!cfg.archived,
        };
      return fallback;
    }

    case "update-ai-config-variation": {
      const cfg = state.configs.get(cfgKey);
      const v =
        cfg && cfg.variations.find((x) => x.key === input.variationKey);
      if (v) return { configKey: cfgKey, variation: deepClone(v) };
      return fallback;
    }

    case "clone-ai-config-variation": {
      const cfg = state.configs.get(cfgKey);
      if (!cfg) return fallback;
      const created = cfg.variations.find((v) => v.key === input.key);
      // Note: source may have been mutated since clone, but we render the
      // current state (matches API behaviour: source field on response is
      // the current source variation).
      const source = cfg.variations.find(
        (v) => v.key === input.sourceVariationKey,
      );
      if (created)
        return {
          configKey: cfgKey,
          source: source ? deepClone(source) : null,
          created: deepClone(created),
        };
      return fallback;
    }

    case "delete-ai-config": {
      if (input.confirm) return { deleted: true, key: cfgKey };
      return { deleted: false, key: cfgKey, error: "confirm must be true" };
    }

    case "delete-ai-config-variation": {
      if (input.confirm)
        return {
          deleted: true,
          configKey: cfgKey,
          variationKey: input.variationKey,
        };
      return {
        deleted: false,
        configKey: cfgKey,
        variationKey: input.variationKey,
        error: "confirm must be true",
      };
    }

    case "list-ai-tools": {
      // Show seed tools plus any state-created ones, deduped by key.
      const stateTools = Array.from(state.tools.values()).map((t) => ({
        key: t.key,
        description: t.description,
        schema: t.schema,
      }));
      const seedTools = (fallback && fallback.tools) || [];
      const byKey = new Map();
      for (const t of seedTools) byKey.set(t.key, t);
      for (const t of stateTools) byKey.set(t.key, t);
      const merged = Array.from(byKey.values());
      return { tools: merged, totalCount: merged.length };
    }

    case "get-ai-tool": {
      const t = state.tools.get(input.key);
      if (t) return deepClone(t);
      return fallback;
    }

    case "create-ai-tool": {
      const t = state.tools.get(input.key);
      if (t) return deepClone(t);
      return fallback;
    }

    default:
      return fallback;
  }
}

/**
 * Render a mock response for a tool call.
 *
 * @param {object} template - the parsed mock object from
 *   mocks/tool-responses.json (NOT a string).
 * @param {object} input - the tool's input arguments from the model.
 * @param {string} [toolName] - the MCP tool name. Required to engage the
 *   stateful overlay; if omitted, behaves as before (template-only).
 * @param {object} [state] - per-test state container from createMockState().
 *   Required to engage the stateful overlay.
 * @returns {object} a deep-cloned, placeholder-substituted response object
 *   suitable for sending back as the tool_result content.
 */
function renderMockResponse(template, input, toolName, state) {
  if (!template || typeof template !== "object") {
    return { error: "Invalid mock template" };
  }
  const replacements = buildReplacements(input);
  const fallback = walk(template, replacements);

  // Coerce `archived` to a real boolean since templates use string
  // placeholders for it. If the input names `archived`, mirror that;
  // otherwise default to false to match the prior behaviour.
  if (fallback && typeof fallback === "object" && "archived" in fallback) {
    if (input && Object.prototype.hasOwnProperty.call(input, "archived")) {
      fallback.archived = Boolean(input.archived);
    } else if (typeof fallback.archived === "string") {
      fallback.archived = false;
    }
  }

  if (!state || !toolName) return fallback;

  // Update state, then render the (possibly state-aware) response.
  applyToolCall(state, toolName, input || {});
  return buildStatefulResponse(state, toolName, input || {}, fallback);
}

module.exports = {
  renderMockResponse,
  buildReplacements,
  createMockState,
};
