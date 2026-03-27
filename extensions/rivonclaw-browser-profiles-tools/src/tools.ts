/**
 * Browser Profiles Tool Definitions
 *
 * Each tool calls the cloud GraphQL API via the local panel-server proxy at
 * http://127.0.0.1:3210/api/cloud/graphql, except for local-only operations
 * like proxy testing which call dedicated REST endpoints.
 */

import { Type } from "@sinclair/typebox";
import { extensionGraphqlFetch, extensionRestFetch } from "@rivonclaw/core/extension-client";

// Minimal tool types — inlined to avoid depending on vendor internals.
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

type ToolDef = {
  label: string;
  name: string;
  description: string;
  ownerOnly?: boolean;
  parameters: ReturnType<typeof Type.Object>;
  execute: (toolCallId: string, args: unknown) => Promise<ToolResult>;
};

function jsonResult(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

const graphqlFetch = extensionGraphqlFetch;


// ---------------------------------------------------------------------------
// Read-only tools
// ---------------------------------------------------------------------------

export function createListTool(): ToolDef {
  return {
    label: "Browser Profiles — List",
    name: "browser_profiles_list",
    ownerOnly: true,
    description:
      "List available browser profiles (summary view). " +
      "Optionally filter by tags or status. Returns id, name, tags, status for each profile.",
    parameters: Type.Object({
      tags: Type.Optional(Type.Array(Type.String(), { description: "Filter by tags" })),
      status: Type.Optional(
        Type.Array(Type.String(), { description: "Filter by status: active, disabled, archived" }),
      ),
    }),
    async execute(_toolCallId, args) {
      const { tags, status } = args as { tags?: string[]; status?: string[] };
      const filter: Record<string, unknown> = {};
      if (tags) filter.tags = tags;
      if (status) filter.status = status;

      const query = `query($filter: BrowserProfilesFilterInput) {
        browserProfiles(filter: $filter) {
          items { id name tags status createdAt updatedAt proxyPolicy { enabled baseUrl } }
          total
        }
      }`;
      const result = await graphqlFetch<{
        browserProfiles: { items: unknown[]; total: number };
      }>(query, { filter: Object.keys(filter).length > 0 ? filter : undefined });
      if (result.errors) return jsonResult({ error: result.errors[0].message });
      return jsonResult({ profiles: result.data?.browserProfiles.items ?? [], total: result.data?.browserProfiles.total ?? 0 });
    },
  };
}

export function createGetTool(): ToolDef {
  return {
    label: "Browser Profiles — Get",
    name: "browser_profiles_get",
    ownerOnly: true,
    description:
      "Get full detail for a specific browser profile by ID. " +
      "Returns all fields including notes, proxy policy, and visibility.",
    parameters: Type.Object({
      profileId: Type.String({ description: "The browser profile ID to retrieve" }),
    }),
    async execute(_toolCallId, args) {
      const { profileId } = args as { profileId: string };
      const query = `query($id: ID!) {
        browserProfile(id: $id) {
          id name tags status notes
          createdAt updatedAt
          proxyPolicy { enabled baseUrl }
        }
      }`;
      const result = await graphqlFetch(query, { id: profileId });
      if (result.errors) return jsonResult({ error: result.errors[0].message });
      return jsonResult({ profile: result.data });
    },
  };
}

export function createFindTool(): ToolDef {
  return {
    label: "Browser Profiles — Find",
    name: "browser_profiles_find",
    ownerOnly: true,
    description:
      "Search browser profiles by name, tags, or name prefixes. " +
      "Use this when you need to find profiles matching certain criteria.",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Free-text search query against profile names" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Filter by tags" })),
      namePrefixes: Type.Optional(
        Type.Array(Type.String(), { description: "Filter by name prefixes" }),
      ),
    }),
    async execute(_toolCallId, args) {
      const { query: searchQuery, tags, namePrefixes } = args as {
        query?: string;
        tags?: string[];
        namePrefixes?: string[];
      };
      const filter: Record<string, unknown> = {};
      if (searchQuery) filter.query = searchQuery;
      if (tags) filter.tags = tags;
      if (namePrefixes) filter.namePrefixes = namePrefixes;

      const gql = `query($filter: BrowserProfilesFilterInput) {
        browserProfiles(filter: $filter) {
          items { id name tags status proxyPolicy { enabled baseUrl } }
          total
        }
      }`;
      const result = await graphqlFetch<{
        browserProfiles: { items: unknown[]; total: number };
      }>(gql, { filter });
      if (result.errors) return jsonResult({ error: result.errors[0].message });
      return jsonResult({ profiles: result.data?.browserProfiles.items ?? [], total: result.data?.browserProfiles.total ?? 0 });
    },
  };
}

// ---------------------------------------------------------------------------
// Write / action tools
// ---------------------------------------------------------------------------

