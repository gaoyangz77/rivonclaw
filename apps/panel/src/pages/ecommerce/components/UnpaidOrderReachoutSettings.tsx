import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import type { Shop } from "@rivonclaw/core/models";
import { Modal } from "../../../components/modals/Modal.js";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import {
  APPLY_UNPAID_CONFIG_VARIANT,
  ARCHIVE_UNPAID_CONFIG_EXPERIMENT,
  CREATE_UNPAID_CONFIG_EXPERIMENT,
  GET_UNPAID_EVALUATION,
  START_UNPAID_CONFIG_EXPERIMENT,
  STOP_UNPAID_CONFIG_EXPERIMENT,
  UPDATE_UNPAID_CONFIG_EXPERIMENT,
  UPDATE_UNPAID_REACHOUT_SETTINGS,
} from "../../../api/unpaid-experiment-queries.js";
import type { UnpaidReachoutStageDraft } from "../EcommercePage.js";

const TOKENS = ["{{order_id}}", "{{product_count}}", "{{shop_name}}"] as const;
const MAX_VARIANTS = 20;

type DisplayStatus = "DRAFT" | "RUNNING" | "STOPPED_MATURING" | "FINAL" | "ARCHIVED";

interface ExperimentStage extends GQL.UnpaidOrderReachoutStage {}

interface ExperimentVariant extends Omit<GQL.CsUnpaidOrderConfigVariantView, "stages"> {
  stages: ExperimentStage[];
}

interface ConfigExperiment extends Omit<
  GQL.CsUnpaidOrderConfigExperimentView,
  "displayStatus" | "startedAt" | "stoppedAt" | "resultsFinalAt" | "variants"
> {
  displayStatus: DisplayStatus;
  startedAt?: string | null;
  stoppedAt?: string | null;
  resultsFinalAt?: string | null;
  variants: ExperimentVariant[];
}

interface EvaluationView extends Omit<
  GQL.CsUnpaidOrderEvaluationView,
  "stages" | "holdout" | "config" | "locks"
> {
  stages: ExperimentStage[];
  holdout: {
    enabled: boolean;
    holdoutPercent: number;
    experiment?: {
      id: string;
      displayStatus: DisplayStatus;
      version: number;
      startedAt?: string | null;
    } | null;
  };
  config: {
    runningExperiment?: ConfigExperiment | null;
    draftExperiment?: ConfigExperiment | null;
    recentExperiments: ConfigExperiment[];
  };
  locks: {
    canEditBaseStages: boolean;
    canStartConfigExperiment: boolean;
    reason?: string | null;
  };
}

interface EvaluationQueryData {
  ecommerceGetCSUnpaidOrderEvaluation: EvaluationView;
}
interface ExperimentMutationData {
  ecommerceCreateCSUnpaidOrderConfigExperimentDraft?: ConfigExperiment;
  ecommerceUpdateCSUnpaidOrderConfigExperimentDraft?: ConfigExperiment;
  ecommerceStartCSUnpaidOrderConfigExperiment?: ConfigExperiment;
}

export interface UnpaidExperimentVariantDraft {
  variantKey: string;
  label: string;
  percentage: string;
  stages: UnpaidReachoutStageDraft[];
}

type VariantDraft = UnpaidExperimentVariantDraft;

interface Props {
  shop: Shop;
  enabled: boolean;
  stages: UnpaidReachoutStageDraft[];
  evaluationEnabled: boolean;
  holdoutPercent: string;
  onEnabledChange: (value: boolean) => void;
  onStagesChange: (value: UnpaidReachoutStageDraft[]) => void;
  onEvaluationEnabledChange: (value: boolean) => void;
  onHoldoutPercentChange: (value: string) => void;
}

function humanDelay(minutes: number, language: string): string {
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 60) return language.startsWith("zh") ? `${minutes} 分钟` : `${minutes} min`;
  if (minutes % 1440 === 0)
    return language.startsWith("zh") ? `${minutes / 1440} 天` : `${minutes / 1440}d`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return language.startsWith("zh") ? `${hours} 小时` : `${hours}h`;
}

function toDraftStages(stages: ExperimentStage[]): UnpaidReachoutStageDraft[] {
  return stages.map((stage) => ({ ...stage, delayMinutes: String(stage.delayMinutes) }));
}

interface ComparableStage {
  id?: string | null;
  enabled: boolean;
  delayMinutes: string | number;
  messageTemplate: string;
}

export function serializeUnpaidReachoutStages(stages: ReadonlyArray<ComparableStage>): string {
  return JSON.stringify(
    stages.map((stage) => ({
      id: stage.id ?? null,
      enabled: stage.enabled,
      delayMinutes: Number(stage.delayMinutes),
      messageTemplate: stage.messageTemplate,
    })),
  );
}

function toVariantDrafts(experiment: ConfigExperiment): VariantDraft[] {
  return experiment.variants.map((variant) => ({
    variantKey: variant.variantKey,
    label: variant.label,
    percentage: String(variant.percentage),
    stages: toDraftStages(variant.stages),
  }));
}

export function rebalanceUnpaidExperimentVariants(variants: VariantDraft[]): VariantDraft[] {
  const basis = Math.floor(10000 / variants.length);
  let remaining = 10000;
  return variants.map((variant, index) => {
    const value = index === variants.length - 1 ? remaining : basis;
    remaining -= value;
    return { ...variant, percentage: (value / 100).toFixed(2).replace(/\.00$/, "") };
  });
}

