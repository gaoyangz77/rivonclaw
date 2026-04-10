import { fetchJson, cachedFetch, invalidateCache } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

export interface Rule {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  artifactStatus?: "ok" | "failed" | "pending";
  artifactType?: "policy-fragment" | "guard" | "action-bundle";
}

export async function fetchRules(): Promise<Rule[]> {
  return cachedFetch("rules", async () => {
    const data = await fetchJson<{ rules: Rule[] }>(clientPath(API["rules.list"]));
    return data.rules;
  }, 3000);
}

export async function createRule(text: string): Promise<Rule> {
  const result = await fetchJson<Rule>(clientPath(API["rules.create"]), {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  invalidateCache("rules");
  return result;
}

export async function updateRule(id: string, text: string): Promise<Rule> {
  const result = await fetchJson<Rule>(clientPath(API["rules.update"], { id }), {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
  invalidateCache("rules");
  return result;
}

export async function deleteRule(id: string): Promise<void> {
  await fetchJson(clientPath(API["rules.delete"], { id }), { method: "DELETE" });
  invalidateCache("rules");
}
