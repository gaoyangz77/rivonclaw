import { useEffect, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
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
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import {
  generateAffiliateCampaignMessageTemplate,
  generateAffiliateCampaignSearchPhrases,
} from "../../api/affiliate-campaign-ai.js";
import {
  AFFILIATE_CAMPAIGNS_QUERY,
  AFFILIATE_CAMPAIGN_SELECTION_READINESS_QUERY,
  AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY,
  AFFILIATE_CAMPAIGN_EXECUTIONS_QUERY,
  AFFILIATE_CAMPAIGN_SUMMARY_QUERY,
  AFFILIATE_MARKETPLACE_RULE_CAPABILITIES_QUERY,
  DELETE_AFFILIATE_CAMPAIGN_DRAFT_MUTATION,
  DUPLICATE_AFFILIATE_CAMPAIGN_MUTATION,
  AFFILIATE_CAMPAIGN_PRODUCT_PREVIEW_QUERY,
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
  maximumFollowers: string;
  minimumExpectedSales: string;
  commissionRate: string;
  refreshProductSnapshot: boolean;
  searchPhrases: Array<{
    text: string;
    source: GQL.AffiliateCampaignSearchPhraseSource;
    explanation: string;
    explanationLocale: string;
    suggestionVersion: number | null;
    discoveryRules: GQL.AffiliateCampaignDiscoveryRulesInput;
  }>;
  strategy: GQL.AffiliateCampaignSelectionStrategy;
  ageRanges: GQL.CreatorSearchFollowerAgeRange[];
  audienceGender: GQL.CreatorSearchFollowerGender | "";
  audienceGenderMinimum: string;
  gmvRanges: GQL.AffiliateMarketplaceGmvRange[];
  unitsSoldRanges: GQL.AffiliateMarketplaceUnitsSoldRange[];
  languages: string[];
  creatorLevels: string[];
  categoryPros: string[];
  categoryIds: string;
  averageVideoViews: string;
  averageShoppableVideoViews: string;
  averageEngagementRate: string;
  averageShoppableEngagementRate: string;
  averageLiveViewers: string;
  averageShoppableLiveViewers: string;
  averageCommissionRate: string;
  postRate: string;
  creatorAgencyStatus: string;
  fastGrowingOnly: boolean;
  notInvitedLast90Days: boolean;
  templateText: string;
  templateGuidance: string;
  templateSource: GQL.AffiliateCampaignMessageTemplateSource;
  messageProductName: string;
};

const emptyForm: CampaignForm = {
  shopId: "",
  productId: "",
  name: "",
  dailyTarget: "100",
  minimumFollowers: "1000",
  maximumFollowers: "",
  minimumExpectedSales: "",
  commissionRate: "10",
  refreshProductSnapshot: false,
  searchPhrases: [
    {
      text: "",
      source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
      explanation: "",
      explanationLocale: "",
      suggestionVersion: null,
      discoveryRules: createDefaultDiscoveryRules(),
    },
  ],
  strategy: GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules,
  ageRanges: [],
  audienceGender: "",
  audienceGenderMinimum: "",
  gmvRanges: [],
  unitsSoldRanges: [],
  languages: [],
  creatorLevels: [],
  categoryPros: [],
  categoryIds: "",
  averageVideoViews: "",
  averageShoppableVideoViews: "",
  averageEngagementRate: "",
  averageShoppableEngagementRate: "",
  averageLiveViewers: "",
  averageShoppableLiveViewers: "",
  averageCommissionRate: "",
  postRate: "",
  creatorAgencyStatus: "",
  fastGrowingOnly: false,
  notInvitedLast90Days: false,
  templateText: "",
  templateGuidance: "",
  templateSource: GQL.AffiliateCampaignMessageTemplateSource.UserAuthored,
  messageProductName: "",
};

const stateStatusOptions = Object.values(GQL.AffiliateCampaignCreatorStateStatus);
const eligibilityCategoryOptions = Object.values(GQL.AffiliateCampaignEligibilityCategory);
const eligibilityReasonOptions = [
  "PROTECTION_LIST",
  "SAME_PRODUCT_ALREADY_CONTACTED",
  "SAME_PRODUCT_RESERVED_OR_SUBMITTED",
  "SHOP_CREATOR_7D_LIMIT",
  "SHOP_CREATOR_30D_LIMIT",
  "CAMPAIGN_ALREADY_CONTACTED",
  "PROVIDER_RESULT_INVALID",
  "FOLLOWER_DATA_REQUIRED",
  "EXPECTED_SALES_BELOW_THRESHOLD",
] as const;

type CampaignProductPreview =
  | GQL.AffiliateCampaignProductPreview
  | GQL.AffiliateCampaignProductSnapshot;

type CampaignCreatorProfile = Pick<
  GQL.AffiliateCreatorIdentity,
  | "id"
  | "platform"
  | "creatorOpenId"
  | "username"
  | "nickname"
  | "avatarUrl"
  | "bioDescription"
  | "lastObservedAt"
>;

type CampaignCreatorPerformance = Pick<
  GQL.AffiliateCreatorPerformanceCurrent,
  "market" | "observedAt" | "sourceType" | "followerCount" | "categoryIds"
>;

type CampaignCreatorRelationship = Pick<
  GQL.AffiliateCreatorRelationship,
  | "id"
  | "shopStates"
  | "lastInboundAt"
  | "lastOutboundAt"
  | "activeAffiliateCollaborationIds"
  | "blocked"
  | "workSummary"
>;

type CampaignCreatorState = GQL.AffiliateCampaignCreatorState & {
  creatorProfile?: CampaignCreatorProfile | null;
  creatorPerformance?: CampaignCreatorPerformance | null;
  creatorRelationship?: CampaignCreatorRelationship | null;
};

type CampaignCreatorStatePage = {
  items: CampaignCreatorState[];
  nextCursor?: string | null;
};

const CAMPAIGNS_PER_PAGE = 20;
const CAMPAIGN_STATUS_FILTER_OPTIONS: GQL.AffiliateCampaignStatus[] = [
  GQL.AffiliateCampaignStatus.Active,
  GQL.AffiliateCampaignStatus.Paused,
  GQL.AffiliateCampaignStatus.Draft,
  GQL.AffiliateCampaignStatus.Completed,
  GQL.AffiliateCampaignStatus.Archived,
];
export const DEFAULT_CAMPAIGN_STATUS_FILTERS: GQL.AffiliateCampaignStatus[] = [
  GQL.AffiliateCampaignStatus.Active,
  GQL.AffiliateCampaignStatus.Paused,
  GQL.AffiliateCampaignStatus.Draft,
];

export function paginateCampaigns<T>(
  items: readonly T[],
  page: number,
  pageSize = CAMPAIGNS_PER_PAGE,
): T[] {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const safePage = Math.max(1, Math.trunc(page));
  const start = (safePage - 1) * safePageSize;
  return items.slice(start, start + safePageSize);
}

export const AffiliateCampaignPage = observer(function AffiliateCampaignPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [editingCampaignId, setEditingCampaignId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignStatusFilters, setCampaignStatusFilters] = useState<GQL.AffiliateCampaignStatus[]>(
    () => [...DEFAULT_CAMPAIGN_STATUS_FILTERS],
  );
  const [stateStatuses, setStateStatuses] = useState<GQL.AffiliateCampaignCreatorStateStatus[]>([]);
  const [eligibilityCategories, setEligibilityCategories] = useState<
    GQL.AffiliateCampaignEligibilityCategory[]
  >([]);
  const [eligibilityReasons, setEligibilityReasons] = useState<string[]>([]);
  const [generatingSearchGroups, setGeneratingSearchGroups] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [productPreview, setProductPreview] = useState<CampaignProductPreview | null>(
    null,
  );
  const [pendingProductResolution, setPendingProductResolution] =
    useState<CampaignProductPreview | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { kind: "resuggest"; existingPhrases: string[] }
    | { kind: "delete-draft"; campaignId: string; campaignName: string }
    | { kind: "archive"; campaignId: string; campaignName: string }
    | null
  >(null);

  const campaignsQuery = useQuery<{ affiliateCampaigns: GQL.AffiliateCampaign[] }>(
    AFFILIATE_CAMPAIGNS_QUERY,
    {
      variables: {
        input: {
          limit: 500,
          statuses: campaignStatusFilters,
        },
      },
      fetchPolicy: "cache-and-network",
    },
  );
  const campaignPortfolioQuery = useQuery<{ affiliateCampaigns: GQL.AffiliateCampaign[] }>(
    AFFILIATE_CAMPAIGNS_QUERY,
    {
      variables: { input: { limit: 500 } },
      fetchPolicy: "cache-and-network",
    },
  );
  const shopsQuery = useQuery<{ shops: GQL.Shop[] }>(SHOPS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const capabilitiesQuery = useQuery<{
    affiliateMarketplaceCreatorRuleCapabilities: GQL.AffiliateMarketplaceCreatorRuleCapabilities;
  }>(AFFILIATE_MARKETPLACE_RULE_CAPABILITIES_QUERY, {
    variables: { shopId: form.shopId },
    skip: !form.shopId,
    fetchPolicy: "cache-and-network",
  });
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
    affiliateCampaignCreatorStates: CampaignCreatorStatePage;
  }>(AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY, {
    variables: {
      input: {
        campaignId: selectedCampaignId,
        limit: 50,
        ...(stateStatuses.length ? { statuses: stateStatuses } : {}),
        ...(eligibilityCategories.length ? { eligibilityCategories } : {}),
        ...(eligibilityReasons.length ? { reasonCodes: eligibilityReasons } : {}),
      },
    },
    skip: !selectedCampaignId,
  });
  const selectionReadinessQuery = useQuery<{
    affiliateCampaignSelectionReadiness: GQL.AffiliateCampaignSelectionReadiness;
  }>(AFFILIATE_CAMPAIGN_SELECTION_READINESS_QUERY, {
    variables: { campaignId: selectedCampaignId },
    skip: !selectedCampaignId,
  });
  const creatorStatesViewState = campaignCreatorStatesViewState({
    loading: creatorStatesQuery.loading,
    hasError: Boolean(creatorStatesQuery.error),
    itemCount:
      creatorStatesQuery.data?.affiliateCampaignCreatorStates.items.length ?? 0,
  });

  const [writeCampaign, writeCampaignState] = useMutation<
    { writeAffiliateCampaign: GQL.AffiliateCampaign },
    { input: GQL.WriteAffiliateCampaignInput }
  >(WRITE_AFFILIATE_CAMPAIGN_MUTATION);
  const [setCampaignStatus, statusMutationState] = useMutation<
    { setAffiliateCampaignStatus: GQL.AffiliateCampaign },
    { input: GQL.SetAffiliateCampaignStatusInput }
  >(SET_AFFILIATE_CAMPAIGN_STATUS_MUTATION);
  const [resolveProduct, resolveProductState] = useLazyQuery<
    { affiliateCampaignProductPreview: GQL.AffiliateCampaignProductPreview },
    { input: GQL.ResolveAffiliateCampaignProductInput }
  >(AFFILIATE_CAMPAIGN_PRODUCT_PREVIEW_QUERY);
  const [duplicateCampaign, duplicateCampaignState] = useMutation<
    { duplicateAffiliateCampaign: GQL.AffiliateCampaign },
    { input: GQL.DuplicateAffiliateCampaignInput }
  >(DUPLICATE_AFFILIATE_CAMPAIGN_MUTATION);
  const [deleteDraft, deleteDraftState] = useMutation<
    { deleteAffiliateCampaignDraft: boolean },
    { input: GQL.DeleteAffiliateCampaignDraftInput }
  >(DELETE_AFFILIATE_CAMPAIGN_DRAFT_MUTATION);

  const campaigns = campaignsQuery.data?.affiliateCampaigns ?? [];
  const campaignPortfolio = campaignPortfolioQuery.data?.affiliateCampaigns ?? [];
  const campaignPageCount = Math.max(1, Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE));
  const campaignPageStart = (campaignPage - 1) * CAMPAIGNS_PER_PAGE;
  const visibleCampaigns = paginateCampaigns(campaigns, campaignPage);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const editingCampaign = campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null;
  const summary = summaryQuery.data?.affiliateCampaignSummary;
  const latestExecution = summary?.latestExecution;
  const shops = (shopsQuery.data?.shops ?? []).filter(
    (shop) =>
      shop.platform === GQL.ShopPlatform.TiktokShop &&
      shop.authStatus === GQL.ShopAuthStatus.Authorized &&
      shop.services?.affiliateService?.enabled === true,
  );
  const selectedShop = shops.find((shop) => shop.id === form.shopId);
  const capabilities = capabilitiesQuery.data?.affiliateMarketplaceCreatorRuleCapabilities;
  const selectionReadiness = selectionReadinessQuery.data?.affiliateCampaignSelectionReadiness;

  useEffect(() => {
    setCampaignPage(1);
  }, [campaignStatusFilters]);

  const toggleCampaignStatusFilter = (status: GQL.AffiliateCampaignStatus) => {
    setCampaignStatusFilters((current) => {
      if (current.includes(status)) {
        return current.length === 1
          ? current
          : current.filter((selectedStatus) => selectedStatus !== status);
      }
      const next = new Set([...current, status]);
      return CAMPAIGN_STATUS_FILTER_OPTIONS.filter((option) => next.has(option));
    });
  };

  useEffect(() => {
    if (
      selectedCampaignId &&
      campaigns.length > 0 &&
      !campaigns.some((campaign) => campaign.id === selectedCampaignId)
    ) {
      setSelectedCampaignId("");
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    setStateStatuses([]);
    setEligibilityCategories([]);
    setEligibilityReasons([]);
  }, [selectedCampaignId]);

  useEffect(() => {
    setCampaignPage((currentPage) => Math.min(currentPage, campaignPageCount));
  }, [campaignPageCount]);

  const shopOptions = shops.map((shop) => ({
    value: shop.id,
    label: shop.shopName,
    description: `${shop.region ?? "—"} · ${shop.timezone}`,
  }));
  const openCreate = () => {
    setForm(emptyForm);
    setProductPreview(null);
    setPendingProductResolution(null);
    setEditingCampaignId("");
    setWizardStep(1);
    setWizardOpen(true);
  };

  const openEdit = (campaign: GQL.AffiliateCampaign) => {
    const rules = campaign.discoveryRules;
    setForm({
      shopId: campaign.shopId,
      productId: campaign.primaryProductId,
      name: campaign.name,
      dailyTarget: String(campaign.dailyOutreachTarget),
      minimumFollowers:
        rules.followerCount?.minimum == null ? "" : String(rules.followerCount.minimum),
      maximumFollowers:
        rules.followerCount?.maximum == null ? "" : String(rules.followerCount.maximum),
      minimumExpectedSales:
        campaign.selectionPolicy.minimumExpectedSalesUnits == null
          ? ""
          : String(campaign.selectionPolicy.minimumExpectedSalesUnits),
      commissionRate: String(campaignCommissionRate(campaign)),
      refreshProductSnapshot: false,
      searchPhrases: campaign.searchPhrases.length
        ? campaign.searchPhrases.map((phrase) => ({
            text: phrase.text,
            source: phrase.source,
            explanation: phrase.explanation ?? "",
            explanationLocale: phrase.explanationLocale ?? "",
            suggestionVersion: phrase.suggestionVersion ?? null,
            discoveryRules: normalizeDiscoveryRules(
              phrase.discoveryRules ?? campaign.discoveryRules,
            ),
          }))
        : [
            {
              text: "",
              source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
              explanation: "",
              explanationLocale: "",
              suggestionVersion: null,
              discoveryRules: normalizeDiscoveryRules(campaign.discoveryRules),
            },
          ],
      strategy: campaign.selectionPolicy.strategy,
      ageRanges: rules.audience?.ageRanges ?? [],
      audienceGender: rules.audience?.genderDistribution?.gender ?? "",
      audienceGenderMinimum:
        rules.audience?.genderDistribution?.minimumPercentage == null
          ? ""
          : String(rules.audience.genderDistribution.minimumPercentage),
      gmvRanges: rules.salesPerformance30d?.gmvRanges ?? [],
      unitsSoldRanges: rules.salesPerformance30d?.unitsSoldRanges ?? [],
      languages: rules.marketSpecific?.languages ?? [],
      creatorLevels: rules.marketSpecific?.creatorLevels ?? [],
      categoryPros: rules.marketSpecific?.categoryPros ?? [],
      categoryIds: (rules.categories ?? []).map((category) => category.parentCategoryId).join(", "),
      averageVideoViews: rules.contentPerformance30d?.averageVideoViews ?? "",
      averageShoppableVideoViews: rules.contentPerformance30d?.averageShoppableVideoViews ?? "",
      averageEngagementRate: rules.contentPerformance30d?.averageEngagementRate ?? "",
      averageShoppableEngagementRate:
        rules.contentPerformance30d?.averageShoppableEngagementRate ?? "",
      averageLiveViewers: rules.contentPerformance30d?.averageLiveViewers ?? "",
      averageShoppableLiveViewers: rules.contentPerformance30d?.averageShoppableLiveViewers ?? "",
      averageCommissionRate: rules.affiliatePerformance30d?.averageCommissionRate ?? "",
      postRate: rules.affiliatePerformance30d?.postRate ?? "",
      creatorAgencyStatus: rules.affiliatePerformance30d?.creatorAgencyStatus ?? "",
      fastGrowingOnly: rules.affiliatePerformance30d?.fastGrowingOnly ?? false,
      notInvitedLast90Days: rules.affiliatePerformance30d?.notInvitedLast90Days ?? false,
      templateText: campaign.messageTemplateText,
      templateGuidance: "",
      templateSource: campaign.messageTemplateSource,
      messageProductName:
        campaign.messageProductName || campaign.productSnapshot?.title || campaign.primaryProductId,
    });
    setEditingCampaignId(campaign.id);
    setProductPreview(campaign.productSnapshot ?? null);
    setPendingProductResolution(null);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const updateForm = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validateStep = () => {
    if (
      wizardStep === 1 &&
      (!form.shopId ||
        !form.productId ||
        !form.name.trim() ||
        productPreview?.productId !== form.productId)
    ) {
      showToast(t("ecommerce.affiliateCampaign.completeShopProduct"), "error");
      return false;
    }
    if (
      wizardStep === 2 &&
      (Number(form.dailyTarget) < 1 ||
        form.searchPhrases.some((phrase) => {
          const minimum = phrase.discoveryRules.followerCount?.minimum;
          const maximum = phrase.discoveryRules.followerCount?.maximum;
          return (
            (minimum != null && minimum < 0) ||
            (maximum != null && maximum < 0) ||
            (minimum != null && maximum != null && minimum > maximum)
          );
        }) ||
        Number(form.commissionRate) < 0 ||
        Number(form.commissionRate) > 100 ||
        (form.minimumExpectedSales && Number(form.minimumExpectedSales) < 0))
    ) {
      showToast(t("ecommerce.affiliateCampaign.invalidTargets"), "error");
      return false;
    }
    if (wizardStep === 3 && !form.templateText.trim()) {
      showToast(t("ecommerce.affiliateCampaign.templateRequired"), "error");
      return false;
    }
    if (
      wizardStep === 2 &&
      (form.searchPhrases.length < 1 ||
        form.searchPhrases.length > 5 ||
        form.searchPhrases.some((phrase) => {
          const text = phrase.text.normalize("NFKC").trim().replace(/\s+/gu, " ");
          return !isEnglishCampaignSearchPhrase(text);
        }) ||
        new Set(
          form.searchPhrases.map((phrase) =>
            phrase.text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(),
          ),
        ).size !== form.searchPhrases.length)
    ) {
      showToast(t("ecommerce.affiliateCampaign.invalidSearchPhrases"), "error");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setWizardStep((step) => Math.min(4, step + 1));
  };

  const fetchProduct = async () => {
    if (!form.shopId || !form.productId.trim()) {
      showToast(t("ecommerce.affiliateCampaign.completeShopProduct"), "error");
      return;
    }
    try {
      const result = await resolveProduct({
        variables: {
          input: { shopId: form.shopId, productId: form.productId.trim() },
        },
      });
      const preview = result.data?.affiliateCampaignProductPreview;
      if (!preview) throw new Error(t("ecommerce.affiliateCampaign.productFetchFailed"));
      if (
        productPreview &&
        productPreview.snapshotHash !== preview.snapshotHash
      ) {
        setPendingProductResolution(preview);
        return;
      }
      applyProductResolution(preview);
      showToast(t("ecommerce.affiliateCampaign.productFetched"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const applyProductResolution = (preview: CampaignProductPreview) => {
    setForm((current) => ({
      ...current,
      productId: preview.productId,
      refreshProductSnapshot: true,
      searchPhrases: [
        {
          text: "",
          source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
          explanation: "",
          explanationLocale: "",
          suggestionVersion: null,
          discoveryRules: createDefaultDiscoveryRules(),
        },
      ],
      messageProductName: "",
    }));
    setProductPreview(preview);
    setPendingProductResolution(null);
  };

  const requestKeywordSuggestions = async (existingPhrases: string[]) => {
    if (!productPreview) return;
    setGeneratingSearchGroups(true);
    try {
      const payload = await generateAffiliateCampaignSearchPhrases({
        shopId: form.shopId,
        productId: form.productId,
        uiLocale: i18n.resolvedLanguage ?? i18n.language,
        excludePhrases: existingPhrases,
      });
      setForm((current) => ({
        ...current,
        searchPhrases: payload.suggestions.map((suggestion) => ({
          text: suggestion.text,
          source: GQL.AffiliateCampaignSearchPhraseSource.AiSuggested,
          explanation: suggestion.explanation,
          explanationLocale: suggestion.explanationLocale,
          suggestionVersion: payload.suggestionVersion,
          discoveryRules: normalizeSuggestedDiscoveryRules(suggestion.discoveryRules),
        })),
      }));
      showToast(t("ecommerce.affiliateCampaign.keywordSuggestionsReady"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    } finally {
      setGeneratingSearchGroups(false);
    }
  };

  const generateKeywordSuggestions = () => {
    if (!productPreview) return;
    const existingPhrases = form.searchPhrases.map((phrase) => phrase.text.trim()).filter(Boolean);
    if (existingPhrases.length > 0) {
      setConfirmation({ kind: "resuggest", existingPhrases });
      return;
    }
    void requestKeywordSuggestions([]);
  };

  const createCampaign = async () => {
    if (!validateStep()) return;
    if (!productPreview) return;
    try {
      const campaignInput = {
        ...(editingCampaignId ? { id: editingCampaignId } : {}),
        shopId: form.shopId,
        name: form.name.trim(),
        primaryProductId: form.productId,
        refreshProductSnapshot: form.refreshProductSnapshot,
        searchPhrases: form.searchPhrases.map((phrase) => ({
          text: phrase.text,
          source: phrase.source,
          explanation: phrase.explanation || null,
          explanationLocale: phrase.explanationLocale || null,
          suggestionVersion: phrase.suggestionVersion,
          discoveryRules: phrase.discoveryRules,
        })),
        dailyOutreachTarget: Number(form.dailyTarget),
        commissionRatePercent: Number(form.commissionRate),
        discoveryRules: form.searchPhrases[0]?.discoveryRules ?? createDefaultDiscoveryRules(),
        selectionPolicy: {
          strategy: form.strategy,
          ranking:
            form.strategy === GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules
              ? GQL.AffiliateCampaignSelectionRanking.ProviderOrder
              : GQL.AffiliateCampaignSelectionRanking.ExpectedSalesPerFollower,
          minimumExpectedSalesUnits:
            form.strategy === GQL.AffiliateCampaignSelectionStrategy.ExpectedSales &&
            form.minimumExpectedSales
              ? Number(form.minimumExpectedSales)
              : null,
        },
        messageTemplateText: form.templateText.trim(),
        messageTemplateSource: form.templateSource,
        messageProductName: form.messageProductName.trim() || productPreview.title,
        status: GQL.AffiliateCampaignStatus.Active,
      } as unknown as GQL.WriteAffiliateCampaignInput;
      const result = await writeCampaign({
        variables: {
          input: campaignInput,
        },
      });
      const created = result.data?.writeAffiliateCampaign;
      if (!created) throw new Error(t("ecommerce.affiliateCampaign.createFailed"));
      setWizardOpen(false);
      setSelectedCampaignId(created.id);
      await Promise.all([campaignsQuery.refetch(), campaignPortfolioQuery.refetch()]);
      showToast(
        t(
          editingCampaignId
            ? "ecommerce.affiliateCampaign.updated"
            : "ecommerce.affiliateCampaign.created",
        ),
        "success",
      );
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const generateMessage = async () => {
    if (!productPreview) return;
    setGeneratingTemplate(true);
    try {
      const suggestion = await generateAffiliateCampaignMessageTemplate({
        shopId: form.shopId,
        productId: form.productId,
        uiLocale: i18n.resolvedLanguage ?? i18n.language,
        guidance: form.templateGuidance.trim() || undefined,
        mode: form.templateText.trim()
          ? GQL.AffiliateCampaignTemplateGenerationMode.Alternative
          : GQL.AffiliateCampaignTemplateGenerationMode.Initial,
        previousDraft: form.templateText.trim() || undefined,
      });
      setForm((current) => ({
        ...current,
        templateText: suggestion.text,
        messageProductName: suggestion.productShortName,
        templateSource: GQL.AffiliateCampaignMessageTemplateSource.AiGenerated,
      }));
      showToast(t("ecommerce.affiliateCampaign.templateReady"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    } finally {
      setGeneratingTemplate(false);
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
      await Promise.all([
        campaignsQuery.refetch(),
        campaignPortfolioQuery.refetch(),
        summaryQuery.refetch(),
      ]);
      showToast(
        t(
          nextStatus === GQL.AffiliateCampaignStatus.Active
            ? "ecommerce.affiliateCampaign.resumed"
            : "ecommerce.affiliateCampaign.paused",
        ),
        "success",
      );
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const archiveCampaign = (campaign: GQL.AffiliateCampaign) => {
    setConfirmation({
      kind: "archive",
      campaignId: campaign.id,
      campaignName: campaign.name,
    });
  };

  const executeArchiveCampaign = async (campaignId: string) => {
    try {
      await setCampaignStatus({
        variables: {
          input: {
            campaignId,
            status: GQL.AffiliateCampaignStatus.Archived,
          },
        },
      });
      setSelectedCampaignId("");
      await Promise.all([campaignsQuery.refetch(), campaignPortfolioQuery.refetch()]);
      showToast(t("ecommerce.affiliateCampaign.archivedToast"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const copyCampaign = async (campaign: GQL.AffiliateCampaign) => {
    try {
      const result = await duplicateCampaign({
        variables: {
          input: {
            campaignId: campaign.id,
            name: t("ecommerce.affiliateCampaign.copyName", { name: campaign.name }),
          },
        },
      });
      const copy = result.data?.duplicateAffiliateCampaign;
      if (!copy) throw new Error(t("ecommerce.affiliateCampaign.copyFailed"));
      await Promise.all([campaignsQuery.refetch(), campaignPortfolioQuery.refetch()]);
      setSelectedCampaignId("");
      openEdit(copy);
      showToast(t("ecommerce.affiliateCampaign.copiedAsDraft"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const deleteDraftCampaign = (campaign: GQL.AffiliateCampaign) => {
    setConfirmation({
      kind: "delete-draft",
      campaignId: campaign.id,
      campaignName: campaign.name,
    });
  };

  const executeDeleteDraftCampaign = async (campaignId: string) => {
    try {
      const result = await deleteDraft({
        variables: { input: { campaignId } },
      });
      if (!result.data?.deleteAffiliateCampaignDraft) {
        throw new Error("CAMPAIGN_DRAFT_DELETE_FAILED");
      }
      setSelectedCampaignId("");
      await Promise.all([campaignsQuery.refetch(), campaignPortfolioQuery.refetch()]);
      showToast(t("ecommerce.affiliateCampaign.draftDeleted"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const confirmPendingAction = () => {
    const pending = confirmation;
    setConfirmation(null);
    if (!pending) return;
    if (pending.kind === "resuggest") {
      void requestKeywordSuggestions(pending.existingPhrases);
      return;
    }
    if (pending.kind === "archive") {
      void executeArchiveCampaign(pending.campaignId);
      return;
    }
    void executeDeleteDraftCampaign(pending.campaignId);
  };

  const activeCount = campaignPortfolio.filter(
    (campaign) => campaign.status === GQL.AffiliateCampaignStatus.Active,
  ).length;
  const dailyTargetTotal = campaignPortfolio
    .filter((campaign) => campaign.status === GQL.AffiliateCampaignStatus.Active)
    .reduce((sum, campaign) => sum + campaign.dailyOutreachTarget, 0);

  const loadMoreCreatorStates = async () => {
    const nextCursor = creatorStatesQuery.data?.affiliateCampaignCreatorStates.nextCursor;
    if (!nextCursor) return;
    await creatorStatesQuery.fetchMore({
      variables: {
        input: {
          campaignId: selectedCampaignId,
          limit: 50,
          cursor: nextCursor,
          ...(stateStatuses.length ? { statuses: stateStatuses } : {}),
          ...(eligibilityCategories.length ? { eligibilityCategories } : {}),
          ...(eligibilityReasons.length ? { reasonCodes: eligibilityReasons } : {}),
        },
      },
      updateQuery: (previous, { fetchMoreResult }) => ({
        affiliateCampaignCreatorStates: {
          ...fetchMoreResult.affiliateCampaignCreatorStates,
          items: [
            ...previous.affiliateCampaignCreatorStates.items,
            ...fetchMoreResult.affiliateCampaignCreatorStates.items,
          ],
        },
      }),
    });
  };

  return (
    <div className="affiliate-campaign-page">
      <header className="affiliate-campaign-hero" data-tutorial-id="affiliate-campaign-header">
        <div className="affiliate-campaign-hero-copy">
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
            onClick={() =>
              void Promise.all([campaignsQuery.refetch(), campaignPortfolioQuery.refetch()])
            }
          >
            <RefreshIcon /> {t("common.refresh")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
            data-tutorial-id="affiliate-campaign-create"
          >
            <UserPlusIcon /> {t("ecommerce.affiliateCampaign.create")}
          </button>
        </div>
      </header>

      <section className="affiliate-campaign-command-strip" data-tutorial-id="affiliate-campaign-summary">
        <div className="affiliate-campaign-window">
          <div className="affiliate-campaign-window-copy">
            <span>{t("ecommerce.affiliateCampaign.sendingWindow")}</span>
            <small>{t("ecommerce.affiliateCampaign.localTime")}</small>
          </div>
          <div className="affiliate-campaign-window-range">
            <strong>08:00</strong>
            <div aria-hidden="true">
              <i />
              <i />
            </div>
            <strong>22:00</strong>
          </div>
        </div>
        <CampaignMetric
          label={t("ecommerce.affiliateCampaign.activeCampaigns")}
          value={activeCount}
          detail={t("ecommerce.affiliateCampaign.totalCampaigns", {
            count: campaignPortfolio.length,
          })}
        />
        <CampaignMetric
          label={t("ecommerce.affiliateCampaign.dailyTargetTotal")}
          value={dailyTargetTotal}
          detail={t("ecommerce.affiliateCampaign.acrossActiveCampaigns")}
        />
        <CampaignMetric
          label={t("ecommerce.affiliateCampaign.agentCost")}
          value="0"
          detail={t("ecommerce.affiliateCampaign.firstTouchNoAgent")}
        />
      </section>

      {campaignPortfolio.length === 0 && !campaignPortfolioQuery.loading ? (
        <section className="affiliate-campaign-empty" data-tutorial-id="affiliate-campaign-directory">
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
        <section className="affiliate-campaign-directory" data-tutorial-id="affiliate-campaign-directory">
          <header className="affiliate-campaign-directory-header">
            <div>
              <span>{t("ecommerce.affiliateCampaign.portfolio")}</span>
              <h2>{t("ecommerce.affiliateCampaign.campaignTableTitle")}</h2>
              <p>{t("ecommerce.affiliateCampaign.campaignTableDescription")}</p>
            </div>
            <div className="affiliate-campaign-directory-tools">
              <fieldset
                className="affiliate-campaign-directory-status-filter"
                aria-label={t("ecommerce.affiliateCampaign.statusFilter")}
              >
                <legend>{t("ecommerce.affiliateCampaign.statusFilter")}</legend>
                <div className="affiliate-campaign-status-options">
                  {CAMPAIGN_STATUS_FILTER_OPTIONS.map((status) => {
                    const checked = campaignStatusFilters.includes(status);
                    return (
                      <label
                        key={status}
                        className={`affiliate-campaign-status-option${checked ? " affiliate-campaign-status-option-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCampaignStatusFilter(status)}
                        />
                        <span>{campaignStatusLabel(status, t)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="affiliate-campaign-directory-count">
                <strong>{formatNumber(campaigns.length)}</strong>
                <span>{t("ecommerce.affiliateCampaign.campaignCountLabel")}</span>
              </div>
            </div>
          </header>
          <div className="affiliate-campaign-directory-table-wrap">
            <table className="affiliate-campaign-directory-table">
              <colgroup>
                <col className="affiliate-campaign-col-name" />
                <col className="affiliate-campaign-col-shop" />
                <col className="affiliate-campaign-col-status" />
                <col className="affiliate-campaign-col-target" />
                <col className="affiliate-campaign-col-boundary" />
                <col className="affiliate-campaign-col-product" />
                <col className="affiliate-campaign-col-open" />
              </colgroup>
              <thead>
                <tr>
                  <th>{t("ecommerce.affiliateCampaign.campaign")}</th>
                  <th>{t("ecommerce.affiliateCampaign.shopAndMarket")}</th>
                  <th>{t("ecommerce.affiliateCampaign.statusLabel")}</th>
                  <th>{t("ecommerce.affiliateCampaign.dailyTarget")}</th>
                  <th>{t("ecommerce.affiliateCampaign.selectionBoundary")}</th>
                  <th>{t("ecommerce.affiliateCampaign.product")}</th>
                  <th aria-label={t("ecommerce.affiliateCampaign.openDetail")} />
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.length === 0 && (
                  <tr className="affiliate-campaign-directory-empty-row">
                    <td colSpan={7}>{t("ecommerce.affiliateCampaign.noCampaignsForStatus")}</td>
                  </tr>
                )}
                {visibleCampaigns.map((campaign) => {
                  const campaignShop = shops.find((shop) => shop.id === campaign.shopId);
                  return (
                    <tr
                      key={campaign.id}
                      tabIndex={0}
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCampaignId(campaign.id);
                        }
                      }}
                    >
                      <td>
                        <div className="affiliate-campaign-directory-name">
                          <span
                            className={`affiliate-campaign-status-dot is-${campaign.status.toLowerCase()}`}
                          />
                          <div>
                            <strong>{campaign.name}</strong>
                            <small>
                              {t("ecommerce.affiliateCampaign.templateVersion", {
                                version: campaign.templateVersion,
                              })}{" "}
                              · {formatDateTime(campaign.updatedAt)}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="affiliate-campaign-directory-shop">
                          <strong>{campaignShopDisplayName(campaignShop, campaign.shopId)}</strong>
                          <small>{campaign.market}</small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`affiliate-campaign-status is-${campaign.status.toLowerCase()}`}
                        >
                          {campaignStatusLabel(campaign.status, t)}
                        </span>
                      </td>
                      <td>
                        <strong>{formatNumber(campaign.dailyOutreachTarget)}</strong>
                        <small>{t("ecommerce.affiliateCampaign.messagesPerDayShort")}</small>
                      </td>
                      <td>
                        <strong>
                          {campaignStrategyLabel(campaign.selectionPolicy.strategy, t)}
                        </strong>
                        <small>{campaignRuleSummary(campaign, t)}</small>
                      </td>
                      <td>
                        <div className="affiliate-campaign-directory-product">
                          <strong title={campaign.productSnapshot?.title ?? undefined}>
                            {campaign.productSnapshot?.title?.trim() || campaign.primaryProductId}
                          </strong>
                          <small title={campaignProductReference(campaign, t)}>
                            {campaignProductReference(campaign, t)}
                          </small>
                        </div>
                      </td>
                      <td>
                        <ChevronRightIcon />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="affiliate-campaign-directory-pagination">
            <span>
              {t("ecommerce.affiliateCampaign.paginationSummary", {
                from: campaigns.length === 0 ? 0 : campaignPageStart + 1,
                to: Math.min(campaignPageStart + CAMPAIGNS_PER_PAGE, campaigns.length),
                total: campaigns.length,
              })}
            </span>
            <div>
              <button
                type="button"
                className="affiliate-campaign-page-button is-direction"
                aria-label={t("ecommerce.affiliateCampaign.previousPage")}
                disabled={campaignPage <= 1}
                onClick={() => setCampaignPage((page) => Math.max(1, page - 1))}
              >
                <ChevronRightIcon />
              </button>
              <span>
                {t("ecommerce.affiliateCampaign.pageOf", {
                  page: campaignPage,
                  total: campaignPageCount,
                })}
              </span>
              <button
                type="button"
                className="affiliate-campaign-page-button is-direction"
                aria-label={t("ecommerce.affiliateCampaign.nextPage")}
                disabled={campaignPage >= campaignPageCount}
                onClick={() => setCampaignPage((page) => Math.min(campaignPageCount, page + 1))}
              >
                <ChevronRightIcon />
              </button>
            </div>
          </footer>
        </section>
      )}

      <Modal
        isOpen={Boolean(selectedCampaign)}
        onClose={() => setSelectedCampaignId("")}
        title={selectedCampaign?.name ?? t("ecommerce.affiliateCampaign.detailTitle")}
        maxWidth={1480}
        portal
        className="affiliate-campaign-detail-modal"
      >
        {selectedCampaign && (
          <div className="affiliate-campaign-detail-modal-body">
            <header className="affiliate-campaign-detail-header">
              <div>
                <div className="affiliate-campaign-title-line">
                  <span
                    className={`affiliate-campaign-status is-${selectedCampaign.status.toLowerCase()}`}
                  >
                    {campaignStatusLabel(selectedCampaign.status, t)}
                  </span>
                  <span>
                    {selectedCampaign.market} · {selectedCampaign.resolvedTimeZone}
                  </span>
                  <span>
                    {t("ecommerce.affiliateCampaign.templateVersion", {
                      version: selectedCampaign.templateVersion,
                    })}
                  </span>
                </div>
                <p>{t("ecommerce.affiliateCampaign.detailDescription")}</p>
              </div>
              <div className="affiliate-campaign-detail-actions">
                {!isTerminalCampaignStatus(selectedCampaign.status) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => openEdit(selectedCampaign)}
                  >
                    {t("ecommerce.affiliateCampaign.edit")}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={duplicateCampaignState.loading}
                  onClick={() => void copyCampaign(selectedCampaign)}
                >
                  {t("ecommerce.affiliateCampaign.copyCampaign")}
                </button>
                {selectedCampaign.status !== GQL.AffiliateCampaignStatus.Archived && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={statusMutationState.loading}
                    onClick={() => archiveCampaign(selectedCampaign)}
                  >
                    {t("ecommerce.affiliateCampaign.archive")}
                  </button>
                )}
                {selectedCampaign.status === GQL.AffiliateCampaignStatus.Draft && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={deleteDraftState.loading}
                    onClick={() => void deleteDraftCampaign(selectedCampaign)}
                  >
                    {t("ecommerce.affiliateCampaign.deleteDraft")}
                  </button>
                )}
                {!isTerminalCampaignStatus(selectedCampaign.status) && (
                  <button
                    type="button"
                    className={
                      selectedCampaign.status === GQL.AffiliateCampaignStatus.Active
                        ? "btn btn-secondary"
                        : "btn btn-primary affiliate-campaign-primary-action"
                    }
                    disabled={
                      statusMutationState.loading ||
                      (selectedCampaign.status !== GQL.AffiliateCampaignStatus.Active &&
                        selectionReadiness?.ready === false)
                    }
                    onClick={() => void changeStatus(selectedCampaign)}
                  >
                    {selectedCampaign.status === GQL.AffiliateCampaignStatus.Active
                      ? t("ecommerce.affiliateCampaign.pause")
                      : t("ecommerce.affiliateCampaign.reopen")}
                  </button>
                )}
              </div>
            </header>
            {selectedCampaign.status !== GQL.AffiliateCampaignStatus.Active &&
              selectionReadiness?.ready === false &&
              !isTerminalCampaignStatus(selectedCampaign.status) && (
                <div className="affiliate-campaign-readiness-warning">
                  <strong>{t("ecommerce.affiliateCampaign.reopenBlocked")}</strong>
                  <span>{campaignReadinessMessage(selectionReadiness.reasonCode, t)}</span>
                </div>
              )}

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
                    : latestExecution?.underDeliveryReason
                      ? campaignExecutionReasonLabel(latestExecution.underDeliveryReason, t)
                      : t("ecommerce.affiliateCampaign.waitingForWindow")}
                </small>
              </div>
              <div className="affiliate-campaign-cadence">
                <span>{t("ecommerce.affiliateCampaign.cadence")}</span>
                <strong>
                  {t("ecommerce.affiliateCampaign.hourlyRate", {
                    rate: estimateCampaignCadence(
                      selectedCampaign.dailyOutreachTarget,
                      latestExecution?.counters.submitted ?? 0,
                    ),
                  })}
                </strong>
                <small>{t("ecommerce.affiliateCampaign.dynamicJitter")}</small>
              </div>
              <div className="affiliate-campaign-quota">
                <span>{t("ecommerce.affiliateCampaign.remainingTarget")}</span>
                <strong>
                  {Math.max(
                    0,
                    selectedCampaign.dailyOutreachTarget -
                      (latestExecution?.counters.submitted ?? 0),
                  )}
                </strong>
                <small>
                  {latestExecution?.riskState === "NORMAL"
                    ? t("ecommerce.affiliateCampaign.riskNormal")
                    : campaignRiskLabel(latestExecution?.riskState, t)}
                </small>
              </div>
            </section>

            <CampaignFunnel
              counters={summary?.counters}
              counterSchemaVersion={latestExecution?.counterSchemaVersion ?? 2}
              t={t}
            />

            <section className="affiliate-campaign-configuration">
              <div>
                <span>{t("ecommerce.affiliateCampaign.primaryProduct")}</span>
                <strong>{selectedCampaign.primaryProductId}</strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateCampaign.selectionStrategy")}</span>
                <strong>
                  {campaignStrategyLabel(selectedCampaign.selectionPolicy.strategy, t)}
                </strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateCampaign.selectionReadiness")}</span>
                <strong>
                  {selectionReadiness?.ready
                    ? t("ecommerce.affiliateCampaign.ready")
                    : campaignReadinessMessage(selectionReadiness?.reasonCode, t)}
                </strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateCampaign.commissionRate")}</span>
                <strong>{campaignCommissionRate(selectedCampaign)}%</strong>
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
                  <p>{t("ecommerce.affiliateCampaign.creatorStatesDescription")}</p>
                </div>
              </div>
              <div className="affiliate-campaign-state-filters">
                <CampaignStateFilterGroup
                  label={t("ecommerce.affiliateCampaign.filterState")}
                  options={stateStatusOptions.map((status) => ({
                    value: status,
                    label: campaignStateLabel(status, t),
                  }))}
                  selected={stateStatuses}
                  onToggle={(status) =>
                    setStateStatuses((current) => toggleValue(current, status))
                  }
                />
                <CampaignStateFilterGroup
                  label={t("ecommerce.affiliateCampaign.eligibilityCategoryFilter")}
                  options={eligibilityCategoryOptions.map((category) => ({
                    value: category,
                    label: eligibilityCategoryLabel(category, t),
                  }))}
                  selected={eligibilityCategories}
                  onToggle={(category) =>
                    setEligibilityCategories((current) => toggleValue(current, category))
                  }
                />
                <CampaignStateFilterGroup
                  label={t("ecommerce.affiliateCampaign.reasonFilter")}
                  options={eligibilityReasonOptions.map((reason) => ({
                    value: reason,
                    label: eligibilityReasonLabel(reason, t),
                  }))}
                  selected={eligibilityReasons}
                  onToggle={(reason) =>
                    setEligibilityReasons((current) => toggleValue(current, reason))
                  }
                />
                {(stateStatuses.length > 0 ||
                  eligibilityCategories.length > 0 ||
                  eligibilityReasons.length > 0) && (
                  <button
                    type="button"
                    className="affiliate-campaign-clear-state-filters"
                    onClick={() => {
                      setStateStatuses([]);
                      setEligibilityCategories([]);
                      setEligibilityReasons([]);
                    }}
                  >
                    {t("ecommerce.affiliateCampaign.clearFilters")}
                  </button>
                )}
              </div>
              <div className="affiliate-campaign-state-table-wrap">
                <table className="affiliate-campaign-state-table">
                  <thead>
                    <tr>
                      <th>{t("ecommerce.affiliateCampaign.creator")}</th>
                      <th>{t("ecommerce.affiliateCampaign.outreachDisposition")}</th>
                      <th>{t("ecommerce.affiliateCampaign.state")}</th>
                      <th>{t("ecommerce.affiliateCampaign.selectionEvidence")}</th>
                      <th>{t("ecommerce.affiliateCampaign.relationship")}</th>
                      <th>{t("ecommerce.affiliateCampaign.lastActivity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(creatorStatesQuery.data?.affiliateCampaignCreatorStates.items ?? []).map(
                      (state) => (
                        <CampaignCreatorStateRow key={state.id} state={state} t={t} />
                      ),
                    )}
                  </tbody>
                </table>
                {creatorStatesViewState === "error" && (
                  <div
                    className="affiliate-campaign-table-empty affiliate-campaign-table-error"
                    role="alert"
                  >
                    <span>{t("ecommerce.affiliateCampaign.creatorStatesLoadFailed")}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void creatorStatesQuery.refetch()}
                    >
                      {t("ecommerce.affiliateCampaign.retryCreatorStates")}
                    </button>
                  </div>
                )}
                {creatorStatesViewState === "empty" && (
                  <div className="affiliate-campaign-table-empty">
                    {t("ecommerce.affiliateCampaign.noCreatorStates")}
                  </div>
                )}
              </div>
              {creatorStatesQuery.data?.affiliateCampaignCreatorStates.nextCursor && (
                <button
                  type="button"
                  className="btn btn-secondary affiliate-campaign-load-more"
                  disabled={creatorStatesQuery.loading}
                  onClick={() => void loadMoreCreatorStates()}
                >
                  {t("ecommerce.affiliateCampaign.loadMoreCreators")}
                </button>
              )}
            </section>

            {(executionsQuery.data?.affiliateCampaignDailyExecutions.length ?? 0) > 1 && (
              <section className="affiliate-campaign-history-strip">
                <span>{t("ecommerce.affiliateCampaign.recentExecutions")}</span>
                <div>
                  {executionsQuery
                    .data!.affiliateCampaignDailyExecutions.slice(0, 7)
                    .map((execution) => (
                      <article key={execution.id}>
                        <strong>{execution.marketLocalDate}</strong>
                        <small>
                          {execution.counters.sent}/{execution.allocatedTarget}
                        </small>
                      </article>
                    ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>

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
        <div className="affiliate-campaign-wizard-body" data-tutorial-id="affiliate-campaign-wizard">
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
                    onChange={(shopId) => {
                      setForm((current) => ({
                        ...current,
                        shopId,
                        productId: "",
                        refreshProductSnapshot: false,
                        searchPhrases: [
                          {
                            text: "",
                            source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
                            explanation: "",
                            explanationLocale: "",
                            suggestionVersion: null,
                            discoveryRules: createDefaultDiscoveryRules(),
                          },
                        ],
                        messageProductName: "",
                        ageRanges: [],
                        audienceGender: "",
                        audienceGenderMinimum: "",
                        gmvRanges: [],
                        unitsSoldRanges: [],
                        languages: [],
                        creatorLevels: [],
                        categoryPros: [],
                      }));
                      setProductPreview(null);
                      setPendingProductResolution(null);
                    }}
                    options={shopOptions}
                    searchable
                    disabled={Boolean(editingCampaignId)}
                    searchPlaceholder={t("ecommerce.affiliateCampaign.searchShop")}
                    placeholder={t("ecommerce.affiliateCampaign.selectShop")}
                  />
                </label>
                <div className="affiliate-campaign-product-fetch">
                  <span>{t("ecommerce.affiliateCampaign.primaryProduct")}</span>
                  <div className="affiliate-campaign-product-fetch-row">
                    <input
                      value={form.productId}
                      disabled={!form.shopId}
                      onChange={(event) => {
                        updateForm("productId", event.target.value.trim());
                        updateForm("refreshProductSnapshot", false);
                        updateForm("searchPhrases", [
                          {
                            text: "",
                            source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
                            explanation: "",
                            explanationLocale: "",
                            suggestionVersion: null,
                            discoveryRules: createDefaultDiscoveryRules(),
                          },
                        ]);
                        updateForm("messageProductName", "");
                        setProductPreview(null);
                        setPendingProductResolution(null);
                      }}
                      placeholder={t("ecommerce.affiliateCampaign.productIdPlaceholder")}
                    />
                    <button
                      type="button"
                      className="affiliate-campaign-fetch-button"
                      disabled={
                        !form.shopId || !form.productId.trim() || resolveProductState.loading
                      }
                      onClick={fetchProduct}
                    >
                      {resolveProductState.loading
                        ? t("ecommerce.affiliateCampaign.fetchingProduct")
                        : t("ecommerce.affiliateCampaign.fetchProduct")}
                    </button>
                  </div>
                  <small>{t("ecommerce.affiliateCampaign.productFetchHint")}</small>
                </div>
                {pendingProductResolution && productPreview && (
                  <div className="affiliate-campaign-product-diff">
                    <div>
                      <strong>{t("ecommerce.affiliateCampaign.productChanged")}</strong>
                      <span>
                        {productPreview.title} → {pendingProductResolution.title}
                      </span>
                      <small>
                        ${productPreview.minimumPriceUsdAmount.toFixed(2)} → $
                        {pendingProductResolution.minimumPriceUsdAmount.toFixed(2)}
                      </small>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setPendingProductResolution(null)}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => applyProductResolution(pendingProductResolution)}
                      >
                        {t("ecommerce.affiliateCampaign.useLatestProduct")}
                      </button>
                    </div>
                  </div>
                )}
                {productPreview && (
                  <article className="affiliate-campaign-product-preview">
                    {productPreview.coverImage ? (
                      <img src={productPreview.coverImage} alt="" />
                    ) : (
                      <div className="affiliate-campaign-product-preview-placeholder">
                        <ShopIcon />
                      </div>
                    )}
                    <div>
                      <span>{t("ecommerce.affiliateCampaign.productVerified")}</span>
                      <strong>{productPreview.title}</strong>
                      <p>{productPreview.categoryPathNames.join(" / ")}</p>
                      <small>
                        ${productPreview.minimumPriceUsdAmount.toFixed(2)}
                        {productPreview.maximumPriceUsdAmount !==
                          productPreview.minimumPriceUsdAmount &&
                          ` – $${productPreview.maximumPriceUsdAmount.toFixed(2)}`}
                        {" · "}
                        {productPreview.brandName || t("ecommerce.affiliateCampaign.noBrand")}
                        {" · "}
                        {t("ecommerce.affiliateCampaign.snapshotObservedAt", {
                          time: formatDateTime(productPreview.observedAt),
                        })}
                      </small>
                    </div>
                    <i>{productPreview.status ?? "—"}</i>
                  </article>
                )}
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
                <div className="affiliate-campaign-strategy-picker">
                  <button
                    type="button"
                    data-selected={
                      form.strategy === GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules ||
                      undefined
                    }
                    onClick={() =>
                      updateForm(
                        "strategy",
                        GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules,
                      )
                    }
                  >
                    <span>{t("ecommerce.affiliateCampaign.strategyRuleKicker")}</span>
                    <strong>{t("ecommerce.affiliateCampaign.strategyRuleTitle")}</strong>
                    <small>{t("ecommerce.affiliateCampaign.strategyRuleDescription")}</small>
                    <i>{t("ecommerce.affiliateCampaign.strategyRuleOrder")}</i>
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    data-selected={
                      form.strategy === GQL.AffiliateCampaignSelectionStrategy.ExpectedSales ||
                      undefined
                    }
                  >
                    <span>{t("ecommerce.affiliateCampaign.strategyMlKicker")}</span>
                    <strong>{t("ecommerce.affiliateCampaign.strategyMlTitle")}</strong>
                    <small>{t("ecommerce.affiliateCampaign.strategyMlDescription")}</small>
                    <i>{t("ecommerce.affiliateCampaign.strategyMlUnavailable")}</i>
                  </button>
                </div>
                <div className="affiliate-campaign-capability-note">
                  <strong>
                    {capabilitiesQuery.loading
                      ? t("ecommerce.affiliateCampaign.loadingCapabilities")
                      : capabilities
                        ? t("ecommerce.affiliateCampaign.providerRulesReady", {
                            market: capabilities.market,
                          })
                        : t("ecommerce.affiliateCampaign.providerRulesUnavailable")}
                  </strong>
                  <small>{t("ecommerce.affiliateCampaign.providerRulesAuthority")}</small>
                </div>
                <div className="affiliate-campaign-search-boundary">
                  <strong>{t("ecommerce.affiliateCampaign.tiktokSearchConditions")}</strong>
                  <p>{t("ecommerce.affiliateCampaign.tiktokSearchConditionsDescription")}</p>
                </div>
                <div className="affiliate-campaign-field-pair">
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.dailyTarget")}</span>
                    <input
                      type="number"
                      min={1}
                      value={form.dailyTarget}
                      onChange={(event) => updateForm("dailyTarget", event.target.value)}
                    />
                    <small>{t("ecommerce.affiliateCampaign.dailyTargetHint")}</small>
                  </label>
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.commissionRate")}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={form.commissionRate}
                      onChange={(event) => updateForm("commissionRate", event.target.value)}
                    />
                    <small>{t("ecommerce.affiliateCampaign.commissionRateHint")}</small>
                  </label>
                </div>
                <div className="affiliate-campaign-search-group-toolbar">
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.marketplaceSearchPhrases")}</span>
                    <small>{t("ecommerce.affiliateCampaign.searchPhrasesBudgetHint")}</small>
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!productPreview || generatingSearchGroups}
                    onClick={generateKeywordSuggestions}
                  >
                    {generatingSearchGroups
                      ? t("ecommerce.affiliateCampaign.generating")
                      : t(
                          form.searchPhrases.some((phrase) => phrase.text.trim())
                            ? "ecommerce.affiliateCampaign.resuggestSearchGroups"
                            : "ecommerce.affiliateCampaign.suggestSearchGroups",
                        )}
                  </button>
                </div>
                <div className="affiliate-campaign-phrase-editor">
                  {form.searchPhrases.map((phrase, index) => (
                    <div
                      className="affiliate-campaign-phrase-card"
                      key={`${index}:${phrase.source}`}
                    >
                      <span className="affiliate-campaign-phrase-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="affiliate-campaign-phrase-content">
                        <div className="affiliate-campaign-phrase-meta">
                          <span>
                            {t("ecommerce.affiliateCampaign.searchGroupNumber", {
                              number: String(index + 1).padStart(2, "0"),
                            })}
                          </span>
                          <span>
                            {phrase.source === GQL.AffiliateCampaignSearchPhraseSource.AiSuggested
                              ? t("ecommerce.affiliateCampaign.aiSuggested")
                              : t("ecommerce.affiliateCampaign.userAuthored")}
                          </span>
                          <span>{t("ecommerce.affiliateCampaign.englishSearchPhrase")}</span>
                        </div>
                        <input
                          value={phrase.text}
                          maxLength={80}
                          onChange={(event) => {
                            const next = [...form.searchPhrases];
                            next[index] = {
                              text: event.target.value,
                              source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
                              explanation: "",
                              explanationLocale: "",
                              suggestionVersion: null,
                              discoveryRules: phrase.discoveryRules,
                            };
                            updateForm("searchPhrases", next);
                          }}
                          placeholder={t("ecommerce.affiliateCampaign.searchPhrasePlaceholder")}
                        />
                        {phrase.explanation ? (
                          <div className="affiliate-campaign-phrase-explanation">
                            <strong>{t("ecommerce.affiliateCampaign.whyThisPhrase")}</strong>
                            <p lang={phrase.explanationLocale || undefined}>{phrase.explanation}</p>
                          </div>
                        ) : (
                          <small className="affiliate-campaign-phrase-empty-explanation">
                            {t("ecommerce.affiliateCampaign.userEditedNoExplanation")}
                          </small>
                        )}
                        <SearchGroupRulesEditor
                          rules={phrase.discoveryRules}
                          capabilities={capabilities}
                          t={t}
                          onChange={(discoveryRules) => {
                            const next = [...form.searchPhrases];
                            next[index] = { ...phrase, discoveryRules };
                            updateForm("searchPhrases", next);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="affiliate-campaign-remove-phrase"
                        aria-label={t("ecommerce.affiliateCampaign.removeSearchPhrase")}
                        disabled={form.searchPhrases.length === 1}
                        onClick={() =>
                          updateForm(
                            "searchPhrases",
                            form.searchPhrases.filter((_, phraseIndex) => phraseIndex !== index),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {form.searchPhrases.length < 5 && (
                    <button
                      type="button"
                      className="affiliate-campaign-add-phrase"
                      onClick={() =>
                        updateForm("searchPhrases", [
                          ...form.searchPhrases,
                          {
                            text: "",
                            source: GQL.AffiliateCampaignSearchPhraseSource.UserAuthored,
                            explanation: "",
                            explanationLocale: "",
                            suggestionVersion: null,
                            discoveryRules: createDefaultDiscoveryRules(),
                          },
                        ])
                      }
                    >
                      {t("ecommerce.affiliateCampaign.addSearchPhrase")}
                    </button>
                  )}
                </div>
                <section className="affiliate-campaign-outreach-limits">
                  <div>
                    <span>{t("ecommerce.affiliateCampaign.automaticOutreachLimits")}</span>
                    <strong>
                      {t("ecommerce.affiliateCampaign.automaticOutreachLimitsDescription")}
                    </strong>
                  </div>
                  <ul>
                    <li>{t("ecommerce.affiliateCampaign.protectionLimit")}</li>
                    <li>{t("ecommerce.affiliateCampaign.sameProductLimit")}</li>
                    <li>{t("ecommerce.affiliateCampaign.cadenceLimit")}</li>
                    <li>{t("ecommerce.affiliateCampaign.relationshipDoesNotBlock")}</li>
                    <li>{t("ecommerce.affiliateCampaign.replyHandoff")}</li>
                  </ul>
                </section>
                <details className="affiliate-campaign-advanced-rules" hidden>
                  <summary>
                    <span>{t("ecommerce.affiliateCampaign.advancedProviderRules")}</span>
                    <small>{t("ecommerce.affiliateCampaign.advancedProviderRulesHint")}</small>
                  </summary>
                  <div className="affiliate-campaign-rule-block">
                    <strong>{t("ecommerce.affiliateCampaign.audienceRules")}</strong>
                    <div className="affiliate-campaign-chip-grid">
                      {(capabilities?.ageRanges ?? []).map((value) => (
                        <button
                          type="button"
                          key={value}
                          data-selected={form.ageRanges.includes(value) || undefined}
                          onClick={() =>
                            updateForm("ageRanges", toggleValue(form.ageRanges, value))
                          }
                        >
                          {marketplaceEnumLabel(value)}
                        </button>
                      ))}
                    </div>
                    <div className="affiliate-campaign-field-pair">
                      <label>
                        <span>{t("ecommerce.affiliateCampaign.audienceGender")}</span>
                        <Select
                          value={form.audienceGender}
                          onChange={(value) =>
                            updateForm(
                              "audienceGender",
                              value as GQL.CreatorSearchFollowerGender | "",
                            )
                          }
                          options={[
                            { value: "", label: t("ecommerce.affiliateCampaign.noMinimum") },
                            ...(capabilities?.genders ?? []).map((value) => ({
                              value,
                              label: marketplaceEnumLabel(value),
                            })),
                          ]}
                        />
                      </label>
                      <label>
                        <span>{t("ecommerce.affiliateCampaign.minimumAudienceShare")}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!form.audienceGender}
                          value={form.audienceGenderMinimum}
                          onChange={(event) =>
                            updateForm("audienceGenderMinimum", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <RuleChipSection
                    title={t("ecommerce.affiliateCampaign.gmv30d")}
                    values={capabilities?.gmvRanges ?? []}
                    selected={form.gmvRanges}
                    onToggle={(value) =>
                      updateForm("gmvRanges", toggleValue(form.gmvRanges, value))
                    }
                  />
                  <RuleChipSection
                    title={t("ecommerce.affiliateCampaign.units30d")}
                    values={capabilities?.unitsSoldRanges ?? []}
                    selected={form.unitsSoldRanges}
                    onToggle={(value) =>
                      updateForm("unitsSoldRanges", toggleValue(form.unitsSoldRanges, value))
                    }
                  />
                  <RuleChipSection
                    title={t("ecommerce.affiliateCampaign.languages")}
                    values={capabilities?.languages ?? []}
                    selected={form.languages}
                    onToggle={(value) =>
                      updateForm("languages", toggleValue(form.languages, value))
                    }
                  />
                  <RuleChipSection
                    title={t("ecommerce.affiliateCampaign.creatorLevels")}
                    values={capabilities?.creatorLevels ?? []}
                    selected={form.creatorLevels}
                    onToggle={(value) =>
                      updateForm("creatorLevels", toggleValue(form.creatorLevels, value))
                    }
                  />
                  <RuleChipSection
                    title={t("ecommerce.affiliateCampaign.categoryPros")}
                    values={capabilities?.categoryPros ?? []}
                    selected={form.categoryPros}
                    onToggle={(value) =>
                      updateForm("categoryPros", toggleValue(form.categoryPros, value))
                    }
                  />
                  <div className="affiliate-campaign-rule-block">
                    <label>
                      <span>{t("ecommerce.affiliateCampaign.categoryIds")}</span>
                      <input
                        value={form.categoryIds}
                        onChange={(event) => updateForm("categoryIds", event.target.value)}
                        placeholder={t("ecommerce.affiliateCampaign.categoryIdsHint")}
                      />
                    </label>
                    <div className="affiliate-campaign-field-pair">
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageVideoViews")}
                        value={form.averageVideoViews}
                        onChange={(value) => updateForm("averageVideoViews", value)}
                      />
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageEngagementRate")}
                        value={form.averageEngagementRate}
                        onChange={(value) => updateForm("averageEngagementRate", value)}
                      />
                    </div>
                    <div className="affiliate-campaign-field-pair">
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageShoppableVideoViews")}
                        value={form.averageShoppableVideoViews}
                        onChange={(value) => updateForm("averageShoppableVideoViews", value)}
                      />
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageShoppableEngagementRate")}
                        value={form.averageShoppableEngagementRate}
                        onChange={(value) => updateForm("averageShoppableEngagementRate", value)}
                      />
                    </div>
                    <div className="affiliate-campaign-field-pair">
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageLiveViewers")}
                        value={form.averageLiveViewers}
                        onChange={(value) => updateForm("averageLiveViewers", value)}
                      />
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageShoppableLiveViewers")}
                        value={form.averageShoppableLiveViewers}
                        onChange={(value) => updateForm("averageShoppableLiveViewers", value)}
                      />
                    </div>
                    <div className="affiliate-campaign-field-pair">
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.averageCommissionRate")}
                        value={form.averageCommissionRate}
                        onChange={(value) => updateForm("averageCommissionRate", value)}
                      />
                      <RuleTextInput
                        label={t("ecommerce.affiliateCampaign.postRate")}
                        value={form.postRate}
                        onChange={(value) => updateForm("postRate", value)}
                      />
                    </div>
                    <RuleTextInput
                      label={t("ecommerce.affiliateCampaign.creatorAgencyStatus")}
                      value={form.creatorAgencyStatus}
                      onChange={(value) => updateForm("creatorAgencyStatus", value)}
                    />
                    <label className="affiliate-campaign-check-rule">
                      <input
                        type="checkbox"
                        checked={form.fastGrowingOnly}
                        onChange={(event) => updateForm("fastGrowingOnly", event.target.checked)}
                      />
                      <span>{t("ecommerce.affiliateCampaign.fastGrowingOnly")}</span>
                    </label>
                    <label className="affiliate-campaign-check-rule">
                      <input
                        type="checkbox"
                        checked={form.notInvitedLast90Days}
                        onChange={(event) =>
                          updateForm("notInvitedLast90Days", event.target.checked)
                        }
                      />
                      <span>{t("ecommerce.affiliateCampaign.notInvitedLast90Days")}</span>
                    </label>
                  </div>
                </details>
                <div className="affiliate-campaign-allocation-preview">
                  <span>{t("ecommerce.affiliateCampaign.dailyPlanTarget")}</span>
                  <strong>{formatNumber(Number(form.dailyTarget) || 0)}</strong>
                  <small>{t("ecommerce.affiliateCampaign.dynamicRiskControlHint")}</small>
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
                <label>
                  <span>{t("ecommerce.affiliateCampaign.templateGuidance")}</span>
                  <input
                    value={form.templateGuidance}
                    onChange={(event) => updateForm("templateGuidance", event.target.value)}
                    placeholder={t("ecommerce.affiliateCampaign.templateGuidancePlaceholder")}
                  />
                  <small>{t("ecommerce.affiliateCampaign.templateGuidanceHint")}</small>
                </label>
                <div className="affiliate-campaign-template-toolbar">
                  <div>
                    <strong>{t("ecommerce.affiliateCampaign.supportedVariables")}</strong>
                    <span>{"{{creator_name}} · {{product_name}} · {{shop_name}}"}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void generateMessage()}
                    disabled={generatingTemplate}
                  >
                    {generatingTemplate
                      ? t("ecommerce.affiliateCampaign.generating")
                      : t(
                          form.templateText.trim()
                            ? "ecommerce.affiliateCampaign.generateAlternative"
                            : "ecommerce.affiliateCampaign.generateWithAi",
                        )}
                  </button>
                </div>
                <label>
                  <span>{t("ecommerce.affiliateCampaign.messageProductName")}</span>
                  <input
                    value={form.messageProductName}
                    maxLength={80}
                    onChange={(event) => updateForm("messageProductName", event.target.value)}
                    placeholder={t("ecommerce.affiliateCampaign.messageProductNamePlaceholder")}
                  />
                  <small>{t("ecommerce.affiliateCampaign.messageProductNameHint")}</small>
                </label>
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
                      form.messageProductName ||
                        productPreview?.title ||
                        t("ecommerce.affiliateCampaign.previewProduct"),
                      selectedShop?.shopName || t("ecommerce.affiliateCampaign.previewShop"),
                    ) || t("ecommerce.affiliateCampaign.previewEmpty")}
                  </p>
                  {productPreview && (
                    <div className="affiliate-campaign-message-product-card">
                      {productPreview.coverImage ? (
                        <img src={productPreview.coverImage} alt="" />
                      ) : (
                        <span>
                          <ShopIcon />
                        </span>
                      )}
                      <div>
                        <strong>{form.messageProductName || productPreview.title}</strong>
                        <small>
                          ${productPreview.minimumPriceUsdAmount.toFixed(2)}
                          {" · "}
                          {t("ecommerce.affiliateCampaign.productCardAttached")}
                        </small>
                      </div>
                    </div>
                  )}
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
                  value={`${selectedShop?.shopName ?? "—"} · ${productPreview?.title ?? form.productId}`}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.dailyTarget")}
                  value={t("ecommerce.affiliateCampaign.messagesPerDay", {
                    count: Number(form.dailyTarget),
                  })}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.selectionStrategy")}
                  value={campaignStrategyLabel(form.strategy, t)}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.commissionRate")}
                  value={`${form.commissionRate}%`}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.sendingWindow")}
                  value={`08:00–22:00 · ${selectedShop?.timezone ?? "—"}`}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.estimatedInterval")}
                  value={t("ecommerce.affiliateCampaign.hourlyRate", {
                    rate: estimateCampaignCadence(Number(form.dailyTarget), 0),
                  })}
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
                <span>
                  <i />
                  {t("ecommerce.affiliateCampaign.platformOnlyBoundary")}
                </span>
                <span>
                  <i />
                  {t("ecommerce.affiliateCampaign.noFallbackBoundary")}
                </span>
                <span>
                  <i />
                  {t("ecommerce.affiliateCampaign.replyHandoffBoundary")}
                </span>
              </div>
            </div>
          )}
        </div>
        <footer className="affiliate-campaign-wizard-footer">
          <button
            type="button"
            className="btn btn-secondary"
            data-tutorial-id="affiliate-campaign-wizard-cancel"
            onClick={() => {
              if (wizardStep === 1) setWizardOpen(false);
              else setWizardStep((step) => step - 1);
            }}
            disabled={writeCampaignState.loading}
          >
            {wizardStep === 1 ? t("common.cancel") : t("ecommerce.affiliateCampaign.back")}
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
                    !editingCampaignId
                      ? "ecommerce.affiliateCampaign.createAndActivate"
                      : editingCampaign?.status === GQL.AffiliateCampaignStatus.Active
                        ? "ecommerce.affiliateCampaign.saveChanges"
                        : "ecommerce.affiliateCampaign.saveAndActivate",
                  )}
            </button>
          )}
        </footer>
      </Modal>
      <ConfirmDialog
        isOpen={confirmation !== null}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmPendingAction}
        title={t(
          confirmation?.kind === "delete-draft"
            ? "ecommerce.affiliateCampaign.deleteDraftTitle"
            : confirmation?.kind === "archive"
              ? "ecommerce.affiliateCampaign.archiveTitle"
              : "ecommerce.affiliateCampaign.resuggestTitle",
        )}
        message={
          confirmation?.kind === "delete-draft"
            ? t("ecommerce.affiliateCampaign.deleteDraftConfirm", {
                name: confirmation.campaignName,
              })
            : confirmation?.kind === "archive"
              ? t("ecommerce.affiliateCampaign.archiveConfirm", {
                  name: confirmation.campaignName,
                })
              : t("ecommerce.affiliateCampaign.resuggestConfirm")
        }
        confirmLabel={t(
          confirmation?.kind === "delete-draft"
            ? "ecommerce.affiliateCampaign.deleteDraft"
            : confirmation?.kind === "archive"
              ? "ecommerce.affiliateCampaign.archive"
              : "ecommerce.affiliateCampaign.replaceSuggestions",
        )}
        cancelLabel={t("common.cancel")}
        confirmVariant={
          confirmation?.kind === "delete-draft" || confirmation?.kind === "archive"
            ? "danger"
            : "primary"
        }
      />
    </div>
  );
});

function CampaignCreatorStateRow({
  state,
  t,
}: {
  state: CampaignCreatorState;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const profile = state.creatorProfile;
  const performance = state.creatorPerformance;
  const relationship = state.creatorRelationship;
  const displayName =
    profile?.nickname?.trim() ||
    profile?.username?.trim() ||
    t("ecommerce.affiliateCampaign.profilePending");
  const handle = profile?.username
    ? `@${profile.username.replace(/^@/, "")}`
    : shortId(profile?.creatorOpenId || state.creatorId);
  const followers = performance?.followerCount ?? state.followerCount;
  const relationshipActivity = relationship?.lastInboundAt || relationship?.lastOutboundAt || null;
  const lastActivity =
    state.repliedAt ||
    state.reachedOutAt ||
    state.scheduledAt ||
    relationshipActivity ||
    state.lastSeenAt;
  const disposition = campaignOutreachDisposition(state.status);

  return (
    <tr>
      <td>
        <div className="affiliate-campaign-creator-cell">
          <div className="affiliate-campaign-creator-avatar">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <span>{displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <strong>{displayName}</strong>
            <small>
              {handle} · {state.market}
            </small>
            <p title={profile?.bioDescription ?? undefined}>
              {profile?.bioDescription ||
                t("ecommerce.affiliateCampaign.profileObserved", {
                  count: state.searchOccurrenceCount,
                })}
            </p>
          </div>
        </div>
      </td>
      <td>
        <span className={`affiliate-campaign-disposition is-${disposition}`}>
          {t(`ecommerce.affiliateCampaign.disposition.${disposition}`)}
        </span>
        <small>
          {state.reachedOutAt
            ? formatDateTime(state.reachedOutAt)
            : t("ecommerce.affiliateCampaign.notSent")}
        </small>
      </td>
      <td>
        <span className={`affiliate-campaign-state-pill is-${state.status.toLowerCase()}`}>
          {campaignStateLabel(state.status, t)}
        </span>
        <small>
          {state.eligibilityReasonCode
            ? eligibilityReasonLabel(state.eligibilityReasonCode, t)
            : formatDecisionReason(state.decisionReason)}
        </small>
        {state.eligibilityCategory && (
          <span
            className={`affiliate-campaign-eligibility-category is-${state.eligibilityCategory.toLowerCase()}`}
          >
            {eligibilityCategoryLabel(state.eligibilityCategory, t)}
          </span>
        )}
      </td>
      <td>
        {state.selectionStrategy === GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules ? (
          <>
            <strong>{t("ecommerce.affiliateCampaign.providerOrderEvidence")}</strong>
            <small>
              {t("ecommerce.affiliateCampaign.providerRank", {
                rank: state.providerOrdinal ?? "—",
                page: (state.providerPageSequence ?? 0) + 1,
              })}
            </small>
            <small>
              {t("ecommerce.affiliateCampaign.ruleFilterResult", {
                result: marketplaceEnumLabel(state.filterResult ?? "NOT_EVALUATED"),
              })}
            </small>
            <small>
              {t("ecommerce.affiliateCampaign.matchedSearchGroups", {
                count: state.latestSearchPhraseKeys?.length ?? 0,
              })}
            </small>
          </>
        ) : (
          <>
            <strong>
              {t("ecommerce.affiliateCampaign.expectedSalesCompact", {
                count: formatOptionalNumber(state.expectedSalesUnits),
              })}
            </strong>
            <small>
              {t("ecommerce.affiliateCampaign.followerAndEfficiency", {
                followers: followers == null ? "—" : formatNumber(followers),
                score: formatScore(state.efficiencyScore),
              })}
            </small>
            <small>
              {performance
                ? t("ecommerce.affiliateCampaign.performanceAsOf", {
                    date: formatDateTime(performance.observedAt),
                  })
                : t("ecommerce.affiliateCampaign.performancePending")}
            </small>
          </>
        )}
      </td>
      <td>
        <strong>
          {relationship
            ? t("ecommerce.affiliateCampaign.relationshipEstablished")
            : t("ecommerce.affiliateCampaign.profileOnly")}
        </strong>
        <small>
          {relationship
            ? t("ecommerce.affiliateCampaign.relationshipSummary", {
                shops: relationship.shopStates.length,
                collaborations: relationship.activeAffiliateCollaborationIds.length,
              })
            : t("ecommerce.affiliateCampaign.relationshipAfterOutreach")}
        </small>
        {relationship && (
          <small>{t("ecommerce.affiliateCampaign.relationshipDoesNotBlockShort")}</small>
        )}
      </td>
      <td>
        <strong>{formatDateTime(lastActivity)}</strong>
        <small>
          {t("ecommerce.affiliateCampaign.seenTimes", {
            count: state.searchOccurrenceCount,
          })}
        </small>
      </td>
    </tr>
  );
}

function CampaignStateFilterGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <details className="affiliate-campaign-state-filter">
      <summary>
        <span>{label}</span>
        <small>{selected.length || "—"}</small>
      </summary>
      <div>
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function RuleChipSection<T extends string>({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: readonly T[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  if (!values.length) return null;
  return (
    <div className="affiliate-campaign-rule-block">
      <strong>{title}</strong>
      <div className="affiliate-campaign-chip-grid">
        {values.map((value) => (
          <button
            type="button"
            key={value}
            data-selected={selected.includes(value) || undefined}
            onClick={() => onToggle(value)}
          >
            {marketplaceEnumLabel(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function RuleTextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SearchGroupRulesEditor({
  rules,
  capabilities,
  t,
  onChange,
}: {
  rules: GQL.AffiliateCampaignDiscoveryRulesInput;
  capabilities?: GQL.AffiliateMarketplaceCreatorRuleCapabilities;
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (rules: GQL.AffiliateCampaignDiscoveryRulesInput) => void;
}) {
  const normalized = normalizeDiscoveryRules(rules);
  const ageRanges = normalized.audience?.ageRanges ?? [];
  const gender = normalized.audience?.genderDistribution?.gender ?? "";
  const gmvRanges = normalized.salesPerformance30d?.gmvRanges ?? [];
  const unitsSoldRanges = normalized.salesPerformance30d?.unitsSoldRanges ?? [];
  const languages = normalized.marketSpecific?.languages ?? [];
  const creatorLevels = normalized.marketSpecific?.creatorLevels ?? [];
  const categoryPros = normalized.marketSpecific?.categoryPros ?? [];
  const categoryIds = (normalized.categories ?? [])
    .map((category) => category.parentCategoryId)
    .join(", ");
  const content = normalized.contentPerformance30d ?? {};
  const affiliate = normalized.affiliatePerformance30d ?? {};
  const summary = campaignSearchGroupRuleSummary(normalized, t);
  return (
    <details className="affiliate-campaign-search-group-rules">
      <summary>
        <span>
          {t("ecommerce.affiliateCampaign.searchGroupRules")}
          <span className="affiliate-campaign-search-group-rule-summary">
            {summary.length
              ? summary.map((item) => <small key={item}>{item}</small>)
              : t("ecommerce.affiliateCampaign.searchGroupRulesEmpty")}
          </span>
        </span>
        <i>{t("ecommerce.affiliateCampaign.editRules")}</i>
      </summary>
      <div className="affiliate-campaign-search-group-rules-body">
        <div className="affiliate-campaign-field-pair">
          <label>
            <span>{t("ecommerce.affiliateCampaign.minimumFollowers")}</span>
            <input
              type="number"
              min={0}
              value={normalized.followerCount?.minimum ?? ""}
              onChange={(event) =>
                onChange({
                  ...normalized,
                  followerCount: {
                    ...normalized.followerCount,
                    minimum: optionalNumber(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateCampaign.maximumFollowers")}</span>
            <input
              type="number"
              min={0}
              value={normalized.followerCount?.maximum ?? ""}
              onChange={(event) =>
                onChange({
                  ...normalized,
                  followerCount: {
                    ...normalized.followerCount,
                    maximum: optionalNumber(event.target.value),
                  },
                })
              }
            />
          </label>
        </div>
        <RuleChipSection
          title={t("ecommerce.affiliateCampaign.audienceRules")}
          values={capabilities?.ageRanges ?? []}
          selected={ageRanges}
          onToggle={(value) =>
            onChange({
              ...normalized,
              audience: {
                ...normalized.audience,
                ageRanges: toggleValue(ageRanges, value),
              },
            })
          }
        />
        <div className="affiliate-campaign-field-pair">
          <label>
            <span>{t("ecommerce.affiliateCampaign.audienceGender")}</span>
            <Select
              value={gender}
              onChange={(value) =>
                onChange({
                  ...normalized,
                  audience: {
                    ...normalized.audience,
                    genderDistribution: value
                      ? {
                          gender: value as GQL.CreatorSearchFollowerGender,
                          minimumPercentage:
                            normalized.audience?.genderDistribution?.minimumPercentage ?? 0,
                        }
                      : null,
                  },
                })
              }
              options={[
                {
                  value: "",
                  label: t("ecommerce.affiliateCampaign.noMinimum"),
                },
                ...(capabilities?.genders ?? []).map((value) => ({
                  value,
                  label: marketplaceEnumLabel(value),
                })),
              ]}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateCampaign.minimumAudienceShare")}</span>
            <input
              type="number"
              min={0}
              max={100}
              disabled={!gender}
              value={normalized.audience?.genderDistribution?.minimumPercentage ?? ""}
              onChange={(event) =>
                onChange({
                  ...normalized,
                  audience: {
                    ...normalized.audience,
                    genderDistribution: gender
                      ? {
                          gender,
                          minimumPercentage: optionalNumber(event.target.value) ?? 0,
                        }
                      : null,
                  },
                })
              }
            />
          </label>
        </div>
        <RuleChipSection
          title={t("ecommerce.affiliateCampaign.gmv30d")}
          values={capabilities?.gmvRanges ?? []}
          selected={gmvRanges}
          onToggle={(value) =>
            onChange({
              ...normalized,
              salesPerformance30d: {
                ...normalized.salesPerformance30d,
                gmvRanges: toggleValue(gmvRanges, value),
              },
            })
          }
        />
        <RuleChipSection
          title={t("ecommerce.affiliateCampaign.units30d")}
          values={capabilities?.unitsSoldRanges ?? []}
          selected={unitsSoldRanges}
          onToggle={(value) =>
            onChange({
              ...normalized,
              salesPerformance30d: {
                ...normalized.salesPerformance30d,
                unitsSoldRanges: toggleValue(unitsSoldRanges, value),
              },
            })
          }
        />
        <RuleChipSection
          title={t("ecommerce.affiliateCampaign.languages")}
          values={capabilities?.languages ?? []}
          selected={languages}
          onToggle={(value) =>
            onChange({
              ...normalized,
              marketSpecific: {
                ...normalized.marketSpecific,
                languages: toggleValue(languages, value),
              },
            })
          }
        />
        <RuleChipSection
          title={t("ecommerce.affiliateCampaign.creatorLevels")}
          values={capabilities?.creatorLevels ?? []}
          selected={creatorLevels}
          onToggle={(value) =>
            onChange({
              ...normalized,
              marketSpecific: {
                ...normalized.marketSpecific,
                creatorLevels: toggleValue(creatorLevels, value),
              },
            })
          }
        />
        <RuleChipSection
          title={t("ecommerce.affiliateCampaign.categoryPros")}
          values={capabilities?.categoryPros ?? []}
          selected={categoryPros}
          onToggle={(value) =>
            onChange({
              ...normalized,
              marketSpecific: {
                ...normalized.marketSpecific,
                categoryPros: toggleValue(categoryPros, value),
              },
            })
          }
        />
        <div className="affiliate-campaign-rule-block">
          <label>
            <span>{t("ecommerce.affiliateCampaign.categoryIds")}</span>
            <input
              value={categoryIds}
              placeholder={t("ecommerce.affiliateCampaign.categoryIdsHint")}
              onChange={(event) =>
                onChange({
                  ...normalized,
                  categories: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .map((parentCategoryId) => ({ parentCategoryId, childCategoryIds: [] })),
                })
              }
            />
          </label>
        </div>
        <div className="affiliate-campaign-rule-block">
          <strong>{t("ecommerce.affiliateCampaign.contentPerformanceConditions")}</strong>
          <div className="affiliate-campaign-field-pair">
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageVideoViews")}
              value={content.averageVideoViews ?? ""}
              onChange={(averageVideoViews) =>
                onChange({
                  ...normalized,
                  contentPerformance30d: { ...content, averageVideoViews },
                })
              }
            />
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageEngagementRate")}
              value={content.averageEngagementRate ?? ""}
              onChange={(averageEngagementRate) =>
                onChange({
                  ...normalized,
                  contentPerformance30d: { ...content, averageEngagementRate },
                })
              }
            />
          </div>
          <div className="affiliate-campaign-field-pair">
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageShoppableVideoViews")}
              value={content.averageShoppableVideoViews ?? ""}
              onChange={(averageShoppableVideoViews) =>
                onChange({
                  ...normalized,
                  contentPerformance30d: { ...content, averageShoppableVideoViews },
                })
              }
            />
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageShoppableEngagementRate")}
              value={content.averageShoppableEngagementRate ?? ""}
              onChange={(averageShoppableEngagementRate) =>
                onChange({
                  ...normalized,
                  contentPerformance30d: {
                    ...content,
                    averageShoppableEngagementRate,
                  },
                })
              }
            />
          </div>
          <div className="affiliate-campaign-field-pair">
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageLiveViewers")}
              value={content.averageLiveViewers ?? ""}
              onChange={(averageLiveViewers) =>
                onChange({
                  ...normalized,
                  contentPerformance30d: { ...content, averageLiveViewers },
                })
              }
            />
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageShoppableLiveViewers")}
              value={content.averageShoppableLiveViewers ?? ""}
              onChange={(averageShoppableLiveViewers) =>
                onChange({
                  ...normalized,
                  contentPerformance30d: {
                    ...content,
                    averageShoppableLiveViewers,
                  },
                })
              }
            />
          </div>
        </div>
        <div className="affiliate-campaign-rule-block">
          <strong>{t("ecommerce.affiliateCampaign.affiliatePerformanceConditions")}</strong>
          <div className="affiliate-campaign-field-pair">
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.averageCommissionRate")}
              value={affiliate.averageCommissionRate ?? ""}
              onChange={(averageCommissionRate) =>
                onChange({
                  ...normalized,
                  affiliatePerformance30d: { ...affiliate, averageCommissionRate },
                })
              }
            />
            <RuleTextInput
              label={t("ecommerce.affiliateCampaign.postRate")}
              value={affiliate.postRate ?? ""}
              onChange={(postRate) =>
                onChange({
                  ...normalized,
                  affiliatePerformance30d: { ...affiliate, postRate },
                })
              }
            />
          </div>
          <RuleTextInput
            label={t("ecommerce.affiliateCampaign.creatorAgencyStatus")}
            value={affiliate.creatorAgencyStatus ?? ""}
            onChange={(creatorAgencyStatus) =>
              onChange({
                ...normalized,
                affiliatePerformance30d: { ...affiliate, creatorAgencyStatus },
              })
            }
          />
          <label className="affiliate-campaign-check-rule">
            <input
              type="checkbox"
              checked={affiliate.fastGrowingOnly ?? false}
              onChange={(event) =>
                onChange({
                  ...normalized,
                  affiliatePerformance30d: {
                    ...affiliate,
                    fastGrowingOnly: event.target.checked,
                  },
                })
              }
            />
            <span>{t("ecommerce.affiliateCampaign.fastGrowingOnly")}</span>
          </label>
          <label className="affiliate-campaign-check-rule">
            <input
              type="checkbox"
              checked={affiliate.notInvitedLast90Days ?? false}
              onChange={(event) =>
                onChange({
                  ...normalized,
                  affiliatePerformance30d: {
                    ...affiliate,
                    notInvitedLast90Days: event.target.checked,
                  },
                })
              }
            />
            <span>{t("ecommerce.affiliateCampaign.notInvitedLast90Days")}</span>
          </label>
          <p className="affiliate-campaign-cross-product-warning">
            {t("ecommerce.affiliateCampaign.notInvitedCrossProductWarning")}
          </p>
        </div>
      </div>
    </details>
  );
}

export function campaignSearchGroupRuleSummary(
  rules: GQL.AffiliateCampaignDiscoveryRulesInput,
  t: (key: string, options?: Record<string, unknown>) => string,
): string[] {
  const normalized = normalizeDiscoveryRules(rules);
  const minimumFollowers = normalized.followerCount?.minimum;
  const maximumFollowers = normalized.followerCount?.maximum;
  const ageRanges = normalized.audience?.ageRanges ?? [];
  const gender = normalized.audience?.genderDistribution;
  const gmvRanges = normalized.salesPerformance30d?.gmvRanges ?? [];
  const unitsSoldRanges = normalized.salesPerformance30d?.unitsSoldRanges ?? [];
  const languages = normalized.marketSpecific?.languages ?? [];
  const creatorLevels = normalized.marketSpecific?.creatorLevels ?? [];
  const categoryPros = normalized.marketSpecific?.categoryPros ?? [];
  const categories = normalized.categories ?? [];
  const contentRuleCount = Object.values(normalized.contentPerformance30d ?? {}).filter(
    (value) => value != null && value !== "",
  ).length;
  const affiliateRuleCount = Object.values(normalized.affiliatePerformance30d ?? {}).filter(
    (value) => value != null && value !== "" && value !== false,
  ).length;
  return [
    minimumFollowers != null && maximumFollowers != null
      ? t("ecommerce.affiliateCampaign.followerRangeCompact", {
          minimum: formatNumber(minimumFollowers),
          maximum: formatNumber(maximumFollowers),
        })
      : minimumFollowers != null
        ? t("ecommerce.affiliateCampaign.minimumFollowersCompact", {
            value: formatNumber(minimumFollowers),
          })
        : maximumFollowers != null
          ? `${t("ecommerce.affiliateCampaign.maximumFollowers")}: ${formatNumber(maximumFollowers)}`
          : null,
    ageRanges.length
      ? `${t("ecommerce.affiliateCampaign.audienceRules")}: ${ageRanges.map(marketplaceEnumLabel).join(", ")}`
      : null,
    gender
      ? `${t("ecommerce.affiliateCampaign.audienceGender")}: ${marketplaceEnumLabel(gender.gender)} ≥ ${formatNumber(gender.minimumPercentage)}%`
      : null,
    gmvRanges.length
      ? `${t("ecommerce.affiliateCampaign.gmv30d")}: ${gmvRanges.map(marketplaceEnumLabel).join(", ")}`
      : null,
    unitsSoldRanges.length
      ? `${t("ecommerce.affiliateCampaign.units30d")}: ${unitsSoldRanges.map(marketplaceEnumLabel).join(", ")}`
      : null,
    languages.length
      ? `${t("ecommerce.affiliateCampaign.languages")}: ${languages.map(marketplaceEnumLabel).join(", ")}`
      : null,
    creatorLevels.length
      ? `${t("ecommerce.affiliateCampaign.creatorLevels")}: ${creatorLevels.map(marketplaceEnumLabel).join(", ")}`
      : null,
    categoryPros.length
      ? `${t("ecommerce.affiliateCampaign.categoryPros")}: ${categoryPros.map(marketplaceEnumLabel).join(", ")}`
      : null,
    categories.length
      ? t("ecommerce.affiliateCampaign.categoryConditionCount", { count: categories.length })
      : null,
    contentRuleCount
      ? t("ecommerce.affiliateCampaign.contentConditionCount", { count: contentRuleCount })
      : null,
    affiliateRuleCount
      ? t("ecommerce.affiliateCampaign.affiliateConditionCount", {
          count: affiliateRuleCount,
        })
      : null,
  ].filter((item): item is string => Boolean(item));
}

function createDefaultDiscoveryRules(): GQL.AffiliateCampaignDiscoveryRulesInput {
  return {
    followerCount: { minimum: 1_000, maximum: null },
    audience: { ageRanges: [], genderDistribution: null },
    salesPerformance30d: { gmvRanges: [], unitsSoldRanges: [] },
    categories: [],
    contentPerformance30d: null,
    affiliatePerformance30d: null,
    marketSpecific: { languages: [], creatorLevels: [], categoryPros: [] },
  };
}

export function normalizeSuggestedDiscoveryRules(
  value:
    | GQL.AffiliateCampaignDiscoveryRules
    | GQL.AffiliateCampaignDiscoveryRulesInput
    | null
    | undefined,
): GQL.AffiliateCampaignDiscoveryRulesInput {
  const normalized = normalizeDiscoveryRules(value);
  return {
    ...normalized,
    affiliatePerformance30d: {
      ...normalized.affiliatePerformance30d,
      notInvitedLast90Days: false,
    },
  };
}

function normalizeDiscoveryRules(
  value:
    | GQL.AffiliateCampaignDiscoveryRules
    | GQL.AffiliateCampaignDiscoveryRulesInput
    | null
    | undefined,
): GQL.AffiliateCampaignDiscoveryRulesInput {
  const fallback = createDefaultDiscoveryRules();
  return {
    keyword: value?.keyword ?? null,
    followerCount: {
      minimum: value?.followerCount?.minimum ?? null,
      maximum: value?.followerCount?.maximum ?? null,
    },
    audience: {
      ageRanges: [...(value?.audience?.ageRanges ?? [])],
      genderDistribution: value?.audience?.genderDistribution
        ? {
            gender: value.audience.genderDistribution.gender,
            minimumPercentage: value.audience.genderDistribution.minimumPercentage,
          }
        : null,
    },
    salesPerformance30d: {
      gmvRanges: [...(value?.salesPerformance30d?.gmvRanges ?? [])],
      unitsSoldRanges: [...(value?.salesPerformance30d?.unitsSoldRanges ?? [])],
    },
    categories: (value?.categories ?? []).map((category) => ({
      parentCategoryId: category.parentCategoryId,
      childCategoryIds: [...(category.childCategoryIds ?? [])],
    })),
    contentPerformance30d: value?.contentPerformance30d
      ? { ...value.contentPerformance30d }
      : fallback.contentPerformance30d,
    affiliatePerformance30d: value?.affiliatePerformance30d
      ? { ...value.affiliatePerformance30d }
      : fallback.affiliatePerformance30d,
    marketSpecific: {
      languages: [...(value?.marketSpecific?.languages ?? [])],
      creatorLevels: [...(value?.marketSpecific?.creatorLevels ?? [])],
      categoryPros: [...(value?.marketSpecific?.categoryPros ?? [])],
    },
  };
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function toggleValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function marketplaceEnumLabel(value: string): string {
  return value
    .replace(/^(AGE_RANGE_|GMV_RANGE_|UNITS_SOLD_RANGE_)/, "")
    .replace(/_AND_ABOVE$/, "+")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function campaignStrategyLabel(
  strategy: GQL.AffiliateCampaignSelectionStrategy,
  t: (key: string) => string,
): string {
  return strategy === GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules
    ? t("ecommerce.affiliateCampaign.strategyRuleTitle")
    : t("ecommerce.affiliateCampaign.strategyMlTitle");
}

function campaignRuleSummary(
  campaign: GQL.AffiliateCampaign,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (
    campaign.selectionPolicy.strategy === GQL.AffiliateCampaignSelectionStrategy.ExpectedSales
  ) {
    return campaign.selectionPolicy.minimumExpectedSalesUnits == null
      ? t("ecommerce.affiliateCampaign.noExpectedSalesFloor")
      : t("ecommerce.affiliateCampaign.expectedSalesFloor", {
          count: campaign.selectionPolicy.minimumExpectedSalesUnits,
        });
  }
  const minimum = campaign.discoveryRules.followerCount?.minimum;
  const maximum = campaign.discoveryRules.followerCount?.maximum;
  if (minimum != null && maximum != null) {
    return t("ecommerce.affiliateCampaign.followerRangeCompact", {
      minimum: formatNumber(minimum),
      maximum: formatNumber(maximum),
    });
  }
  if (minimum != null) {
    return t("ecommerce.affiliateCampaign.minimumFollowersCompact", {
      value: formatNumber(minimum),
    });
  }
  return t("ecommerce.affiliateCampaign.providerOrderNoFollowerFloor");
}

function CampaignFunnel({
  counters,
  counterSchemaVersion,
  t,
}: {
  counters?: GQL.AffiliateCampaignExecutionCounters;
  counterSchemaVersion: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const legacyUnrecorded = counterSchemaVersion < 2;
  const acquisition = [
    ["scanned", counters?.scanned ?? 0],
    [
      "matched",
      campaignFunnelCounterValue({
        counterSchemaVersion,
        introducedInVersion: 2,
        value: counters?.matched ?? 0,
      }),
    ],
  ] as const;
  const blocked = [
    [
      "protected",
      campaignFunnelCounterValue({
        counterSchemaVersion,
        introducedInVersion: 2,
        value: counters?.protected ?? 0,
      }),
    ],
    [
      "outreachPolicyBlocked",
      campaignFunnelCounterValue({
        counterSchemaVersion,
        introducedInVersion: 2,
        value: counters?.outreachPolicyBlocked ?? 0,
      }),
    ],
  ] as const;
  const progression = [
    ["evaluated", counters?.evaluated ?? 0],
    [
      "qualificationFailed",
      campaignFunnelCounterValue({
        counterSchemaVersion,
        introducedInVersion: 2,
        value: counters?.qualificationFailed ?? 0,
      }),
    ],
    ["qualified", counters?.qualified ?? 0],
    ["selected", counters?.selected ?? 0],
    ["sent", counters?.sent ?? 0],
    ["replied", counters?.replied ?? 0],
  ] as const;
  return (
    <section className="affiliate-campaign-funnel">
      <div className="affiliate-campaign-section-heading">
        <div>
          <span>{t("ecommerce.affiliateCampaign.todayFunnel")}</span>
          <h3>{t("ecommerce.affiliateCampaign.discoveryToReply")}</h3>
          {legacyUnrecorded && (
            <small>{t("ecommerce.affiliateCampaign.legacyFunnelPartial")}</small>
          )}
        </div>
      </div>
      <div className="affiliate-campaign-funnel-groups">
        <FunnelGroup
          label={t("ecommerce.affiliateCampaign.funnel.providerSearch")}
          steps={acquisition}
          t={t}
        />
        <FunnelGroup
          label={t("ecommerce.affiliateCampaign.funnel.unreachable")}
          steps={blocked}
          variant="blocked"
          t={t}
        />
        <FunnelGroup
          label={t("ecommerce.affiliateCampaign.funnel.qualificationAndDelivery")}
          steps={progression}
          t={t}
        />
      </div>
    </section>
  );
}

function FunnelGroup({
  label,
  steps,
  variant = "progress",
  t,
}: {
  label: string;
  steps: ReadonlyArray<readonly [string, number | null]>;
  variant?: "progress" | "blocked";
  t: (key: string) => string;
}) {
  return (
    <div className={`affiliate-campaign-funnel-group is-${variant}`}>
      <span>{label}</span>
      <div>
        {steps.map(([key, value]) => (
          <article key={key}>
            <small>{t(`ecommerce.affiliateCampaign.funnel.${key}`)}</small>
            <strong
              title={
                value == null
                  ? t("ecommerce.affiliateCampaign.legacyMetricUnavailable")
                  : undefined
              }
            >
              {value == null ? "—" : formatNumber(value)}
            </strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function CampaignWizardSteps({ step, t }: { step: number; t: (key: string) => string }) {
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
          <div
            key={label}
            data-active={number === step || undefined}
            data-complete={number < step || undefined}
          >
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

function campaignStatusLabel(status: GQL.AffiliateCampaignStatus, t: (key: string) => string) {
  return t(`ecommerce.affiliateCampaign.status.${status.toLowerCase()}`);
}

export function campaignShopDisplayName(
  shop: Pick<GQL.Shop, "alias" | "shopName"> | null | undefined,
  fallback: string,
): string {
  return shop?.alias?.trim() || shop?.shopName?.trim() || fallback;
}

function campaignProductReference(
  campaign: Pick<GQL.AffiliateCampaign, "primaryProductId" | "productSnapshot">,
  t: (key: string) => string,
): string {
  const sellerSkus = [
    ...new Set(
      (campaign.productSnapshot?.sellerSkus ?? [])
        .map((sellerSku) => sellerSku.trim())
        .filter(Boolean),
    ),
  ];
  if (sellerSkus.length === 0) {
    return `${t("ecommerce.affiliateCampaign.productIdLabel")} · ${campaign.primaryProductId}`;
  }
  const remaining = sellerSkus.length - 1;
  return `${t("ecommerce.affiliateCampaign.skuLabel")} · ${sellerSkus[0]}${
    remaining > 0 ? ` +${remaining}` : ""
  }`;
}

function isTerminalCampaignStatus(status: GQL.AffiliateCampaignStatus): boolean {
  return (
    status === GQL.AffiliateCampaignStatus.Archived ||
    status === GQL.AffiliateCampaignStatus.Completed
  );
}

function campaignStateLabel(status: string, t: (key: string) => string) {
  return t(`ecommerce.affiliateCampaign.creatorState.${status.toLowerCase()}`);
}

function eligibilityCategoryLabel(category: string, t: (key: string) => string) {
  return t(`ecommerce.affiliateCampaign.eligibilityCategory.${category.toLowerCase()}`);
}

export function eligibilityReasonLabel(reason: string, t: (key: string) => string) {
  return t(`ecommerce.affiliateCampaign.eligibilityReason.${reason.toLowerCase()}`);
}

function executionStatusLabel(
  status: GQL.AffiliateCampaignDailyExecutionStatus,
  t: (key: string) => string,
) {
  return t(`ecommerce.affiliateCampaign.executionStatus.${status.toLowerCase()}`);
}

function campaignCommissionRate(campaign: GQL.AffiliateCampaign): number {
  const value = Number(
    (campaign as GQL.AffiliateCampaign & { commissionRatePercent?: number }).commissionRatePercent,
  );
  return Number.isFinite(value) ? value : 10;
}

export function estimateCampaignCadence(target: number, submitted: number) {
  const remaining = Math.max(0, target - submitted);
  return (remaining / 12).toFixed(1);
}

export function campaignCreatorStatesViewState(input: {
  loading: boolean;
  hasError: boolean;
  itemCount: number;
}): "loading" | "error" | "empty" | "ready" {
  if (input.loading) return "loading";
  if (input.hasError) return "error";
  return input.itemCount > 0 ? "ready" : "empty";
}

export function campaignFunnelCounterValue(input: {
  counterSchemaVersion: number;
  value: number;
  introducedInVersion?: number;
}): number | null {
  return input.counterSchemaVersion < (input.introducedInVersion ?? 1)
    ? null
    : input.value;
}

export function isEnglishCampaignSearchPhrase(value: string): boolean {
  if (value.length < 2 || value.length > 80) return false;
  if (/[^\p{Script=Latin}\p{Mark}\p{Number}\s&'+,./()\-–—]/u.test(value)) {
    return false;
  }
  const words = value.match(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}'’-]*/gu) ?? [];
  return words.length >= 2 && words.length <= 8;
}

export function campaignErrorMessage(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const raw = error instanceof Error ? error.message : String(error);
  const mappings: Array<[string, string]> = [
    ["EXPECTED_SALES_V3_MODEL_NOT_READY", "modelNotReady"],
    ["CAMPAIGN_DRAFT_DELETE_ONLY", "draftDeleteOnly"],
    ["CAMPAIGN_DRAFT_HAS_HISTORY", "draftHasHistory"],
    ["CAMPAIGN_RECONFIGURATION_REQUIRED", "reconfigurationRequired"],
    ["CAMPAIGN_SEARCH_PHRASES_REQUIRED", "invalidSearchPhrases"],
    ["CAMPAIGN_AI_SUGGESTION_TIMEOUT", "suggestionTimeout"],
    ["CAMPAIGN_AI_SUGGESTION_INVALID", "suggestionInvalid"],
    ["CAMPAIGN_AI_SUGGESTION_FAILED", "suggestionFailed"],
    ["CAMPAIGN_COPY_REQUIRED", "copyRequired"],
    ["PRODUCT_SNAPSHOT_REF_INVALID", "productSnapshotExpired"],
    ["CAMPAIGN_TEMPLATE_NOT_DISTINCT", "templateNotDistinct"],
  ];
  const match = mappings.find(([code]) => raw.includes(code));
  return match
    ? t(`ecommerce.affiliateCampaign.errors.${match[1]}`)
    : t("ecommerce.affiliateCampaign.errors.generic");
}

function campaignReadinessMessage(
  reasonCode: string | null | undefined,
  t: (key: string) => string,
): string {
  if (reasonCode === "MODEL_UPGRADING") {
    return t("ecommerce.affiliateCampaign.errors.modelNotReady");
  }
  if (reasonCode === "MARKETPLACE_RULE_UNSUPPORTED") {
    return t("ecommerce.affiliateCampaign.errors.providerRuleUnsupported");
  }
  return t("ecommerce.affiliateCampaign.errors.reconfigurationRequired");
}

function campaignRiskLabel(
  riskState: string | null | undefined,
  t: (key: string) => string,
): string {
  if (riskState === "CIRCUIT_OPEN") {
    return t("ecommerce.affiliateCampaign.riskCircuitOpen");
  }
  if (riskState === "THROTTLED") {
    return t("ecommerce.affiliateCampaign.riskThrottled");
  }
  return t("ecommerce.affiliateCampaign.riskNormal");
}

function campaignExecutionReasonLabel(reason: string, t: (key: string) => string): string {
  if (reason === "INSUFFICIENT_QUALIFIED_CREATORS") {
    return t("ecommerce.affiliateCampaign.underDeliveryInsufficientCreators");
  }
  if (reason === "OUTREACH_WINDOW_CLOSED") {
    return t("ecommerce.affiliateCampaign.underDeliveryWindowClosed");
  }
  return t("ecommerce.affiliateCampaign.underDeliveryGeneric");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatOptionalNumber(value?: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
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

function campaignOutreachDisposition(status: string): "reached" | "hold" | "not_reached" {
  if (
    status === GQL.AffiliateCampaignCreatorStateStatus.ReachedOut ||
    status === GQL.AffiliateCampaignCreatorStateStatus.Replied
  ) {
    return "reached";
  }
  if (
    status === GQL.AffiliateCampaignCreatorStateStatus.Disqualified ||
    status === GQL.AffiliateCampaignCreatorStateStatus.IneligibleProtected ||
    status === GQL.AffiliateCampaignCreatorStateStatus.IneligibleOutreachPolicy ||
    status === GQL.AffiliateCampaignCreatorStateStatus.IneligibleQualification ||
    status === GQL.AffiliateCampaignCreatorStateStatus.Ignored ||
    status === GQL.AffiliateCampaignCreatorStateStatus.Cancelled ||
    status === GQL.AffiliateCampaignCreatorStateStatus.Failed
  ) {
    return "not_reached";
  }
  return "hold";
}

function formatDecisionReason(value?: string | null) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
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
