import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  CheckIcon,
  ChevronRightIcon,
  RefreshIcon,
  ShopIcon,
  UserPlusIcon,
} from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import {
  AFFILIATE_CAMPAIGNS_QUERY,
  AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY,
  AFFILIATE_CAMPAIGN_EXECUTIONS_QUERY,
  AFFILIATE_CAMPAIGN_SUMMARY_QUERY,
  ECOMMERCE_SEARCH_PRODUCTS_QUERY,
  GENERATE_AFFILIATE_CAMPAIGN_TEMPLATE_MUTATION,
  SET_AFFILIATE_CAMPAIGN_STATUS_MUTATION,
  SHOPS_QUERY,
  WRITE_AFFILIATE_CAMPAIGN_MUTATION,
} from "../../api/shops-queries.js";

type CampaignForm = {
  shopId: string;
  productId: string;
  name: string;
  dailyTarget: string;
  minimumFollowers: string;
  minimumExpectedSales: string;
  searchKeyword: string;
  templateText: string;
  templateSource: GQL.AffiliateCampaignMessageTemplateSource;
};

const emptyForm: CampaignForm = {
  shopId: "",
  productId: "",
  name: "",
  dailyTarget: "100",
  minimumFollowers: "1000",
  minimumExpectedSales: "",
  searchKeyword: "",
  templateText: "",
  templateSource: GQL.AffiliateCampaignMessageTemplateSource.UserAuthored,
};

const stateStatusOptions = Object.values(GQL.AffiliateCampaignCreatorStateStatus);

