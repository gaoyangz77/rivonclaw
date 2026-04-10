import { randomUUID } from "node:crypto";
import type { ArtifactStatus, ArtifactType } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { removeSkillFile } from "@rivonclaw/rules";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson, parseBody } from "../infra/api/route-utils.js";

const listRules: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const { storage } = ctx;
  const rules = storage.rules.getAll();
  const allArtifacts = storage.artifacts.getAll();

  const artifactByRuleId = new Map<string, { status: ArtifactStatus; type: ArtifactType }>();
  for (const artifact of allArtifacts) {
    artifactByRuleId.set(artifact.ruleId, {
      status: artifact.status,
      type: artifact.type,
    });
  }

  const enrichedRules = rules.map((rule) => {
    const artifact = artifactByRuleId.get(rule.id);
    return {
      ...rule,
      artifactStatus: artifact?.status,
      artifactType: artifact?.type,
    };
  });

  sendJson(res, 200, { rules: enrichedRules });
};

const createRule: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  const { storage, onRuleChange } = ctx;
  const body = (await parseBody(req)) as { text?: string };
  if (!body.text || typeof body.text !== "string") {
    sendJson(res, 400, { error: "Missing required field: text" });
    return;
  }

  const id = randomUUID();
  const created = storage.rules.create({ id, text: body.text });
  onRuleChange?.("created", id);
  sendJson(res, 201, created);
};

const updateRule: EndpointHandler = async (req, res, _url, params, ctx: ApiContext) => {
  const { storage, onRuleChange } = ctx;
  const ruleId = params.id;
  const body = (await parseBody(req)) as { text?: string };
  if (!body.text || typeof body.text !== "string") {
    sendJson(res, 400, { error: "Missing required field: text" });
    return;
  }

  const updated = storage.rules.update(ruleId, { text: body.text });
  if (!updated) {
    sendJson(res, 404, { error: "Rule not found" });
    return;
  }

  onRuleChange?.("updated", ruleId);
  sendJson(res, 200, updated);
};

const deleteRule: EndpointHandler = async (_req, res, _url, params, ctx: ApiContext) => {
  const { storage, onRuleChange } = ctx;
  const ruleId = params.id;

  const artifacts = storage.artifacts.getByRuleId(ruleId);
  for (const artifact of artifacts) {
    if (artifact.type === "action-bundle" && artifact.outputPath) {
      removeSkillFile(artifact.outputPath);
    }
  }

  storage.artifacts.deleteByRuleId(ruleId);
  const deleted = storage.rules.delete(ruleId);
  if (!deleted) {
    sendJson(res, 404, { error: "Rule not found" });
    return;
  }

  onRuleChange?.("deleted", ruleId);
  sendJson(res, 200, { ok: true });
};

export function registerRulesHandlers(registry: RouteRegistry): void {
  registry.register(API["rules.list"], listRules);
  registry.register(API["rules.create"], createRule);
  registry.register(API["rules.update"], updateRule);
  registry.register(API["rules.delete"], deleteRule);
}
