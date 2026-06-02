import { GQL } from "@rivonclaw/core";
import { getClient } from "./apollo-client.js";
import { fetchInstalledSkills, writeSkillTemplate } from "./skills.js";
import { PRESET_SKILL_MANIFEST_QUERY, PRESET_SKILLS_QUERY } from "./shops-queries.js";

export type OfficialPresetSkillSyncMode = "safe" | "force";

export interface OfficialPresetSkillSyncResult {
  installed: number;
  updated: number;
  current: number;
  skippedCustom: number;
  failed: number;
}

function shouldWritePresetSkill(
  item: GQL.PresetSkillManifestItem,
  localHash: string | undefined,
  mode: OfficialPresetSkillSyncMode,
): "install" | "update" | "skip-current" | "skip-custom" {
  if (mode === "force") return localHash ? "update" : "install";
  if (!localHash) return "install";
  if (localHash === item.currentHash) return "skip-current";
  if (item.autoUpdatePolicy === GQL.PresetSkillAutoUpdatePolicy.Always) return "update";
  if (
    item.autoUpdatePolicy === GQL.PresetSkillAutoUpdatePolicy.OfficialOnly &&
    item.previousHashes.includes(localHash)
  ) {
    return "update";
  }
  return "skip-custom";
}

export async function syncOfficialPresetSkills(
  mode: OfficialPresetSkillSyncMode = "safe",
): Promise<OfficialPresetSkillSyncResult> {
  const result: OfficialPresetSkillSyncResult = {
    installed: 0,
    updated: 0,
    current: 0,
    skippedCustom: 0,
    failed: 0,
  };

  const client = getClient();
  const manifestResult = await client.query<{ presetSkillManifest: GQL.PresetSkillManifestItem[] }>({
    query: PRESET_SKILL_MANIFEST_QUERY,
    variables: { serviceIds: null },
    fetchPolicy: "network-only",
  });
  const manifest = manifestResult.data?.presetSkillManifest ?? [];
  if (manifest.length === 0) return result;

  const installedSkills = await fetchInstalledSkills().catch(() => []);
  const localHashes = new Map(installedSkills.map((skill) => [skill.slug, skill.sha256]));
  const decisions = manifest.map((item) => ({
    item,
    localSlug: item.localSlug || item.slug,
    decision: shouldWritePresetSkill(item, localHashes.get(item.localSlug || item.slug), mode),
  }));

  for (const { decision } of decisions) {
    if (decision === "skip-current") result.current += 1;
    if (decision === "skip-custom") result.skippedCustom += 1;
  }

  const targets = decisions.filter(({ decision }) => decision === "install" || decision === "update");
  if (targets.length === 0) return result;

  const serviceIds = [...new Set(targets.map(({ item }) => item.serviceId))];
  const contentResult = await client.query<{ presetSkills: string | null }>({
    query: PRESET_SKILLS_QUERY,
    variables: { serviceIds },
    fetchPolicy: "network-only",
  });
  const raw = contentResult.data?.presetSkills;
  if (!raw) {
    result.failed += targets.length;
    return result;
  }

  const contents = JSON.parse(raw) as Record<string, string>;
  for (const { item, localSlug, decision } of targets) {
    const content = contents[item.slug];
    if (!content) {
      result.failed += 1;
      continue;
    }
    const writeResult = await writeSkillTemplate(localSlug, content).catch((err) => ({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }));
    if (!writeResult.ok) {
      result.failed += 1;
      continue;
    }
    if (decision === "install") result.installed += 1;
    if (decision === "update") result.updated += 1;
  }

  return result;
}