export const AffiliateCampaignPage = observer(function AffiliateCampaignPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [editingCampaignId, setEditingCampaignId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [stateStatus, setStateStatus] = useState("");

  const campaignsQuery = useQuery<{ affiliateCampaigns: GQL.AffiliateCampaign[] }>(
    AFFILIATE_CAMPAIGNS_QUERY,
    { variables: { input: { limit: 100 } }, fetchPolicy: "cache-and-network" },
  );
  const shopsQuery = useQuery<{ shops: GQL.Shop[] }>(SHOPS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const productsQuery = useQuery<{ ecommerceSearchProducts: GQL.EcomProductSummary[] }>(
    ECOMMERCE_SEARCH_PRODUCTS_QUERY,
    {
      variables: {
        shopId: form.shopId,
        status: GQL.EcomProductStatus.Activate,
        limit: 200,
      },
      skip: !form.shopId,
    },
  );
  const summaryQuery = useQuery<{ affiliateCampaignSummary: GQL.AffiliateCampaignSummary }>(
    AFFILIATE_CAMPAIGN_SUMMARY_QUERY,
    {
      variables: { campaignId: selectedCampaignId },
      skip: !selectedCampaignId,
      pollInterval: selectedCampaignId ? 15_000 : 0,
    },
  );
  const executionsQuery = useQuery<{
    affiliateCampaignDailyExecutions: GQL.AffiliateCampaignDailyExecution[];
  }>(AFFILIATE_CAMPAIGN_EXECUTIONS_QUERY, {
    variables: { input: { campaignId: selectedCampaignId, limit: 14 } },
    skip: !selectedCampaignId,
  });
  const creatorStatesQuery = useQuery<{
    affiliateCampaignCreatorStates: GQL.AffiliateCampaignCreatorStatePage;
  }>(AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY, {
    variables: {
      input: {
        campaignId: selectedCampaignId,
        limit: 50,
        ...(stateStatus ? { status: stateStatus } : {}),
      },
    },
    skip: !selectedCampaignId,
  });

  const [writeCampaign, writeCampaignState] = useMutation<
    { writeAffiliateCampaign: GQL.AffiliateCampaign },
    { input: GQL.WriteAffiliateCampaignInput }
  >(WRITE_AFFILIATE_CAMPAIGN_MUTATION);
  const [setCampaignStatus, statusMutationState] = useMutation<
    { setAffiliateCampaignStatus: GQL.AffiliateCampaign },
    { input: GQL.SetAffiliateCampaignStatusInput }
  >(SET_AFFILIATE_CAMPAIGN_STATUS_MUTATION);
  const [generateTemplate, generateTemplateState] = useMutation<
    { generateAffiliateCampaignMessageTemplate: GQL.AffiliateCampaignMessageTemplateSuggestion },
    { input: GQL.GenerateAffiliateCampaignMessageTemplateInput }
  >(GENERATE_AFFILIATE_CAMPAIGN_TEMPLATE_MUTATION);

  const campaigns = campaignsQuery.data?.affiliateCampaigns ?? [];
  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0];
  const summary = summaryQuery.data?.affiliateCampaignSummary;
  const latestExecution = summary?.latestExecution;
  const shops = (shopsQuery.data?.shops ?? []).filter(
    (shop) =>
      shop.platform === GQL.ShopPlatform.TiktokShop &&
      shop.authStatus === GQL.ShopAuthStatus.Authorized,
  );
  const selectedShop = shops.find((shop) => shop.id === form.shopId);
  const products = productsQuery.data?.ecommerceSearchProducts ?? [];
  const selectedProduct = products.find((product) => product.productId === form.productId);

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]) setSelectedCampaignId(campaigns[0].id);
    if (
      selectedCampaignId &&
      campaigns.length > 0 &&
      !campaigns.some((campaign) => campaign.id === selectedCampaignId)
    ) {
      setSelectedCampaignId(campaigns[0]!.id);
    }
  }, [campaigns, selectedCampaignId]);

  const shopOptions = shops.map((shop) => ({
    value: shop.id,
    label: shop.shopName,
    description: `${shop.region ?? "—"} · ${shop.timezone}`,
  }));
  const productOptions = products.map((product) => ({
    value: product.productId,
    label: product.title || product.productId,
    description: [product.priceMin, product.priceMax].filter(Boolean).join(" – "),
  }));
  const stateOptions = [
    { value: "", label: t("ecommerce.affiliateCampaign.allStates") },
    ...stateStatusOptions.map((status) => ({
      value: status,
      label: campaignStateLabel(status, t),
    })),
  ];

  const openCreate = () => {
    setForm(emptyForm);
    setEditingCampaignId("");
    setWizardStep(1);
    setWizardOpen(true);
  };

  const openEdit = (campaign: GQL.AffiliateCampaign) => {
    const filters =
      campaign.marketplaceSearchFilters &&
      typeof campaign.marketplaceSearchFilters === "object"
        ? campaign.marketplaceSearchFilters as Record<string, unknown>
        : {};
    setForm({
      shopId: campaign.shopId,
      productId: campaign.primaryProductId,
      name: campaign.name,
      dailyTarget: String(campaign.dailyOutreachTarget),
      minimumFollowers: String(campaign.minimumFollowerCount),
      minimumExpectedSales:
        campaign.minimumExpectedSalesUnits == null
          ? ""
          : String(campaign.minimumExpectedSalesUnits),
      searchKeyword: typeof filters.keyword === "string" ? filters.keyword : "",
      templateText: campaign.messageTemplateText,
      templateSource: campaign.messageTemplateSource,
    });
    setEditingCampaignId(campaign.id);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const updateForm = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validateStep = () => {
    if (wizardStep === 1 && (!form.shopId || !form.productId || !form.name.trim())) {
      showToast(t("ecommerce.affiliateCampaign.completeShopProduct"), "error");
      return false;
    }
    if (
      wizardStep === 2 &&
      (
        Number(form.dailyTarget) < 1 ||
        Number(form.dailyTarget) > 10_000 ||
        Number(form.minimumFollowers) < 1 ||
        (form.minimumExpectedSales && Number(form.minimumExpectedSales) < 0)
      )
    ) {
      showToast(t("ecommerce.affiliateCampaign.invalidTargets"), "error");
      return false;
    }
    if (wizardStep === 3 && !form.templateText.trim()) {
      showToast(t("ecommerce.affiliateCampaign.templateRequired"), "error");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setWizardStep((step) => Math.min(4, step + 1));
  };

  const createCampaign = async () => {
    if (!validateStep()) return;
    try {
      const result = await writeCampaign({
        variables: {
          input: {
            ...(editingCampaignId ? { id: editingCampaignId } : {}),
            shopId: form.shopId,
            name: form.name.trim(),
            primaryProductId: form.productId,
            dailyOutreachTarget: Number(form.dailyTarget),
            minimumFollowerCount: Number(form.minimumFollowers),
            minimumExpectedSalesUnits: form.minimumExpectedSales
              ? Number(form.minimumExpectedSales)
              : null,
            marketplaceSearchFilters: {
              pageSize: 100,
              region: selectedShop?.region ?? null,
              keyword: form.searchKeyword.trim() || null,
              followerDemographics: {
                minFollowerCount: Number(form.minimumFollowers),
              },
            },
            messageTemplateText: form.templateText.trim(),
            messageTemplateSource: form.templateSource,
            status:
              selectedCampaign?.id === editingCampaignId
                ? selectedCampaign.status
                : GQL.AffiliateCampaignStatus.Active,
          },
        },
      });
      const created = result.data?.writeAffiliateCampaign;
      if (!created) throw new Error(t("ecommerce.affiliateCampaign.createFailed"));
      setWizardOpen(false);
      setSelectedCampaignId(created.id);
      await campaignsQuery.refetch();
      showToast(
        t(
          editingCampaignId
            ? "ecommerce.affiliateCampaign.updated"
            : "ecommerce.affiliateCampaign.created",
        ),
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    }
  };

  const generateMessage = async () => {
    if (!form.shopId || !form.productId) return;
    try {
      const result = await generateTemplate({
        variables: {
          input: {
            shopId: form.shopId,
            productId: form.productId,
            guidance: form.templateText.trim() || null,
          },
        },
      });
      const suggestion = result.data?.generateAffiliateCampaignMessageTemplate;
      if (!suggestion) throw new Error(t("ecommerce.affiliateCampaign.templateGenerationFailed"));
      setForm((current) => ({
        ...current,
        templateText: suggestion.text,
        templateSource: GQL.AffiliateCampaignMessageTemplateSource.AiGenerated,
      }));
      showToast(t("ecommerce.affiliateCampaign.templateReady"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    }
  };

  const changeStatus = async (campaign: GQL.AffiliateCampaign) => {
    const nextStatus =
      campaign.status === GQL.AffiliateCampaignStatus.Active
        ? GQL.AffiliateCampaignStatus.Paused
        : GQL.AffiliateCampaignStatus.Active;
    try {
      await setCampaignStatus({
        variables: { input: { campaignId: campaign.id, status: nextStatus } },
      });
      await Promise.all([campaignsQuery.refetch(), summaryQuery.refetch()]);
      showToast(
        t(
          nextStatus === GQL.AffiliateCampaignStatus.Active
            ? "ecommerce.affiliateCampaign.resumed"
            : "ecommerce.affiliateCampaign.paused",
        ),
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    }
  };

  const activeCount = campaigns.filter(
    (campaign) => campaign.status === GQL.AffiliateCampaignStatus.Active,
  ).length;
  const todaySent = campaigns.reduce(
    (sum, campaign) =>
      sum +
      (campaign.id === selectedCampaignId ? (summary?.counters.sent ?? 0) : 0),
    0,
  );

  return (
    <div className="affiliate-campaign-page">
      <header className="affiliate-campaign-hero">
        <div>
          <span className="affiliate-campaign-eyebrow">
            {t("ecommerce.affiliateCampaign.eyebrow")}
          </span>
          <h1>{t("ecommerce.affiliateCampaign.title")}</h1>
          <p>{t("ecommerce.affiliateCampaign.subtitle")}</p>
        </div>
        <div className="affiliate-campaign-hero-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void campaignsQuery.refetch()}
          >
            <RefreshIcon /> {t("common.refresh")}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <UserPlusIcon /> {t("ecommerce.affiliateCampaign.create")}
          </button>
        </div>
      </header>

      <section className="affiliate-campaign-command-strip">
        <div className="affiliate-campaign-window">
          <span>{t("ecommerce.affiliateCampaign.sendingWindow")}</span>
          <strong>08:00</strong>
          <div aria-hidden="true"><i /><i /></div>
          <strong>22:00</strong>
          <small>{t("ecommerce.affiliateCampaign.localTime")}</small>
        </div>
        <CampaignMetric
          label={t("ecommerce.affiliateCampaign.activeCampaigns")}
          value={activeCount}
          detail={t("ecommerce.affiliateCampaign.totalCampaigns", { count: campaigns.length })}
        />
        <CampaignMetric
          label={t("ecommerce.affiliateCampaign.todaySent")}
          value={todaySent}
          detail={t("ecommerce.affiliateCampaign.tiktokOnly")}
        />
        <CampaignMetric
          label={t("ecommerce.affiliateCampaign.agentCost")}
          value="0"
          detail={t("ecommerce.affiliateCampaign.firstTouchNoAgent")}
        />
      </section>

      {campaigns.length === 0 && !campaignsQuery.loading ? (
        <section className="affiliate-campaign-empty">
          <div className="affiliate-campaign-empty-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <span>{t("ecommerce.affiliateCampaign.emptyLabel")}</span>
            <h2>{t("ecommerce.affiliateCampaign.emptyTitle")}</h2>
            <p>{t("ecommerce.affiliateCampaign.emptyDescription")}</p>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              {t("ecommerce.affiliateCampaign.createFirst")}
            </button>
          </div>
        </section>
      ) : (
        <div className="affiliate-campaign-workspace">
          <aside className="affiliate-campaign-rail">
            <div className="affiliate-campaign-rail-heading">
              <span>{t("ecommerce.affiliateCampaign.portfolio")}</span>
              <strong>{campaigns.length}</strong>
            </div>
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                className="affiliate-campaign-rail-card"
                data-active={campaign.id === selectedCampaign?.id || undefined}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <span className={`affiliate-campaign-status-dot is-${campaign.status.toLowerCase()}`} />
                <span>
                  <strong>{campaign.name}</strong>
                  <small>
                    {campaign.market} · {campaign.dailyOutreachTarget}/
                    {t("ecommerce.affiliateCampaign.day")}
                  </small>
                </span>
                <ChevronRightIcon />
              </button>
            ))}
          </aside>

          {selectedCampaign && (
            <main className="affiliate-campaign-detail">
              <header className="affiliate-campaign-detail-header">
                <div>
                  <div className="affiliate-campaign-title-line">
                    <h2>{selectedCampaign.name}</h2>
                    <span className={`affiliate-campaign-status is-${selectedCampaign.status.toLowerCase()}`}>
                      {campaignStatusLabel(selectedCampaign.status, t)}
                    </span>
                  </div>
                  <p>
                    {selectedCampaign.market} · {selectedCampaign.resolvedTimeZone} ·{" "}
                    {t("ecommerce.affiliateCampaign.templateVersion", {
                      version: selectedCampaign.templateVersion,
                    })}
                  </p>
                </div>
                {selectedCampaign.status !== GQL.AffiliateCampaignStatus.Archived &&
                  selectedCampaign.status !== GQL.AffiliateCampaignStatus.Completed && (
                  <div className="affiliate-campaign-detail-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEdit(selectedCampaign)}
                    >
                      {t("ecommerce.affiliateCampaign.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={statusMutationState.loading}
                      onClick={() => void changeStatus(selectedCampaign)}
                    >
                      {selectedCampaign.status === GQL.AffiliateCampaignStatus.Active
                        ? t("ecommerce.affiliateCampaign.pause")
                        : t("ecommerce.affiliateCampaign.resume")}
                    </button>
                  </div>
                )}
              </header>

              <section className="affiliate-campaign-today">
                <div className="affiliate-campaign-today-copy">
                  <span>{t("ecommerce.affiliateCampaign.todayExecution")}</span>
                  <strong>
                    {latestExecution
                      ? executionStatusLabel(latestExecution.status, t)
                      : t("ecommerce.affiliateCampaign.notStarted")}
                  </strong>
                  <small>
                    {latestExecution?.nextTickAt
                      ? t("ecommerce.affiliateCampaign.nextSend", {
                          time: formatDateTime(latestExecution.nextTickAt),
                        })
                      : latestExecution?.underDeliveryReason ||
                        t("ecommerce.affiliateCampaign.waitingForWindow")}
                  </small>
                </div>
                <div className="affiliate-campaign-cadence">
                  <span>{t("ecommerce.affiliateCampaign.cadence")}</span>
                  <strong>
                    {estimateCampaignCadence(
                      selectedCampaign.dailyOutreachTarget,
                      latestExecution?.counters.submitted ?? 0,
                    )}
                  </strong>
                  <small>{t("ecommerce.affiliateCampaign.dynamicJitter")}</small>
                </div>
                <div className="affiliate-campaign-quota">
                  <span>{t("ecommerce.affiliateCampaign.allocatedQuota")}</span>
                  <strong>
                    {latestExecution?.allocatedTarget ?? selectedCampaign.dailyOutreachTarget}
                  </strong>
                  <small>
                    {t("ecommerce.affiliateCampaign.shopDailyCap", { count: 10_000 })}
                  </small>
                </div>
              </section>

              <CampaignFunnel
                counters={summary?.counters}
                t={t}
              />

              <section className="affiliate-campaign-configuration">
                <div>
                  <span>{t("ecommerce.affiliateCampaign.primaryProduct")}</span>
                  <strong>{selectedCampaign.primaryProductId}</strong>
                </div>
                <div>
                  <span>{t("ecommerce.affiliateCampaign.minimumFollowers")}</span>
                  <strong>{formatNumber(selectedCampaign.minimumFollowerCount)}</strong>
                </div>
                <div>
                  <span>{t("ecommerce.affiliateCampaign.minimumExpectedSales")}</span>
                  <strong>{selectedCampaign.minimumExpectedSalesUnits ?? "—"}</strong>
                </div>
                <div className="affiliate-campaign-template-readout">
                  <span>{t("ecommerce.affiliateCampaign.firstMessage")}</span>
                  <p>{selectedCampaign.messageTemplateText}</p>
                </div>
              </section>

              <section className="affiliate-campaign-state-panel">
                <div className="affiliate-campaign-section-heading">
                  <div>
                    <span>{t("ecommerce.affiliateCampaign.creatorPipeline")}</span>
                    <h3>{t("ecommerce.affiliateCampaign.creatorStates")}</h3>
                  </div>
                  <Select
                    value={stateStatus}
                    onChange={setStateStatus}
                    options={stateOptions}
                    ariaLabel={t("ecommerce.affiliateCampaign.filterState")}
                  />
                </div>
                <div className="affiliate-campaign-state-table-wrap">
                  <table className="affiliate-campaign-state-table">
                    <thead>
                      <tr>
                        <th>{t("ecommerce.affiliateCampaign.creator")}</th>
                        <th>{t("ecommerce.affiliateCampaign.state")}</th>
                        <th>{t("ecommerce.affiliateCampaign.expectedSales")}</th>
                        <th>{t("ecommerce.affiliateCampaign.followers")}</th>
                        <th>{t("ecommerce.affiliateCampaign.efficiency")}</th>
                        <th>{t("ecommerce.affiliateCampaign.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(creatorStatesQuery.data?.affiliateCampaignCreatorStates.items ?? []).map(
                        (state) => (
                          <tr key={state.id}>
                            <td>
                              <strong>{shortId(state.creatorId)}</strong>
                              <small>
                                {t("ecommerce.affiliateCampaign.seenTimes", {
                                  count: state.searchOccurrenceCount,
                                })}
                              </small>
                            </td>
                            <td>
                              <span className={`affiliate-campaign-state-pill is-${state.status.toLowerCase()}`}>
                                {campaignStateLabel(state.status, t)}
                              </span>
                            </td>
                            <td>{formatOptionalNumber(state.expectedSalesUnits)}</td>
                            <td>{formatOptionalNumber(state.followerCount)}</td>
                            <td>{formatScore(state.efficiencyScore)}</td>
                            <td>{state.decisionReason || "—"}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                  {!creatorStatesQuery.loading &&
                    !(creatorStatesQuery.data?.affiliateCampaignCreatorStates.items.length) && (
                      <div className="affiliate-campaign-table-empty">
                        {t("ecommerce.affiliateCampaign.noCreatorStates")}
                      </div>
                    )}
                </div>
              </section>

              {(executionsQuery.data?.affiliateCampaignDailyExecutions.length ?? 0) > 1 && (
                <section className="affiliate-campaign-history-strip">
                  <span>{t("ecommerce.affiliateCampaign.recentExecutions")}</span>
                  <div>
                    {executionsQuery.data!.affiliateCampaignDailyExecutions.slice(0, 7).map(
                      (execution) => (
                        <article key={execution.id}>
                          <strong>{execution.marketLocalDate}</strong>
                          <small>{execution.counters.sent}/{execution.allocatedTarget}</small>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}
            </main>
          )}
        </div>
      )}

      <Modal
        isOpen={wizardOpen}
        onClose={() => !writeCampaignState.loading && setWizardOpen(false)}
        title={t(
          editingCampaignId
            ? "ecommerce.affiliateCampaign.editWizardTitle"
            : "ecommerce.affiliateCampaign.wizardTitle",
        )}
        maxWidth={1060}
        portal
        className="affiliate-campaign-wizard"
        preventBackdropClose={writeCampaignState.loading}
      >
        <CampaignWizardSteps step={wizardStep} t={t} />
        <div className="affiliate-campaign-wizard-body">
          {wizardStep === 1 && (
            <div className="affiliate-campaign-wizard-grid">
              <section className="affiliate-campaign-wizard-copy">
                <span>01</span>
                <h3>{t("ecommerce.affiliateCampaign.stepShopTitle")}</h3>
                <p>{t("ecommerce.affiliateCampaign.stepShopDescription")}</p>
              </section>
              <section className="affiliate-campaign-wizard-fields">
                <label>
                  <span>{t("ecommerce.affiliateCampaign.campaignName")}</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder={t("ecommerce.affiliateCampaign.campaignNamePlaceholder")}
                  />
                </label>
                <label>
                  <span>{t("ecommerce.affiliateCampaign.shop")}</span>
                  <Select
                    value={form.shopId}
                    onChange={(shopId) =>
                      setForm((current) => ({ ...current, shopId, productId: "" }))}
                    options={shopOptions}
                    searchable
                    disabled={Boolean(editingCampaignId)}
                    searchPlaceholder={t("ecommerce.affiliateCampaign.searchShop")}
                    placeholder={t("ecommerce.affiliateCampaign.selectShop")}
                  />
                </label>
                <label>
                  <span>{t("ecommerce.affiliateCampaign.primaryProduct")}</span>
                  <Select
                    value={form.productId}
                    onChange={(productId) => updateForm("productId", productId)}
                    options={productOptions}
                    searchable
                    disabled={!form.shopId || productsQuery.loading}
                    searchPlaceholder={t("ecommerce.affiliateCampaign.searchProduct")}
                    placeholder={
                      productsQuery.loading
                        ? t("common.loading")
                        : t("ecommerce.affiliateCampaign.selectProduct")
                    }
                  />
                </label>
                {selectedShop && (
                  <div className="affiliate-campaign-derived-context">
                    <ShopIcon />
                    <span>
                      <strong>{selectedShop.region ?? "—"}</strong>
                      <small>{selectedShop.timezone}</small>
                    </span>
                    <i>{t("ecommerce.affiliateCampaign.systemDerived")}</i>
                  </div>
                )}
              </section>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="affiliate-campaign-wizard-grid">
              <section className="affiliate-campaign-wizard-copy">
                <span>02</span>
                <h3>{t("ecommerce.affiliateCampaign.stepTargetTitle")}</h3>
                <p>{t("ecommerce.affiliateCampaign.stepTargetDescription")}</p>
              </section>
              <section className="affiliate-campaign-wizard-fields">
                <div className="affiliate-campaign-field-pair">
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.dailyTarget")}</span>
                    <input
                      type="number"
                      min={1}
                      max={10_000}
                      value={form.dailyTarget}
                      onChange={(event) => updateForm("dailyTarget", event.target.value)}
                    />
                    <small>{t("ecommerce.affiliateCampaign.dailyTargetHint")}</small>
                  </label>
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.minimumFollowers")}</span>
                    <input
                      type="number"
                      min={1}
                      value={form.minimumFollowers}
                      onChange={(event) => updateForm("minimumFollowers", event.target.value)}
                    />
                    <small>{t("ecommerce.affiliateCampaign.minimumFollowersHint")}</small>
                  </label>
                </div>
                <div className="affiliate-campaign-field-pair">
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.minimumExpectedSalesOptional")}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.minimumExpectedSales}
                      onChange={(event) => updateForm("minimumExpectedSales", event.target.value)}
                      placeholder={t("ecommerce.affiliateCampaign.noMinimum")}
                    />
                  </label>
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.marketplaceKeyword")}</span>
                    <input
                      value={form.searchKeyword}
                      onChange={(event) => updateForm("searchKeyword", event.target.value)}
                      placeholder={t("ecommerce.affiliateCampaign.keywordPlaceholder")}
                    />
                  </label>
                </div>
                <div className="affiliate-campaign-allocation-preview">
                  <span>{t("ecommerce.affiliateCampaign.allocationPreview")}</span>
                  <strong>
                    {formatNumber(Number(form.dailyTarget) || 0)} / 10,000
                  </strong>
                  <div><i style={{ width: `${Math.min(100, ((Number(form.dailyTarget) || 0) / 100))}%` }} /></div>
                  <small>{t("ecommerce.affiliateCampaign.proportionalAllocationHint")}</small>
                </div>
              </section>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="affiliate-campaign-wizard-grid">
              <section className="affiliate-campaign-wizard-copy">
                <span>03</span>
                <h3>{t("ecommerce.affiliateCampaign.stepMessageTitle")}</h3>
                <p>{t("ecommerce.affiliateCampaign.stepMessageDescription")}</p>
              </section>
              <section className="affiliate-campaign-wizard-fields">
                <div className="affiliate-campaign-template-toolbar">
                  <div>
                    <strong>{t("ecommerce.affiliateCampaign.supportedVariables")}</strong>
                    <span>{"{{creator_name}} · {{product_name}} · {{shop_name}}"}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void generateMessage()}
                    disabled={generateTemplateState.loading}
                  >
                    {generateTemplateState.loading
                      ? t("ecommerce.affiliateCampaign.generating")
                      : t("ecommerce.affiliateCampaign.generateWithAi")}
                  </button>
                </div>
                <label>
                  <span>{t("ecommerce.affiliateCampaign.messageTemplate")}</span>
                  <textarea
                    rows={8}
                    maxLength={2000}
                    value={form.templateText}
                    onChange={(event) => {
                      updateForm("templateText", event.target.value);
                      updateForm(
                        "templateSource",
                        GQL.AffiliateCampaignMessageTemplateSource.UserAuthored,
                      );
                    }}
                    placeholder={t("ecommerce.affiliateCampaign.messagePlaceholder")}
                  />
                  <small>
                    {form.templateText.length}/2000 ·{" "}
                    {form.templateSource === GQL.AffiliateCampaignMessageTemplateSource.AiGenerated
                      ? t("ecommerce.affiliateCampaign.aiDraftReviewRequired")
                      : t("ecommerce.affiliateCampaign.userAuthored")}
                  </small>
                </label>
                <div className="affiliate-campaign-message-preview">
                  <span>{t("ecommerce.affiliateCampaign.preview")}</span>
                  <p>
                    {renderAffiliateCampaignTemplatePreview(
                      form.templateText,
                      selectedProduct?.title || t("ecommerce.affiliateCampaign.previewProduct"),
                      selectedShop?.shopName || t("ecommerce.affiliateCampaign.previewShop"),
                    ) || t("ecommerce.affiliateCampaign.previewEmpty")}
                  </p>
                </div>
              </section>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="affiliate-campaign-confirmation">
              <section>
                <span>04</span>
                <h3>{t("ecommerce.affiliateCampaign.stepConfirmTitle")}</h3>
                <p>{t("ecommerce.affiliateCampaign.stepConfirmDescription")}</p>
              </section>
              <div className="affiliate-campaign-confirm-grid">
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.shopAndProduct")}
                  value={`${selectedShop?.shopName ?? "—"} · ${selectedProduct?.title ?? form.productId}`}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.dailyTarget")}
                  value={t("ecommerce.affiliateCampaign.messagesPerDay", {
                    count: Number(form.dailyTarget),
                  })}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.sendingWindow")}
                  value={`08:00–22:00 · ${selectedShop?.timezone ?? "—"}`}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.estimatedInterval")}
                  value={estimateCampaignCadence(Number(form.dailyTarget), 0)}
                />
              </div>
              <div className="affiliate-campaign-authorization">
                <CheckIcon />
                <div>
                  <strong>{t("ecommerce.affiliateCampaign.authorizationTitle")}</strong>
                  <p>{t("ecommerce.affiliateCampaign.authorizationBody")}</p>
                </div>
              </div>
              <div className="affiliate-campaign-boundaries">
                <span><i />{t("ecommerce.affiliateCampaign.platformOnlyBoundary")}</span>
                <span><i />{t("ecommerce.affiliateCampaign.noFallbackBoundary")}</span>
                <span><i />{t("ecommerce.affiliateCampaign.replyHandoffBoundary")}</span>
              </div>
            </div>
          )}
        </div>
        <footer className="affiliate-campaign-wizard-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (wizardStep === 1) setWizardOpen(false);
              else setWizardStep((step) => step - 1);
            }}
            disabled={writeCampaignState.loading}
          >
            {wizardStep === 1
              ? t("common.cancel")
              : t("ecommerce.affiliateCampaign.back")}
          </button>
          {wizardStep < 4 ? (
            <button type="button" className="btn btn-primary" onClick={nextStep}>
              {t("ecommerce.affiliateCampaign.continue")} <ChevronRightIcon />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void createCampaign()}
              disabled={writeCampaignState.loading}
            >
              {writeCampaignState.loading
                ? t("ecommerce.affiliateCampaign.activating")
                : t(
                    editingCampaignId
                      ? "ecommerce.affiliateCampaign.saveChanges"
                      : "ecommerce.affiliateCampaign.confirmAndActivate",
                  )}
            </button>
          )}
        </footer>
      </Modal>
    </div>
  );
});

function CampaignMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="affiliate-campaign-command-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function CampaignFunnel({
  counters,
  t,
}: {
  counters?: GQL.AffiliateCampaignExecutionCounters;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const steps = [
    ["scanned", counters?.scanned ?? 0],
    ["evaluated", counters?.evaluated ?? 0],
    ["qualified", counters?.qualified ?? 0],
    ["selected", counters?.selected ?? 0],
    ["sent", counters?.sent ?? 0],
    ["replied", counters?.replied ?? 0],
  ] as const;
  const maximum = Math.max(1, ...steps.map(([, value]) => value));
  return (
    <section className="affiliate-campaign-funnel">
      <div className="affiliate-campaign-section-heading">
        <div>
          <span>{t("ecommerce.affiliateCampaign.todayFunnel")}</span>
          <h3>{t("ecommerce.affiliateCampaign.discoveryToReply")}</h3>
        </div>
      </div>
      <div className="affiliate-campaign-funnel-bars">
        {steps.map(([key, value]) => (
          <div key={key}>
            <span>{t(`ecommerce.affiliateCampaign.funnel.${key}`)}</span>
            <strong>{formatNumber(value)}</strong>
            <i><b style={{ width: `${Math.max(value > 0 ? 3 : 0, (value / maximum) * 100)}%` }} /></i>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampaignWizardSteps({
  step,
  t,
}: {
  step: number;
  t: (key: string) => string;
}) {
  const labels = [
    t("ecommerce.affiliateCampaign.wizardShop"),
    t("ecommerce.affiliateCampaign.wizardTarget"),
    t("ecommerce.affiliateCampaign.wizardMessage"),
    t("ecommerce.affiliateCampaign.wizardConfirm"),
  ];
  return (
    <div className="affiliate-campaign-wizard-steps">
      {labels.map((label, index) => {
        const number = index + 1;
        return (
          <div key={label} data-active={number === step || undefined} data-complete={number < step || undefined}>
            <span>{number < step ? <CheckIcon size={15} /> : number}</span>
            <strong>{label}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmationItem({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function campaignStatusLabel(
  status: GQL.AffiliateCampaignStatus,
  t: (key: string) => string,
) {
  return t(`ecommerce.affiliateCampaign.status.${status.toLowerCase()}`);
}

function campaignStateLabel(
  status: string,
  t: (key: string) => string,
) {
  return t(`ecommerce.affiliateCampaign.creatorState.${status.toLowerCase()}`);
}

function executionStatusLabel(
  status: GQL.AffiliateCampaignDailyExecutionStatus,
  t: (key: string) => string,
) {
  return t(`ecommerce.affiliateCampaign.executionStatus.${status.toLowerCase()}`);
}

export function estimateCampaignCadence(target: number, submitted: number) {
  const remaining = Math.max(1, target - submitted);
  const minutes = Math.max(1, Math.round((14 * 60) / remaining));
  return `≈ ${minutes} min`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatOptionalNumber(value?: number | null) {
  return value == null ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatScore(value?: number | null) {
  return value == null ? "—" : value.toFixed(6);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

export function renderAffiliateCampaignTemplatePreview(
  template: string,
  productName: string,
  shopName: string,
) {
  return template
    .replaceAll("{{creator_name}}", "Alex")
    .replaceAll("{{product_name}}", productName)
    .replaceAll("{{shop_name}}", shopName);
}
