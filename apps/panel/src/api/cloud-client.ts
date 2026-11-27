import { getHost } from "../host/index.js";
import { readJsonResponse } from "./client.js";

/**
 * JSON request to a backend REST endpoint through the host. `path` is a
 * `CLOUD_REST[...]` contract path (`/api/cloud/...`). Same error semantics as
 * `fetchJson`; the difference is where the request goes: the host decides
 * (Desktop's proxy, or the backend directly).
 */
export async function cloudFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await getHost().cloud.fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  return readJsonResponse<T>(res);
}