export function createManageTool(): ToolDef {
  return {
    label: "Browser Profiles — Manage",
    name: "browser_profiles_manage",
    ownerOnly: true,
    description:
      "Create, update, delete, or archive browser profiles. " +
      "Use action 'create' with name (required) and optional fields. " +
      "Use action 'update' with profileId (required) and fields to change. " +
      "Use action 'delete' or 'archive' with profileIds (array) for batch operations.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("create"),
        Type.Literal("update"),
        Type.Literal("delete"),
        Type.Literal("archive"),
      ], { description: "The operation to perform" }),
      profileId: Type.Optional(Type.String({ description: "Profile ID (required for update)" })),
      profileIds: Type.Optional(Type.Array(Type.String(), { description: "Profile IDs (required for delete/archive)" })),
      name: Type.Optional(Type.String({ description: "Profile name (required for create)" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Tags" })),
      notes: Type.Optional(Type.String({ description: "Notes" })),
      status: Type.Optional(Type.String({ description: "Status: active, disabled, archived" })),
      proxyEnabled: Type.Optional(Type.Boolean({ description: "Enable or disable proxy" })),
      proxyBaseUrl: Type.Optional(Type.String({ description: "Proxy base URL" })),
    }),
    async execute(_toolCallId, args) {
      const { action, profileId, profileIds, name, tags, notes, status, proxyEnabled, proxyBaseUrl } = args as {
        action: "create" | "update" | "delete" | "archive";
        profileId?: string;
        profileIds?: string[];
        name?: string;
        tags?: string[];
        notes?: string;
        status?: string;
        proxyEnabled?: boolean;
        proxyBaseUrl?: string;
      };

      if (action === "create") {
        if (!name) return jsonResult({ error: "name is required for create action" });
        const input: Record<string, unknown> = { name };
        if (tags) input.tags = tags;
        if (notes) input.notes = notes;
        if (status) input.status = status;
        if (proxyEnabled !== undefined) input.proxyEnabled = proxyEnabled;
        if (proxyBaseUrl) input.proxyBaseUrl = proxyBaseUrl;

        const mutation = `mutation($input: CreateBrowserProfileInput!) {
          createBrowserProfile(input: $input) {
            id name tags status notes
            proxyPolicy { enabled baseUrl }
          }
        }`;
        const result = await graphqlFetch(mutation, { input });
        if (result.errors) return jsonResult({ error: result.errors[0].message });
        return jsonResult({ ok: true, profile: result.data });
      }

      if (action === "update") {
        if (!profileId) return jsonResult({ error: "profileId is required for update action" });
        const input: Record<string, unknown> = {};
        if (name !== undefined) input.name = name;
        if (tags !== undefined) input.tags = tags;
        if (notes !== undefined) input.notes = notes;
        if (status !== undefined) input.status = status;
        if (proxyEnabled !== undefined) input.proxyEnabled = proxyEnabled;
        if (proxyBaseUrl !== undefined) input.proxyBaseUrl = proxyBaseUrl;

        const mutation = `mutation($id: ID!, $input: UpdateBrowserProfileInput!) {
          updateBrowserProfile(id: $id, input: $input) {
            id name tags status notes
            proxyPolicy { enabled baseUrl }
          }
        }`;
        const result = await graphqlFetch(mutation, { id: profileId, input });
        if (result.errors) return jsonResult({ error: result.errors[0].message });
        return jsonResult({ ok: true, profile: result.data });
      }

      if (action === "delete") {
        if (!profileIds || profileIds.length === 0) return jsonResult({ error: "profileIds is required for delete action" });
        const mutation = `mutation($ids: [ID!]!) {
          batchDeleteBrowserProfiles(ids: $ids)
        }`;
        const result = await graphqlFetch(mutation, { ids: profileIds });
        if (result.errors) return jsonResult({ error: result.errors[0].message });
        return jsonResult({ ok: true, deletedCount: (result.data as any)?.batchDeleteBrowserProfiles ?? 0 });
      }

      if (action === "archive") {
        if (!profileIds || profileIds.length === 0) return jsonResult({ error: "profileIds is required for archive action" });
        const mutation = `mutation($ids: [ID!]!) {
          batchArchiveBrowserProfiles(ids: $ids)
        }`;
        const result = await graphqlFetch(mutation, { ids: profileIds });
        if (result.errors) return jsonResult({ error: result.errors[0].message });
        return jsonResult({ ok: true, archivedCount: (result.data as any)?.batchArchiveBrowserProfiles ?? 0 });
      }

      return jsonResult({ error: `Unknown action: ${action}` });
    },
  };
}

export function createTestProxyTool(): ToolDef {
  return {
    label: "Browser Profiles — Test Proxy",
    name: "browser_profiles_test_proxy",
    ownerOnly: true,
    description:
      "Test proxy connectivity for a browser profile. " +
      "Returns whether the proxy is reachable and a diagnostic message.",
    parameters: Type.Object({
      profileId: Type.String({ description: "The browser profile ID whose proxy to test" }),
    }),
    async execute(_toolCallId, args) {
      const { profileId } = args as { profileId: string };
      const result = await extensionRestFetch<{ ok: boolean; message: string; checkedAt: string; error?: string }>(
        "/api/browser-profiles/test-proxy",
        { method: "POST", body: JSON.stringify({ id: profileId }) },
      );
      if (result.error) return jsonResult({ error: result.error });
      return jsonResult({ proxyTest: result });
    },
  };
}

/** All read-only tools */
export function getReadTools(): ToolDef[] {
  return [createListTool(), createGetTool(), createFindTool()];
}

/** All write/action tools */
export function getWriteTools(): ToolDef[] {
  return [createManageTool(), createTestProxyTool()];
}

/** All tools */
export function getAllTools(): ToolDef[] {
  return [...getReadTools(), ...getWriteTools()];
}
