import { createHttpLink } from "@apollo/client";
import { API, clientPath, type WorkspaceDescriptor } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";
import type { HostAdapter, HostCapability } from "../host-adapter.js";
import { HOST_CAPABILITIES } from "../host-adapter.js";
import { createDesktopAuth } from "./desktop-auth.js";
import { createDesktopEventStream } from "./event-stream.js";

/**
 * The host Panel runs on inside the Electron app. Everything is served by
 * Desktop on the same origin: GraphQL and cloud REST go through its proxy
 * (which injects the JWT and ingests responses into Desktop's store), and
 * state arrives over the single `/api/events` stream.
 *
 * `createEventSource` is injectable for tests; production uses the browser's.
 */
export function createDesktopHost(
  options: { createEventSource?: (url: string) => EventSource } = {},
): HostAdapter {
  const capabilities: ReadonlySet<HostCapability> = new Set(HOST_CAPABILITIES);
  return {
    kind: "desktop",
    capabilities,
    graphql: {
      createLink: () => createHttpLink({ uri: API["cloud.graphql"].path }),
    },
    cloud: {
      fetch: (path, init) => fetch(path, init),
    },
    events: createDesktopEventStream(options.createEventSource),
    auth: createDesktopAuth(),
    settings: {
      getAll: async () =>
        (await fetchJson<{ settings: Record<string, string> }>(clientPath(API["settings.getAll"])))
          .settings,
      getWorkspace: async (userId) =>
        (
          await fetchJson<{ workspace: WorkspaceDescriptor | null }>(
            `${clientPath(API["settings.workspace.get"])}?userId=${encodeURIComponent(userId ?? "")}`,
          )
        ).workspace,
      saveWorkspace: async (userId, workspace) => {
        await fetchJson(clientPath(API["settings.workspace.set"]), {
          method: "PUT",
          body: JSON.stringify({ userId, workspace }),
        });
      },
      update: async (entries) => {
        await fetchJson(clientPath(API["settings.update"]), {
          method: "PUT",
          body: JSON.stringify(entries),
        });
      },
    },
    stateFeed: "stream",
  };
}
