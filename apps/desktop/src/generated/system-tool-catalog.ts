/**
 * Static catalog of OpenClaw core (system) tools.
 *
 * Source: vendor/openclaw/src/agents/tool-catalog.ts (CORE_TOOL_DEFINITIONS)
 * Regenerate after vendor upgrades if tool catalog changes.
 *
 * This allows CapabilityResolver to know system tools before the gateway connects,
 * and enables i18n labels in the Panel UI.
 */

export interface SystemToolEntry {
  id: string;
  label: string;
  description: string;
  section: string;
  sectionLabel: string;
}

export const SYSTEM_TOOL_CATALOG: SystemToolEntry[] = [
  // ── Files ──
  { id: "read", label: "read", description: "Read file contents", section: "fs", sectionLabel: "Files" },
  { id: "write", label: "write", description: "Create or overwrite files", section: "fs", sectionLabel: "Files" },
  { id: "edit", label: "edit", description: "Make precise edits", section: "fs", sectionLabel: "Files" },
  { id: "apply_patch", label: "apply_patch", description: "Patch files (OpenAI)", section: "fs", sectionLabel: "Files" },

  // ── Runtime ──
  { id: "exec", label: "exec", description: "Run shell commands", section: "runtime", sectionLabel: "Runtime" },
  { id: "process", label: "process", description: "Manage background processes", section: "runtime", sectionLabel: "Runtime" },

  // ── Web ──
  { id: "web_search", label: "web_search", description: "Search the web", section: "web", sectionLabel: "Web" },
  { id: "web_fetch", label: "web_fetch", description: "Fetch web content", section: "web", sectionLabel: "Web" },

  // ── Memory ──
  { id: "memory_search", label: "memory_search", description: "Semantic search", section: "memory", sectionLabel: "Memory" },
  { id: "memory_get", label: "memory_get", description: "Read memory files", section: "memory", sectionLabel: "Memory" },

  // ── Sessions ──
  { id: "sessions_list", label: "sessions_list", description: "List sessions", section: "sessions", sectionLabel: "Sessions" },
  { id: "sessions_history", label: "sessions_history", description: "Session history", section: "sessions", sectionLabel: "Sessions" },
  { id: "sessions_send", label: "sessions_send", description: "Send to session", section: "sessions", sectionLabel: "Sessions" },
  { id: "sessions_spawn", label: "sessions_spawn", description: "Spawn sub-agent", section: "sessions", sectionLabel: "Sessions" },
  { id: "sessions_yield", label: "sessions_yield", description: "End turn to receive sub-agent results", section: "sessions", sectionLabel: "Sessions" },
  { id: "subagents", label: "subagents", description: "Manage sub-agents", section: "sessions", sectionLabel: "Sessions" },
  { id: "session_status", label: "session_status", description: "Session status", section: "sessions", sectionLabel: "Sessions" },

  // ── UI ──
  { id: "browser", label: "browser", description: "Control web browser", section: "ui", sectionLabel: "UI" },
  { id: "canvas", label: "canvas", description: "Control canvases", section: "ui", sectionLabel: "UI" },

  // ── Messaging ──
  { id: "message", label: "message", description: "Send messages", section: "messaging", sectionLabel: "Messaging" },

  // ── Automation ──
  { id: "cron", label: "cron", description: "Schedule tasks", section: "automation", sectionLabel: "Automation" },
  { id: "gateway", label: "gateway", description: "Gateway control", section: "automation", sectionLabel: "Automation" },

  // ── Nodes ──
  { id: "nodes", label: "nodes", description: "Nodes + devices", section: "nodes", sectionLabel: "Nodes" },

  // ── Agents ──
  { id: "agents_list", label: "agents_list", description: "List agents", section: "agents", sectionLabel: "Agents" },

  // ── Media ──
  { id: "image", label: "image", description: "Image understanding", section: "media", sectionLabel: "Media" },
  { id: "tts", label: "tts", description: "Text-to-speech conversion", section: "media", sectionLabel: "Media" },
];

/** Set of all system tool IDs for quick lookup. */
export const SYSTEM_TOOL_IDS = new Set(SYSTEM_TOOL_CATALOG.map((t) => t.id));