function nextVariantKey(variants: VariantDraft[]): string {
  const used = new Set(variants.map((variant) => variant.variantKey));
  for (let code = 65; code <= 84; code += 1) {
    const key = String.fromCharCode(code);
    if (!used.has(key)) return key;
  }
  return `V${variants.length + 1}`;
}

export function validateUnpaidExperimentVariants(variants: VariantDraft[]): Map<string, string[]> {
  const errors = new Map<string, string[]>();
  const hashes = new Map<string, string>();
  for (const variant of variants) {
    const item: string[] = [];
    const percentage = Number(variant.percentage);
    if (!variant.label.trim()) item.push("name");
    if (!Number.isFinite(percentage) || percentage < 1) item.push("weight");
    if (variant.stages.length < 1 || variant.stages.length > 3) item.push("stages");
    const delays = variant.stages
      .filter((stage) => stage.enabled)
      .map((stage) => Number(stage.delayMinutes));
    if (!delays.length) item.push("enabledStage");
    if (
      delays.some((delay) => !Number.isInteger(delay) || delay < 1 || delay > 2879) ||
      new Set(delays).size !== delays.length
    )
      item.push("delay");
    if (variant.stages.some((stage) => !stage.messageTemplate.trim())) item.push("template");
    const normalized = variant.stages
      .map((stage) => ({
        enabled: stage.enabled,
        delayMinutes: Number(stage.delayMinutes),
        messageTemplate: stage.messageTemplate.trim(),
      }))
      .sort((a, b) => a.delayMinutes - b.delayMinutes);
    const hash = JSON.stringify(normalized);
    const duplicate = hashes.get(hash);
    if (duplicate) {
      item.push("duplicate");
      errors.set(duplicate, [...(errors.get(duplicate) ?? []), "duplicate"]);
    } else hashes.set(hash, variant.variantKey);
    errors.set(variant.variantKey, item);
  }
  if (variants.length < 2 || variants.length > MAX_VARIANTS)
    errors.set("$experiment", ["variantCount"]);
  const total = variants.reduce((sum, variant) => sum + Number(variant.percentage || 0), 0);
  if (Math.abs(total - 100) > 0.001) errors.set("$weights", ["weightTotal"]);
  return errors;
}

export function UnpaidOrderReachoutSettings({
  shop,
  enabled,
  stages,
  evaluationEnabled,
  holdoutPercent,
  onEnabledChange,
  onStagesChange,
  onEvaluationEnabledChange,
  onHoldoutPercentChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const query = useQuery<EvaluationQueryData>(GET_UNPAID_EVALUATION, {
    variables: { shopId: shop.id },
    fetchPolicy: "cache-and-network",
  });
  const [updateSettings, updateState] = useMutation(UPDATE_UNPAID_REACHOUT_SETTINGS);
  const [createDraft] = useMutation<ExperimentMutationData>(CREATE_UNPAID_CONFIG_EXPERIMENT);
  const [updateDraft] = useMutation<ExperimentMutationData>(UPDATE_UNPAID_CONFIG_EXPERIMENT);
  const [archiveDraft] = useMutation(ARCHIVE_UNPAID_CONFIG_EXPERIMENT);
  const [startDraft] = useMutation<ExperimentMutationData>(START_UNPAID_CONFIG_EXPERIMENT);
  const [stopExperiment] = useMutation(STOP_UNPAID_CONFIG_EXPERIMENT);
  const [applyVariant] = useMutation(APPLY_UNPAID_CONFIG_VARIANT);
  const evaluation = query.data?.ecommerceGetCSUnpaidOrderEvaluation;
  const running = evaluation?.config.runningExperiment ?? null;
  const serverDraft = evaluation?.config.draftExperiment ?? null;
  const latestStopped =
    evaluation?.config.recentExperiments.find(
      (experiment) => experiment.displayStatus !== "ARCHIVED",
    ) ?? null;
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedVariantKey, setSelectedVariantKey] = useState("A");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [workspaceExperimentId, setWorkspaceExperimentId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"DRAFT" | "RUNNING" | "HISTORY">("DRAFT");
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [closePrompt, setClosePrompt] = useState(false);
  const hydratedShopRef = useRef<string | null>(null);
  const shopStages = shop.services?.customerService?.unpaidOrderReachoutStages ?? [];
  const shopEnabled = shop.services?.customerService?.unpaidOrderReachoutEnabled ?? false;
  const shopEvaluationEnabled =
    shop.services?.customerService?.unpaidOrderReachoutExperiment?.enabled ?? false;
  const shopHoldout =
    shop.services?.customerService?.unpaidOrderReachoutExperiment?.holdoutPercent ?? 5;
  const savedStages = evaluation?.stages ?? shopStages;
  const savedEnabled = evaluation?.reachoutEnabled ?? shopEnabled;
  const savedEvaluationEnabled = evaluation?.holdout.enabled ?? shopEvaluationEnabled;
  const savedHoldout = evaluation?.holdout.holdoutPercent ?? shopHoldout;
  const settingsDirty =
    enabled !== savedEnabled ||
    evaluationEnabled !== savedEvaluationEnabled ||
    holdoutPercent.trim() !== String(savedHoldout) ||
    serializeUnpaidReachoutStages(stages) !== serializeUnpaidReachoutStages(savedStages);
  const enabledStages = stages.filter((stage) => stage.enabled);
  const earliestDelay = enabledStages.length
    ? Math.min(...enabledStages.map((stage) => Number(stage.delayMinutes)))
    : null;
  const errors = useMemo(() => validateUnpaidExperimentVariants(variants), [variants]);
  const workspaceValid = [...errors.values()].every((items) => items.length === 0);
  const selectedVariant =
    variants.find((variant) => variant.variantKey === selectedVariantKey) ?? variants[0];
  const experimentActionDisabled =
    settingsDirty ||
    (!evaluation && query.loading) ||
    (!running && !serverDraft && evaluation?.locks.canStartConfigExperiment === false);

  useEffect(() => {
    if (!evaluation || hydratedShopRef.current === shop.id) return;
    const draftStillMatchesShop =
      enabled === shopEnabled &&
      evaluationEnabled === shopEvaluationEnabled &&
      holdoutPercent.trim() === String(shopHoldout) &&
      serializeUnpaidReachoutStages(stages) === serializeUnpaidReachoutStages(shopStages);
    hydratedShopRef.current = shop.id;
    if (draftStillMatchesShop) applyAuthoritative(evaluation);
  }, [shop.id, evaluation]);

  useEffect(() => {
    if (!workspaceOpen || workspaceDirty) return;
    const source = workspaceMode === "RUNNING" ? running : serverDraft;
    if (source) {
      setVariants(toVariantDrafts(source));
      setWorkspaceExperimentId(source.id);
      setSelectedVariantKey(source.variants[0]?.variantKey ?? "A");
    }
  }, [workspaceOpen, workspaceDirty, workspaceMode, running?.id, serverDraft?.id]);

  function applyAuthoritative(view: EvaluationView) {
    onEnabledChange(view.reachoutEnabled);
    onStagesChange(toDraftStages(view.stages));
    onEvaluationEnabledChange(view.holdout.enabled);
    onHoldoutPercentChange(String(view.holdout.holdoutPercent));
  }

  function updateStage(index: number, patch: Partial<UnpaidReachoutStageDraft>) {
    onStagesChange(
      stages.map((stage, itemIndex) => (itemIndex === index ? { ...stage, ...patch } : stage)),
    );
  }

  function openWorkspace(
    source?: ConfigExperiment | null,
    mode: "DRAFT" | "RUNNING" | "HISTORY" = "DRAFT",
  ) {
    if (source) {
      setVariants(toVariantDrafts(source));
      setWorkspaceExperimentId(source.id);
      setSelectedVariantKey(source.variants[0]?.variantKey ?? "A");
    } else {
      const base = stages.map((stage) => ({ ...stage }));
      setVariants([
        { variantKey: "A", label: "A", percentage: "50", stages: base },
        { variantKey: "B", label: "B", percentage: "50", stages: [] },
      ]);
      setWorkspaceExperimentId(null);
      setSelectedVariantKey("A");
    }
    setWorkspaceMode(mode);
    setWorkspaceDirty(false);
    setClosePrompt(false);
    setWorkspaceOpen(true);
  }

  function openNewVersionWorkspace() {
    if (serverDraft) {
      openWorkspace(serverDraft, "DRAFT");
      return;
    }
    if (!running) return;
    setVariants(
      toVariantDrafts(running).map((variant) => ({
        ...variant,
        stages: variant.stages.map((stage) => ({ ...stage, id: undefined })),
      })),
    );
    setWorkspaceExperimentId(null);
    setSelectedVariantKey(running.variants[0]?.variantKey ?? "A");
    setWorkspaceMode("DRAFT");
    setWorkspaceDirty(true);
    setClosePrompt(false);
    setWorkspaceOpen(true);
  }

  async function saveSettings() {
    const allDelayValues = stages.map((stage) => Number(stage.delayMinutes));
    const enabledDelayValues = stages
      .filter((stage) => stage.enabled)
      .map((stage) => Number(stage.delayMinutes));
    if (
      stages.length > 3 ||
      allDelayValues.some((delay) => !Number.isInteger(delay) || delay < 1 || delay > 2879) ||
      new Set(enabledDelayValues).size !== enabledDelayValues.length
    ) {
      showToast(t("ecommerce.shopDrawer.aiCS.unpaidReachoutInvalidDelay"), "error");
      return;
    }
    const holdout = Number(holdoutPercent);
    if (!Number.isInteger(holdout) || holdout < 1 || holdout > 20) {
      showToast(
        t("ecommerce.shopDrawer.aiCS.unpaidReachoutInvalidHoldout", {
          defaultValue: "Holdout must be a whole number from 1% to 20%.",
        }),
        "error",
      );
      return;
    }
    try {
      const stagesChanged =
        JSON.stringify(
          stages.map((stage) => ({ ...stage, delayMinutes: Number(stage.delayMinutes) })),
        ) !== JSON.stringify(savedStages);
      const evaluationChanged =
        evaluationEnabled !== savedEvaluationEnabled || holdout !== savedHoldout;
      const result = await updateSettings({
        variables: {
          input: {
            shopId: shop.id,
            ...(enabled !== savedEnabled ? { reachoutEnabled: enabled } : {}),
            ...(stagesChanged && evaluation?.locks.canEditBaseStages !== false
              ? {
                  stages: stages.map((stage) => ({
                    ...stage,
                    delayMinutes: Number(stage.delayMinutes),
                  })),
                }
              : {}),
            ...(evaluationChanged
              ? { evaluation: { enabled: enabled && evaluationEnabled, holdoutPercent: holdout } }
              : {}),
            expectedHoldoutExperimentId: evaluation?.holdout.experiment?.id,
            expectedConfigExperimentId: running?.id,
          },
        },
      });
      const view = (
        result.data as { ecommerceUpdateCSUnpaidOrderReachoutSettings: EvaluationView } | undefined
      )?.ecommerceUpdateCSUnpaidOrderReachoutSettings;
      if (view) applyAuthoritative(view);
      await Promise.all([query.refetch(), entityStore.fetchShops()]);
      showToast(t("common.saved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function persistDraft(): Promise<string | null> {
    if (!workspaceValid) return null;
    setWorkspaceBusy(true);
    try {
      const input = {
        shopId: shop.id,
        variants: variants.map((variant) => ({
          variantKey: variant.variantKey,
          label: variant.label.trim(),
          percentage: Number(variant.percentage),
          stages: variant.stages.map((stage) => ({
            ...stage,
            delayMinutes: Number(stage.delayMinutes),
          })),
        })),
      };
      const result = workspaceExperimentId
        ? await updateDraft({ variables: { experimentId: workspaceExperimentId, input } })
        : await createDraft({ variables: { input } });
      const saved = workspaceExperimentId
        ? result.data?.ecommerceUpdateCSUnpaidOrderConfigExperimentDraft
        : result.data?.ecommerceCreateCSUnpaidOrderConfigExperimentDraft;
      if (!saved) throw new Error("Draft was not returned");
      setWorkspaceExperimentId(saved.id);
      setVariants(toVariantDrafts(saved));
      setWorkspaceDirty(false);
      await query.refetch();
      showToast(
        t("ecommerce.shopDrawer.aiCS.unpaidExperimentDraftSaved", {
          defaultValue: "Experiment draft saved.",
        }),
        "success",
      );
      return saved.id;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
      return null;
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function launchExperiment() {
    const id = await persistDraft();
    if (!id) return;
    setWorkspaceBusy(true);
    try {
      await startDraft({
        variables: { experimentId: id, expectedRunningExperimentId: running?.id },
      });
      setWorkspaceDirty(false);
      setWorkspaceOpen(false);
      await query.refetch();
      showToast(
        t("ecommerce.shopDrawer.aiCS.unpaidExperimentStarted", {
          defaultValue: "Configuration experiment started.",
        }),
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function stopRunning() {
    if (!running) return;
    setWorkspaceBusy(true);
    try {
      await stopExperiment({ variables: { experimentId: running.id } });
      setWorkspaceOpen(false);
      await query.refetch();
      showToast(
        t("ecommerce.shopDrawer.aiCS.unpaidExperimentStopped", {
          defaultValue: "Experiment stopped; existing cohorts will continue to mature.",
        }),
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    } finally {
      setWorkspaceBusy(false);
    }
  }

  function updateVariant(patch: Partial<VariantDraft>) {
    if (!selectedVariant) return;
    setVariants(
      variants.map((variant) =>
        variant.variantKey === selectedVariant.variantKey ? { ...variant, ...patch } : variant,
      ),
    );
    setWorkspaceDirty(true);
  }

  const statusLabel = running
    ? t("ecommerce.shopDrawer.aiCS.unpaidStatusExperiment", {
        defaultValue: "Configuration experiment running",
      })
    : enabled
      ? t("ecommerce.shopDrawer.aiCS.unpaidStatusActive", { defaultValue: "Reachout active" })
      : t("ecommerce.shopDrawer.aiCS.unpaidStatusDisabled", { defaultValue: "Not enabled" });

  return (
    <div className="unpaid-console">
      <div className="unpaid-console-status">
        <div>
          <span className={`unpaid-status-dot ${enabled ? "is-active" : ""}`} />
          <strong>{statusLabel}</strong>
        </div>
        <span>
          {enabledStages.length}{" "}
          {t("ecommerce.shopDrawer.aiCS.unpaidStagesEnabled", { defaultValue: "active stages" })}
        </span>
        {earliestDelay !== null && (
          <span>
            {t("ecommerce.shopDrawer.aiCS.unpaidFirstReachout", { defaultValue: "First reachout" })}
            : {humanDelay(earliestDelay, i18n.language)}
          </span>
        )}
      </div>

      <div className="unpaid-master-row">
        <div>
          <strong>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutEnabled")}</strong>
          <p>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutHint")}</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              onEnabledChange(event.target.checked);
              if (!event.target.checked) onEvaluationEnabledChange(false);
            }}
          />
          <span className={`toggle-track ${enabled ? "toggle-track-on" : "toggle-track-off"}`}>
            <span className={`toggle-thumb ${enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`} />
          </span>
        </label>
      </div>

      <section className="unpaid-console-section">
        <div className="unpaid-section-heading">
          <div>
            <span>01</span>
            <div>
              <strong>
                {t("ecommerce.shopDrawer.aiCS.unpaidSchedule", {
                  defaultValue: "Follow-up schedule",
                })}
              </strong>
              <p>
                {t("ecommerce.shopDrawer.aiCS.unpaidScheduleHint", {
                  defaultValue:
                    "Messages run in chronological order while the order remains unpaid.",
                })}
              </p>
            </div>
          </div>
          {running && (
            <span className="unpaid-lock-note">
              {t("ecommerce.shopDrawer.aiCS.unpaidRunningLock", {
                defaultValue: "Locked by running experiment",
              })}
            </span>
          )}
        </div>
        <div className="unpaid-stage-timeline">
          {stages.map((stage, index) => {
            const delay = Number(stage.delayMinutes);
            return (
              <article
                className={`unpaid-stage-card ${stage.enabled ? "is-enabled" : "is-disabled"}`}
                key={stage.id ?? `new-${index}`}
              >
                <div className="unpaid-stage-rail">
                  <span>{index + 1}</span>
                </div>
                <div className="unpaid-stage-body">
                  <header>
                    <div>
                      <strong>
                        {t("ecommerce.shopDrawer.aiCS.unpaidReachoutStage", { index: index + 1 })}
                      </strong>
                      <span>{humanDelay(delay, i18n.language)}</span>
                    </div>
                    <div className="unpaid-stage-actions">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={stage.enabled}
                          disabled={!!running}
                          onChange={(event) =>
                            updateStage(index, { enabled: event.target.checked })
                          }
                        />
                        <span
                          className={`toggle-track ${stage.enabled ? "toggle-track-on" : "toggle-track-off"}`}
                        >
                          <span
                            className={`toggle-thumb ${stage.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                          />
                        </span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!!running}
                        onClick={() => onStagesChange(stages.filter((_, item) => item !== index))}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </header>
                  <label className="unpaid-field-label">
                    {t("ecommerce.shopDrawer.aiCS.unpaidReachoutStageMinutes")}
                  </label>
                  <div className="unpaid-delay-control">
                    <input
                      type="number"
                      min="1"
                      max="2879"
                      value={stage.delayMinutes}
                      disabled={!!running}
                      onChange={(event) => updateStage(index, { delayMinutes: event.target.value })}
                    />
                    <span>{humanDelay(delay, i18n.language)}</span>
                  </div>
                  <label className="unpaid-field-label">
                    {t("ecommerce.shopDrawer.aiCS.unpaidReachoutTemplate")}
                  </label>
                  <textarea
                    rows={4}
                    value={stage.messageTemplate}
                    disabled={!!running}
                    onChange={(event) =>
                      updateStage(index, { messageTemplate: event.target.value })
                    }
                    placeholder={t("ecommerce.shopDrawer.aiCS.unpaidReachoutTemplatePlaceholder")}
                  />
                  <div className="unpaid-token-row">
                    {TOKENS.map((token) => (
                      <button
                        type="button"
                        key={token}
                        disabled={!!running}
                        onClick={() =>
                          updateStage(index, {
                            messageTemplate: `${stage.messageTemplate}${token}`,
                          })
                        }
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
          {stages.length < 3 && !running && (
            <button
              type="button"
              className="unpaid-add-stage"
              onClick={() =>
                onStagesChange([
                  ...stages,
                  { enabled: true, delayMinutes: "", messageTemplate: "" },
                ])
              }
            >
              ＋ {t("ecommerce.shopDrawer.aiCS.unpaidReachoutAddStage")}
            </button>
          )}
        </div>
      </section>

      <details className="unpaid-evaluation" open={evaluationEnabled || !!running || !!serverDraft}>
        <summary>
          <span>02</span>
          <div>
            <strong>
              {t("ecommerce.shopDrawer.aiCS.unpaidEvaluation", {
                defaultValue: "Evaluation & optimization",
              })}
            </strong>
            <small>
              {t("ecommerce.shopDrawer.aiCS.unpaidEvaluationHint", {
                defaultValue:
                  "Measure incremental impact and compare complete reachout strategies.",
              })}
            </small>
          </div>
          <span className="unpaid-chevron">⌄</span>
        </summary>
        <div className="unpaid-evaluation-body">
          <div className="unpaid-evaluation-toggle">
            <div>
              <strong>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutControlGroup")}</strong>
              <p>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutControlHint")}</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={evaluationEnabled}
                disabled={!enabled}
                onChange={(event) => onEvaluationEnabledChange(event.target.checked)}
              />
              <span
                className={`toggle-track ${evaluationEnabled ? "toggle-track-on" : "toggle-track-off"}`}
              >
                <span
                  className={`toggle-thumb ${evaluationEnabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                />
              </span>
            </label>
          </div>
          {evaluationEnabled && (
            <>
              <div className="unpaid-holdout-panel">
                <div className="unpaid-holdout-panel-head">
                  <div>
                    <span className="unpaid-overline">
                      {t("ecommerce.shopDrawer.aiCS.unpaidTrafficAllocation", {
                        defaultValue: "Traffic allocation",
                      })}
                    </span>
                    <strong>
                      {t("ecommerce.shopDrawer.aiCS.unpaidTrafficSummary", {
                        holdout: holdoutPercent || 5,
                        treatment: 100 - (Number(holdoutPercent) || 5),
                        defaultValue: "{{holdout}}% holdout · {{treatment}}% normal reachout",
                      })}
                    </strong>
                    <p>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutHoldoutHint")}</p>
                  </div>
                  <label className="unpaid-holdout-field">
                    <span>
                      {t("ecommerce.shopDrawer.aiCS.unpaidHoldoutLabel", {
                        defaultValue: "Holdout percentage",
                      })}
                    </span>
                    <span className="unpaid-number-field">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={holdoutPercent}
                        onChange={(event) => onHoldoutPercentChange(event.target.value)}
                      />
                      <span>%</span>
                    </span>
                  </label>
                </div>
                <div className="unpaid-traffic-bar" aria-hidden="true">
                  <span
                    style={{ width: `${Math.max(1, Math.min(20, Number(holdoutPercent) || 5))}%` }}
                  />
                  <span />
                </div>
                <div className="unpaid-traffic-legend">
                  <span>
                    <i className="is-holdout" />
                    {t("ecommerce.shopDrawer.aiCS.unpaidNoReachout", {
                      defaultValue: "No reachout",
                    })}
                    <strong>{holdoutPercent || 5}%</strong>
                  </span>
                  <span>
                    <i className="is-treatment" />
                    {t("ecommerce.shopDrawer.aiCS.unpaidTreatment", { defaultValue: "Treatment" })}
                    <strong>{100 - (Number(holdoutPercent) || 5)}%</strong>
                  </span>
                </div>
              </div>
              <div className="unpaid-experiment-summary">
                <div className="unpaid-experiment-mark" aria-hidden="true">
                  A/B
                </div>
                <div className="unpaid-experiment-copy">
                  <span className="unpaid-overline">
                    {t("ecommerce.shopDrawer.aiCS.unpaidAdvancedOptimization", {
                      defaultValue: "Advanced optimization",
                    })}
                  </span>
                  <strong>
                    {t("ecommerce.shopDrawer.aiCS.unpaidConfigOptimization", {
                      defaultValue: "Configuration optimization",
                    })}
                  </strong>
                  <p>
                    {running
                      ? `${t("ecommerce.shopDrawer.aiCS.unpaidExperimentVersion", { defaultValue: "Version" })} ${running.version} · ${running.variants.length} variants`
                      : serverDraft
                        ? t("ecommerce.shopDrawer.aiCS.unpaidDraftReady", {
                            defaultValue: "A saved draft is ready to continue.",
                          })
                        : latestStopped
                          ? `${t("ecommerce.shopDrawer.aiCS.unpaidExperimentVersion", { defaultValue: "Version" })} ${latestStopped.version} · ${latestStopped.displayStatus === "FINAL" ? t("ecommerce.shopDrawer.aiCS.unpaidFinal", { defaultValue: "Final" }) : t("ecommerce.shopDrawer.aiCS.unpaidMaturing", { defaultValue: "Waiting for maturity" })}`
                          : t("ecommerce.shopDrawer.aiCS.unpaidNoConfigExperiment", {
                              defaultValue: "No configuration experiment is running.",
                            })}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={experimentActionDisabled}
                  onClick={() =>
                    running
                      ? openWorkspace(running, "RUNNING")
                      : serverDraft
                        ? openWorkspace(serverDraft, "DRAFT")
                        : openWorkspace()
                  }
                >
                  {running
                    ? t("ecommerce.shopDrawer.aiCS.unpaidManageExperiment", {
                        defaultValue: "Manage experiment",
                      })
                    : serverDraft
                      ? t("ecommerce.shopDrawer.aiCS.unpaidContinueDraft", {
                          defaultValue: "Continue draft",
                        })
                      : t("ecommerce.shopDrawer.aiCS.unpaidConfigureExperiment", {
                          defaultValue: "Configure A/B test",
                        })}
                </button>
              </div>
              {settingsDirty && (
                <p className="unpaid-inline-note">
                  {t("ecommerce.shopDrawer.aiCS.unpaidSaveBeforeExperiment", {
                    defaultValue:
                      "Save reachout and evaluation settings before configuring an experiment.",
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </details>

      <div className="unpaid-sticky-footer">
        <span className={settingsDirty ? "is-dirty" : "is-saved"}>
          {updateState.loading
            ? t("common.saving")
            : settingsDirty
              ? t("ecommerce.shopDrawer.aiCS.unpaidReachoutUnsaved")
              : t("common.saved")}
        </span>
        <div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!settingsDirty || updateState.loading}
            onClick={() => {
              onEnabledChange(savedEnabled);
              onStagesChange(toDraftStages(savedStages));
              onEvaluationEnabledChange(savedEvaluationEnabled);
              onHoldoutPercentChange(String(savedHoldout));
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!settingsDirty || updateState.loading}
            onClick={saveSettings}
          >
            {t("common.save")}
          </button>
        </div>
      </div>

      <Modal
        isOpen={workspaceOpen}
        onClose={() => (workspaceDirty ? setClosePrompt(true) : setWorkspaceOpen(false))}
        title={t("ecommerce.shopDrawer.aiCS.unpaidExperimentModalTitle", {
          defaultValue: "Unpaid order reachout experiment",
        })}
        closeLabel={t("common.close")}
        maxWidth={1180}
        className="unpaid-experiment-modal"
        portal
      >
        <div className="unpaid-workspace-meta">
          <span>{shop.alias || shop.shopName}</span>
          <span>
            {workspaceMode === "RUNNING"
              ? t("ecommerce.shopDrawer.aiCS.unpaidRunning", { defaultValue: "Running" })
              : t("ecommerce.shopDrawer.aiCS.unpaidDraft", { defaultValue: "Draft" })}
          </span>
          {running && <span>v{running.version}</span>}
        </div>
        <div className="unpaid-workspace-allocation">
          <div
            className="unpaid-workspace-holdout"
            style={{ flexBasis: `${Number(holdoutPercent) || 5}%` }}
          >
            {holdoutPercent || 5}%
          </div>
          {variants.map((variant) => (
            <div
              key={variant.variantKey}
              style={{
                flexGrow: (100 - (Number(holdoutPercent) || 5)) * Number(variant.percentage || 0),
              }}
            >
              <span>{variant.variantKey}</span>
              <small>
                {(
                  ((100 - (Number(holdoutPercent) || 5)) * Number(variant.percentage || 0)) /
                  100
                ).toFixed(1)}
                %
              </small>
            </div>
          ))}
        </div>
        <div className="unpaid-workspace-body">
          <aside className="unpaid-variant-nav">
            <div className="unpaid-variant-nav-head">
              <strong>
                {t("ecommerce.shopDrawer.aiCS.unpaidPlans", { defaultValue: "Plans" })}
              </strong>
              <span>
                {variants.length}/{MAX_VARIANTS}
              </span>
            </div>
            {variants.map((variant) => (
              <button
                type="button"
                className={selectedVariant?.variantKey === variant.variantKey ? "is-selected" : ""}
                key={variant.variantKey}
                onClick={() => setSelectedVariantKey(variant.variantKey)}
              >
                <span>{variant.variantKey}</span>
                <div>
                  <strong>{variant.label || variant.variantKey}</strong>
                  <small>{variant.percentage}%</small>
                </div>
                {(errors.get(variant.variantKey)?.length ?? 0) > 0 && <i>!</i>}
              </button>
            ))}
            {workspaceMode === "DRAFT" && variants.length < MAX_VARIANTS && (
              <button
                type="button"
                className="unpaid-add-variant"
                onClick={() => {
                  const key = nextVariantKey(variants);
                  setVariants(
                    rebalanceUnpaidExperimentVariants([
                      ...variants,
                      { variantKey: key, label: key, percentage: "1", stages: [] },
                    ]),
                  );
                  setSelectedVariantKey(key);
                  setWorkspaceDirty(true);
                }}
              >
                ＋ {t("ecommerce.shopDrawer.aiCS.unpaidAddPlan", { defaultValue: "Add plan" })}
              </button>
            )}
          </aside>
          <main className="unpaid-variant-editor">
            {selectedVariant && (
              <>
                <header>
                  <div>
                    <span>{selectedVariant.variantKey}</span>
                    <input
                      value={selectedVariant.label}
                      disabled={workspaceMode !== "DRAFT"}
                      onChange={(event) => updateVariant({ label: event.target.value })}
                    />
                  </div>
                  <label>
                    {t("ecommerce.shopDrawer.aiCS.unpaidTreatmentShare", {
                      defaultValue: "Treatment share",
                    })}
                    <span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        step="0.01"
                        value={selectedVariant.percentage}
                        disabled={workspaceMode !== "DRAFT"}
                        onChange={(event) => updateVariant({ percentage: event.target.value })}
                      />
                      %
                    </span>
                  </label>
                </header>
                <div className="unpaid-variant-toolbar">
                  {workspaceMode === "DRAFT" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const key = nextVariantKey(variants);
                          setVariants(
                            rebalanceUnpaidExperimentVariants([
                              ...variants,
                              {
                                ...selectedVariant,
                                variantKey: key,
                                label: `${selectedVariant.label} (${t("common.copy", { defaultValue: "Copy" })})`,
                                stages: selectedVariant.stages.map((stage) => ({
                                  ...stage,
                                  id: undefined,
                                })),
                              },
                            ]),
                          );
                          setSelectedVariantKey(key);
                          setWorkspaceDirty(true);
                        }}
                      >
                        {t("common.copy", { defaultValue: "Copy" })}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={variants.length <= 2}
                        onClick={() => {
                          const remaining = rebalanceUnpaidExperimentVariants(
                            variants.filter(
                              (variant) => variant.variantKey !== selectedVariant.variantKey,
                            ),
                          );
                          setVariants(remaining);
                          setSelectedVariantKey(remaining[0]?.variantKey ?? "A");
                          setWorkspaceDirty(true);
                        }}
                      >
                        {t("common.delete")}
                      </button>
                    </>
                  )}
                </div>
                <div className="unpaid-variant-stages">
                  {selectedVariant.stages.map((stage, index) => (
                    <div className="unpaid-variant-stage-card" key={stage.id ?? index}>
                      <header>
                        <strong>
                          {t("ecommerce.shopDrawer.aiCS.unpaidReachoutStage", { index: index + 1 })}
                        </strong>
                        <label>
                          <input
                            type="checkbox"
                            checked={stage.enabled}
                            disabled={workspaceMode !== "DRAFT"}
                            onChange={(event) =>
                              updateVariant({
                                stages: selectedVariant.stages.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, enabled: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                          {t("common.enabled", { defaultValue: "Enabled" })}
                        </label>
                        {workspaceMode === "DRAFT" && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              updateVariant({
                                stages: selectedVariant.stages.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          >
                            {t("common.delete")}
                          </button>
                        )}
                      </header>
                      <div className="unpaid-variant-delay">
                        <input
                          type="number"
                          min="1"
                          max="2879"
                          value={stage.delayMinutes}
                          disabled={workspaceMode !== "DRAFT"}
                          onChange={(event) =>
                            updateVariant({
                              stages: selectedVariant.stages.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, delayMinutes: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <span>{humanDelay(Number(stage.delayMinutes), i18n.language)}</span>
                      </div>
                      <textarea
                        rows={4}
                        value={stage.messageTemplate}
                        disabled={workspaceMode !== "DRAFT"}
                        onChange={(event) =>
                          updateVariant({
                            stages: selectedVariant.stages.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, messageTemplate: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <div className="unpaid-token-row">
                        {TOKENS.map((token) => (
                          <button
                            type="button"
                            key={token}
                            disabled={workspaceMode !== "DRAFT"}
                            onClick={() =>
                              updateVariant({
                                stages: selectedVariant.stages.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        messageTemplate: `${item.messageTemplate}${token}`,
                                      }
                                    : item,
                                ),
                              })
                            }
                          >
                            {token}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {workspaceMode === "DRAFT" && selectedVariant.stages.length < 3 && (
                    <button
                      type="button"
                      className="unpaid-add-stage"
                      onClick={() =>
                        updateVariant({
                          stages: [
                            ...selectedVariant.stages,
                            { enabled: true, delayMinutes: "", messageTemplate: "" },
                          ],
                        })
                      }
                    >
                      ＋ {t("ecommerce.shopDrawer.aiCS.unpaidReachoutAddStage")}
                    </button>
                  )}
                </div>
                {(errors.get(selectedVariant.variantKey)?.length ?? 0) > 0 && (
                  <div className="unpaid-validation-card">
                    {t("ecommerce.shopDrawer.aiCS.unpaidVariantInvalid", {
                      defaultValue:
                        "This plan needs a name, at least one enabled stage, valid unique delays, and a unique configuration.",
                    })}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
        <footer className="unpaid-workspace-footer">
          <div>
            {workspaceMode === "DRAFT" && !workspaceValid
              ? t("ecommerce.shopDrawer.aiCS.unpaidExperimentInvalid", {
                  defaultValue: "Resolve plan and allocation errors before starting.",
                })
              : workspaceDirty
                ? t("ecommerce.shopDrawer.aiCS.unpaidReachoutUnsaved")
                : t("common.saved")}
          </div>
          <div>
            {workspaceMode === "DRAFT" ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={workspaceBusy || !workspaceValid}
                  onClick={() => void persistDraft()}
                >
                  {t("ecommerce.shopDrawer.aiCS.unpaidSaveDraft", { defaultValue: "Save draft" })}
                </button>
                {workspaceExperimentId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={workspaceBusy}
                    onClick={async () => {
                      await archiveDraft({ variables: { experimentId: workspaceExperimentId } });
                      setWorkspaceOpen(false);
                      await query.refetch();
                    }}
                  >
                    {t("ecommerce.shopDrawer.aiCS.unpaidDiscardDraft", {
                      defaultValue: "Discard draft",
                    })}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={workspaceBusy || !workspaceValid}
                  onClick={() => void launchExperiment()}
                >
                  {running
                    ? t("ecommerce.shopDrawer.aiCS.unpaidStartNewVersion", {
                        defaultValue: "Start new version",
                      })
                    : t("ecommerce.shopDrawer.aiCS.unpaidStartExperiment", {
                        defaultValue: "Start experiment",
                      })}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openNewVersionWorkspace}
                >
                  {serverDraft
                    ? t("ecommerce.shopDrawer.aiCS.unpaidContinueDraft", {
                        defaultValue: "Continue draft",
                      })
                    : t("ecommerce.shopDrawer.aiCS.unpaidCreateVersion", {
                        defaultValue: "Create new version",
                      })}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={workspaceBusy}
                  onClick={() => void stopRunning()}
                >
                  {t("ecommerce.shopDrawer.aiCS.unpaidStopExperiment", {
                    defaultValue: "Stop experiment",
                  })}
                </button>
              </>
            )}
          </div>
        </footer>
        {closePrompt && (
          <div className="unpaid-close-prompt">
            <strong>
              {t("ecommerce.shopDrawer.aiCS.unpaidUnsavedDraftTitle", {
                defaultValue: "Save this experiment draft?",
              })}
            </strong>
            <p>
              {t("ecommerce.shopDrawer.aiCS.unpaidUnsavedDraftHint", {
                defaultValue: "The draft can be continued from another device after it is saved.",
              })}
            </p>
            <div>
              <button className="btn btn-ghost" onClick={() => setClosePrompt(false)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setWorkspaceDirty(false);
                  setWorkspaceOpen(false);
                }}
              >
                {t("ecommerce.shopDrawer.aiCS.unpaidDiscardChanges", {
                  defaultValue: "Discard changes",
                })}
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const id = await persistDraft();
                  if (id) setWorkspaceOpen(false);
                }}
              >
                {t("ecommerce.shopDrawer.aiCS.unpaidSaveAndClose", {
                  defaultValue: "Save & close",
                })}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {evaluation?.config.recentExperiments.some(
        (experiment) => experiment.displayStatus === "FINAL",
      ) && (
        <div className="unpaid-history-actions">
          {evaluation.config.recentExperiments
            .filter((experiment) => experiment.displayStatus === "FINAL")
            .slice(0, 1)
            .map((experiment) => (
              <div key={experiment.id}>
                <span>
                  {t("ecommerce.shopDrawer.aiCS.unpaidPreviousFinal", {
                    defaultValue: "Previous experiment finalized",
                  })}{" "}
                  · v{experiment.version}
                </span>
                {experiment.variants.map((variant) => (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    key={variant.variantKey}
                    onClick={async () => {
                      await applyVariant({
                        variables: { experimentId: experiment.id, variantKey: variant.variantKey },
                      });
                      await Promise.all([query.refetch(), entityStore.fetchShops()]);
                    }}
                  >
                    {t("ecommerce.shopDrawer.aiCS.unpaidUsePlan", { defaultValue: "Use plan" })}{" "}
                    {variant.label}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
