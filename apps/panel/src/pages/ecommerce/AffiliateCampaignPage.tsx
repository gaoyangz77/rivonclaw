import { useEffect, useRef, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import panelI18n from "../../i18n/index.js";
import { formatShortDateTime } from "../../lib/format-datetime.js";
import { GQL } from "@rivonclaw/core";
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  RefreshIcon,
  ShopIcon,
  UserPlusIcon,
} from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.js";
import { RemoteMediaImage } from "../../components/images/RemoteMediaImage.js";
import { TkConfirmDialog as ConfirmDialog } from "../../components/design-system/index.js";
import { TkModal as Modal } from "../../components/design-system/index.js";
import { useToast } from "../../components/Toast.js";
import {
  TkButton,
  TkInteractiveTableRow,
  TkPanel,
  TkPanelHeader,
  TkTableFrame,
} from "../../components/design-system/index.js";
import {
  CreatorRelationshipDetailModal,
  type CreatorRelationshipDetailItem,
} from "./AffiliateManagementPage.js";
import { AffiliateMetricLabel } from "./components/AffiliateMetricLabel.js";
import { AffiliatePageFrame, AffiliatePageHeader } from "./components/AffiliateUi.js";
import "./components/AffiliateUi.css";
import { generateAffiliateCampaignMessageTemplate } from "../../api/affiliate-campaign-ai.js";
import {
  AFFILIATE_CAMPAIGNS_QUERY,
  AFFILIATE_CAMPAIGN_SELECTION_READINESS_QUERY,
  AFFILIATE_CAMPAIGN_AI_READINESS_QUERY,
  AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY,
  AFFILIATE_CAMPAIGN_SEARCH_PLAN_SUMMARIES_QUERY,
  AFFILIATE_CAMPAIGN_SUMMARY_QUERY,
  AFFILIATE_PRODUCT_SUMMARIES_QUERY,
  AFFILIATE_MARKETPLACE_RULE_CAPABILITIES_QUERY,
  DELETE_AFFILIATE_CAMPAIGN_DRAFT_MUTATION,
  DUPLICATE_AFFILIATE_CAMPAIGN_MUTATION,
  AFFILIATE_CAMPAIGN_PRODUCT_PREVIEW_QUERY,
  SET_AFFILIATE_CAMPAIGN_STATUS_MUTATION,
  RETRY_AFFILIATE_CAMPAIGN_SEARCH_PLAN_MUTATION,
  SHOPS_QUERY,
  WRITE_AFFILIATE_CAMPAIGN_MUTATION,
} from "../../api/shops-queries.js";

/**
 * One row of the offer. The first row is the product discovery searches on and
 * the message names, so its order in this list is meaningful.
 */
type CampaignProductForm = {
  productId: string;
  commissionRate: string;
  shopAdsCommissionRate: string;
};

type CampaignForm = {
  shopId: string;
  products: CampaignProductForm[];
  name: string;
  dailyTarget: string;
  endDays: string;
  isSampleApprovalExempt: boolean;
  sellerContactEmail: string;
  minimumFollowers: string;
  maximumFollowers: string;
  refreshProductSnapshot: boolean;
  searchPlanGuidance: string;
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
  products: [{ productId: "", commissionRate: "10", shopAdsCommissionRate: "10" }],
  name: "",
  dailyTarget: "100",
  endDays: "30",
  isSampleApprovalExempt: false,
  sellerContactEmail: "",
  minimumFollowers: "1000",
  maximumFollowers: "",
  refreshProductSnapshot: false,
  searchPlanGuidance: "",
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

/**
 * Which pane of the search workspace is on screen. The Creator table is the
 * home view; the search-conditions list is a secondary pane used to narrow it.
 */
type CampaignSearchWorkspaceView = "creators" | "conditions";

const stateStatusOptions = Object.values(GQL.AffiliateCampaignCreatorStateStatus);

/**
 * "Sent" in the operator's vocabulary: the invitation reached the Creator,
 * whether or not they have replied yet. Mirrors `campaignOutreachDisposition`'s
 * "reached" bucket so the preset and the disposition column agree.
 */
export const SENT_CREATOR_STATE_STATUSES: readonly GQL.AffiliateCampaignCreatorStateStatus[] = [
  GQL.AffiliateCampaignCreatorStateStatus.ReachedOut,
  GQL.AffiliateCampaignCreatorStateStatus.Replied,
];

export function isSentCreatorStatePreset(
  selected: readonly GQL.AffiliateCampaignCreatorStateStatus[],
): boolean {
  return (
    selected.length === SENT_CREATOR_STATE_STATUSES.length &&
    SENT_CREATOR_STATE_STATUSES.every((status) => selected.includes(status))
  );
}

/**
 * Returns the current selection untouched when it already equals the preset so
 * a repeated click is a no-op for React state, and the preset otherwise.
 */
export function applySentCreatorStatePreset(
  current: GQL.AffiliateCampaignCreatorStateStatus[],
): GQL.AffiliateCampaignCreatorStateStatus[] {
  return isSentCreatorStatePreset(current) ? current : [...SENT_CREATOR_STATE_STATUSES];
}

const eligibilityCategoryOptions = Object.values(GQL.AffiliateCampaignEligibilityCategory);
const eligibilityReasonOptions = [
  "PROTECTION_LIST",
  "NO_CAMPAIGN_DISTURB",
  "SAME_PRODUCT_ALREADY_CONTACTED",
  "SAME_PRODUCT_RESERVED_OR_SUBMITTED",
  "SHOP_CREATOR_7D_LIMIT",
  "SHOP_CREATOR_30D_LIMIT",
  "CAMPAIGN_ALREADY_CONTACTED",
  "PROVIDER_RESULT_INVALID",
  "FOLLOWER_DATA_REQUIRED",
  "PRE_APPROVAL_REJECTED",
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

type CampaignSearchPlanView = {
  id: string;
  generation: number;
  status: string;
  generatedBy?: {
    source: "BACKEND_CLOUD" | "DESKTOP";
    requestedModel?: string | null;
    resolvedModel?: string | null;
    completedAt: string;
  } | null;
  phrase?: { text: string; explanation: string; explanationLocale: string } | null;
  discoveryRules?: GQL.AffiliateCampaignDiscoveryRules | null;
  guidanceInterpretation?: {
    sourceGuidanceHash: string;
    softDirections: string[];
    hardConstraints?: GQL.AffiliateCampaignDiscoveryRules | null;
  } | null;
  pageSequence: number;
  totals: {
    scanned: number;
    matched: number;
    protected: number;
    outreachPolicyBlocked: number;
    qualificationFailed: number;
    qualified: number;
    scheduled: number;
  };
  blockStage?: string | null;
  errorCode?: string | null;
  completionReason?: string | null;
  generatedAt: string;
  startedAt?: string | null;
  lastSearchedAt?: string | null;
  completedAt?: string | null;
};

type CampaignSearchPlanSummaryView = {
  plan: CampaignSearchPlanView;
  duplicateCount: number;
  delivery: {
    submitted: number;
    sent: number;
    failed: number;
    failureReasons: Array<{ code: string; count: number }>;
  };
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

export function countDistinctActiveCampaignShops(
  campaigns: ReadonlyArray<Pick<GQL.AffiliateCampaign, "shopId" | "status">>,
): number {
  return new Set(
    campaigns
      .filter((campaign) => campaign.status === GQL.AffiliateCampaignStatus.Active)
      .map((campaign) => campaign.shopId)
      .filter(Boolean),
  ).size;
}

const CAMPAIGN_TEMPLATE_VARIABLES = new Set(["creator_name", "product_name", "shop_name"]);

export function unsupportedAffiliateCampaignTemplateVariables(value: string): string[] {
  const unsupported = new Set<string>();
  for (const match of value.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)) {
    const variable = match[1]?.trim();
    if (variable && !CAMPAIGN_TEMPLATE_VARIABLES.has(variable)) unsupported.add(variable);
  }
  return [...unsupported];
}

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
  const [selectedSearchPlanId, setSelectedSearchPlanId] = useState("");
  const [searchWorkspaceView, setSearchWorkspaceView] =
    useState<CampaignSearchWorkspaceView>("creators");
  const searchWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [messageTemplateOpen, setMessageTemplateOpen] = useState(false);
  const [selectedCreatorDetail, setSelectedCreatorDetail] =
    useState<CreatorRelationshipDetailItem | null>(null);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignStatusFilters, setCampaignStatusFilters] = useState<GQL.AffiliateCampaignStatus[]>(
    () => [...DEFAULT_CAMPAIGN_STATUS_FILTERS],
  );
  const [stateStatuses, setStateStatuses] = useState<GQL.AffiliateCampaignCreatorStateStatus[]>([]);
  const [eligibilityCategories, setEligibilityCategories] = useState<
    GQL.AffiliateCampaignEligibilityCategory[]
  >([]);
  const [eligibilityReasons, setEligibilityReasons] = useState<string[]>([]);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  // Keyed by product id so each row can show what it resolved to. The lead
  // product's entry is also what the backend freezes as the Campaign snapshot.
  const [productPreviews, setProductPreviews] = useState<Record<string, CampaignProductPreview>>(
    {},
  );
  const [fetchingProductId, setFetchingProductId] = useState("");
  const [pendingProductResolution, setPendingProductResolution] =
    useState<CampaignProductPreview | null>(null);
  const [confirmation, setConfirmation] = useState<
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
  // Readiness is read once for the page, not per Campaign: the artifact is
  // resolved at user scope, so the answer is the same for every Campaign here.
  const aiReadinessQuery = useQuery<{
    affiliateCampaignAiReadiness: GQL.AffiliateCampaignAiReadiness;
  }>(AFFILIATE_CAMPAIGN_AI_READINESS_QUERY, { fetchPolicy: "cache-and-network" });
  const aiReadiness = aiReadinessQuery.data?.affiliateCampaignAiReadiness ?? null;
  const aiReadinessLoading = aiReadinessQuery.loading && !aiReadiness;
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
  // Campaign-wide by default; a selected search plan narrows the same query.
  const creatorStatesQuery = useQuery<{
    affiliateCampaignCreatorStates: CampaignCreatorStatePage;
  }>(AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY, {
    variables: {
      input: {
        campaignId: selectedCampaignId,
        limit: 50,
        ...(selectedSearchPlanId ? { searchPlanId: selectedSearchPlanId } : {}),
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
  const searchPlansQuery = useQuery<{
    affiliateCampaignSearchPlanSummaries: {
      items: CampaignSearchPlanSummaryView[];
      nextCursor?: string | null;
    };
  }>(AFFILIATE_CAMPAIGN_SEARCH_PLAN_SUMMARIES_QUERY, {
    variables: { input: { campaignId: selectedCampaignId, limit: 20 } },
    skip: !selectedCampaignId,
    // Search-plan history is an operator view, not a dispatch control loop.
    // Mutations still refetch immediately; the background refresh can be
    // slower and should stop entirely while the page is not visible.
    pollInterval: selectedCampaignId ? 60_000 : 0,
    skipPollAttempt: () => document.visibilityState === "hidden",
  });
  const creatorStatesViewState = campaignCreatorStatesViewState({
    loading: creatorStatesQuery.loading,
    hasError: Boolean(creatorStatesQuery.error),
    itemCount: creatorStatesQuery.data?.affiliateCampaignCreatorStates?.items.length ?? 0,
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
  const [retrySearchPlan, retrySearchPlanState] = useMutation(
    RETRY_AFFILIATE_CAMPAIGN_SEARCH_PLAN_MUTATION,
  );

  const campaigns = campaignsQuery.data?.affiliateCampaigns ?? [];
  const campaignPortfolio = campaignPortfolioQuery.data?.affiliateCampaigns ?? [];
  const campaignPageCount = Math.max(1, Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE));
  const campaignPageStart = (campaignPage - 1) * CAMPAIGNS_PER_PAGE;
  const visibleCampaigns = paginateCampaigns(campaigns, campaignPage);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const selectedCampaignProductRefs =
    selectedCampaign?.products.map((product) => ({
      shopId: selectedCampaign.shopId,
      productId: product.productId,
    })) ?? [];
  const { data: selectedCampaignProductData } = useQuery<
    { affiliateProductSummaries: GQL.AffiliateRelationshipProductSummary[] },
    { input: GQL.AffiliateProductSummaryBatchInput }
  >(AFFILIATE_PRODUCT_SUMMARIES_QUERY, {
    variables: { input: { refs: selectedCampaignProductRefs } },
    skip: selectedCampaignProductRefs.length === 0,
    fetchPolicy: "cache-first",
  });
  const selectedCampaignProductSummaries =
    selectedCampaignProductData?.affiliateProductSummaries ?? [];
  const editingCampaign = campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null;
  const summary = summaryQuery.data?.affiliateCampaignSummary;
  const latestExecution = summary?.latestExecution;
  const targetCollaborationQuota = summary?.targetCollaborationCreateQuota;
  const targetCollaborationQuotaRecovered = Boolean(
    targetCollaborationQuota &&
    !targetCollaborationQuota.active &&
    targetCollaborationQuota.lastObservedAt &&
    targetCollaborationQuota.lastSuccessfulCreateAt &&
    new Date(targetCollaborationQuota.lastSuccessfulCreateAt).getTime() >
      new Date(targetCollaborationQuota.lastObservedAt).getTime(),
  );
  const shops = (shopsQuery.data?.shops ?? []).filter(
    (shop) =>
      shop.platform === GQL.ShopPlatform.TiktokShop &&
      shop.authStatus === GQL.ShopAuthStatus.Authorized &&
      shop.services?.affiliateService?.enabled === true,
  );
  const selectedShop = shops.find((shop) => shop.id === form.shopId);
  const selectedCampaignShop = shops.find((shop) => shop.id === selectedCampaign?.shopId);
  const capabilities = capabilitiesQuery.data?.affiliateMarketplaceCreatorRuleCapabilities;
  const selectionReadiness = selectionReadinessQuery.data?.affiliateCampaignSelectionReadiness;
  const searchPlanSummaries =
    searchPlansQuery.data?.affiliateCampaignSearchPlanSummaries?.items ?? [];
  const selectedSearchPlanSummary =
    searchPlanSummaries.find((summaryItem) => summaryItem.plan.id === selectedSearchPlanId) ?? null;
  const currentSearchPlan = selectedSearchPlanSummary?.plan ?? null;
  const activeSearchPlan =
    searchPlanSummaries.find(
      (summaryItem) => summaryItem.plan.id === selectedCampaign?.searchPlanning.activePlanId,
    )?.plan ?? null;

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
    setSelectedCreatorDetail(null);
    setSelectedSearchPlanId("");
    setSearchWorkspaceView("creators");
    setMessageTemplateOpen(false);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedSearchPlanId) return;
    if (searchPlanSummaries.some((item) => item.plan.id === selectedSearchPlanId)) return;
    setSelectedSearchPlanId("");
  }, [searchPlanSummaries, selectedSearchPlanId]);

  useEffect(() => {
    setSelectedCreatorDetail(null);
  }, [selectedSearchPlanId]);

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
    setProductPreviews({});
    setPendingProductResolution(null);
    setEditingCampaignId("");
    setWizardStep(1);
    setWizardOpen(true);
  };

  const openEdit = (campaign: GQL.AffiliateCampaign) => {
    setForm({
      shopId: campaign.shopId,
      products: campaign.products.map((product) => ({
        productId: product.productId,
        commissionRate: String(product.commissionRatePercent),
        shopAdsCommissionRate: String(
          product.shopAdsCommissionRatePercent ?? product.commissionRatePercent,
        ),
      })),
      name: campaign.name,
      dailyTarget: String(campaign.dailyOutreachTarget),
      endDays: String(campaign.endDays ?? 30),
      isSampleApprovalExempt: Boolean(campaign.isSampleApprovalExempt),
      sellerContactEmail: campaign.sellerContactEmail ?? "",
      minimumFollowers: "",
      maximumFollowers: "",
      refreshProductSnapshot: false,
      searchPlanGuidance: campaign.searchPlanGuidance ?? "",
      strategy: campaign.selectionPolicy.strategy,
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
      templateText: campaign.messageTemplateText,
      templateGuidance: "",
      templateSource: campaign.messageTemplateSource,
      messageProductName:
        campaign.messageProductName ||
        campaign.productSnapshot?.title ||
        campaignLeadProductId(campaign),
    });
    setEditingCampaignId(campaign.id);
    // Only the lead product has a stored snapshot; the other rows show nothing
    // until the seller fetches them.
    setProductPreviews(
      campaign.productSnapshot
        ? { [campaign.productSnapshot.productId]: campaign.productSnapshot }
        : {},
    );
    setPendingProductResolution(null);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const updateForm = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const leadProductId = form.products[0]?.productId.trim() ?? "";
  const productPreview = leadProductId ? (productPreviews[leadProductId] ?? null) : null;

  const updateProduct = (index: number, patch: Partial<CampaignProductForm>) => {
    setForm((current) => ({
      ...current,
      products: current.products.map((product, position) =>
        position === index ? { ...product, ...patch } : product,
      ),
    }));
  };

  const addProduct = () => {
    setForm((current) => ({
      ...current,
      products: [
        ...current.products,
        {
          productId: "",
          commissionRate: "10",
          shopAdsCommissionRate: "10",
        },
      ],
    }));
  };

  const removeProduct = (index: number) => {
    setForm((current) => ({
      ...current,
      // The first row drives discovery and the message, so dropping it promotes
      // the next one rather than leaving the Campaign without a lead product.
      products:
        current.products.length > 1
          ? current.products.filter((_product, position) => position !== index)
          : current.products,
    }));
  };

  const productsInvalid =
    form.products.some((product) => {
      return (
        !product.productId.trim() ||
        !isAffiliateCampaignCommissionRateValid(product.commissionRate) ||
        !isAffiliateCampaignCommissionRateValid(product.shopAdsCommissionRate)
      );
    }) ||
    new Set(form.products.map((product) => product.productId.trim())).size !== form.products.length;
  const unsupportedTemplateVariables = unsupportedAffiliateCampaignTemplateVariables(
    form.templateText,
  );

  const validateStep = () => {
    if (
      wizardStep === 1 &&
      (!form.shopId ||
        !leadProductId ||
        productsInvalid ||
        !form.name.trim() ||
        productPreview?.productId !== leadProductId)
    ) {
      showToast(t("ecommerce.affiliateCampaign.completeShopProduct"), "error");
      return false;
    }
    if (
      wizardStep === 2 &&
      (Number(form.dailyTarget) < 1 ||
        productsInvalid ||
        !Number.isInteger(Number(form.endDays)) ||
        Number(form.endDays) < 1 ||
        Number(form.endDays) > 365 ||
        !form.sellerContactEmail.trim())
    ) {
      showToast(t("ecommerce.affiliateCampaign.invalidTargets"), "error");
      return false;
    }
    if (
      wizardStep === 2 &&
      !selectedShop?.services?.affiliateService?.campaignDailyCreatorOutreachLimit
    ) {
      showToast(t("ecommerce.affiliateCampaign.dailyCreatorOutreachLimitRequired"), "error");
      return false;
    }
    if (wizardStep === 3 && !form.templateText.trim()) {
      showToast(t("ecommerce.affiliateCampaign.templateRequired"), "error");
      return false;
    }
    if (wizardStep >= 3 && unsupportedTemplateVariables.length > 0) return false;
    if (wizardStep === 2 && form.searchPlanGuidance.length > 500) return false;
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setWizardStep((step) => Math.min(4, step + 1));
  };

  const fetchProduct = async (index: number) => {
    const productId = form.products[index]?.productId.trim() ?? "";
    if (!form.shopId || !productId) {
      showToast(t("ecommerce.affiliateCampaign.completeShopProduct"), "error");
      return;
    }
    setFetchingProductId(productId);
    try {
      const result = await resolveProduct({
        variables: { input: { shopId: form.shopId, productId } },
      });
      const preview = result.data?.affiliateCampaignProductPreview;
      if (!preview) throw new Error(t("ecommerce.affiliateCampaign.productFetchFailed"));
      // Only the lead product is frozen onto the Campaign, so only it can
      // present the seller with a "this product changed" decision.
      if (index === 0 && productPreview && productPreview.snapshotHash !== preview.snapshotHash) {
        setPendingProductResolution(preview);
        return;
      }
      applyProductResolution(preview, index);
      showToast(t("ecommerce.affiliateCampaign.productFetched"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    } finally {
      setFetchingProductId("");
    }
  };

  const applyProductResolution = (preview: CampaignProductPreview, index = 0) => {
    setForm((current) => ({
      ...current,
      products: current.products.map((product, position) =>
        position === index ? { ...product, productId: preview.productId } : product,
      ),
      ...(index === 0 ? { refreshProductSnapshot: true, messageProductName: "" } : {}),
    }));
    setProductPreviews((current) => ({ ...current, [preview.productId]: preview }));
    setPendingProductResolution(null);
  };

  const createCampaign = async () => {
    if (!validateStep()) return;
    if (!productPreview) return;
    try {
      const campaignInput = {
        ...(editingCampaignId ? { id: editingCampaignId } : {}),
        shopId: form.shopId,
        name: form.name.trim(),
        products: form.products.map((product) => ({
          productId: product.productId.trim(),
          commissionRatePercent: Number(product.commissionRate),
          shopAdsCommissionRatePercent: Number(product.shopAdsCommissionRate),
        })),
        refreshProductSnapshot: form.refreshProductSnapshot,
        searchPlanGuidance: form.searchPlanGuidance.trim() || null,
        searchPlanExplanationLocale: normalizeCampaignExplanationLocale(
          i18n.resolvedLanguage ?? i18n.language,
        ),
        dailyOutreachTarget: Number(form.dailyTarget),
        endDays: Number(form.endDays),
        isSampleApprovalExempt: form.isSampleApprovalExempt,
        sellerContactEmail: form.sellerContactEmail.trim(),
        // Both modes take Creators in Marketplace order; AI mode only adds a
        // pre-screen. There is no seller-set threshold to send any more.
        selectionPolicy: { strategy: form.strategy },
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
        productId: leadProductId,
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
    const campaignShop = shops.find((shop) => shop.id === campaign.shopId);
    if (
      nextStatus === GQL.AffiliateCampaignStatus.Active &&
      !campaignShop?.services?.affiliateService?.campaignDailyCreatorOutreachLimit
    ) {
      showToast(t("ecommerce.affiliateCampaign.dailyCreatorOutreachLimitRequired"), "error");
      return;
    }
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
    if (pending.kind === "archive") {
      void executeArchiveCampaign(pending.campaignId);
      return;
    }
    void executeDeleteDraftCampaign(pending.campaignId);
  };

  const activeCampaigns = campaignPortfolio.filter(
    (campaign) => campaign.status === GQL.AffiliateCampaignStatus.Active,
  );
  const activeCount = activeCampaigns.length;
  const activeShopCount = countDistinctActiveCampaignShops(activeCampaigns);
  const dailyTargetTotal = activeCampaigns.reduce(
    (sum, campaign) => sum + campaign.dailyOutreachTarget,
    0,
  );

  const loadMoreCreatorStates = async () => {
    const nextCursor = creatorStatesQuery.data?.affiliateCampaignCreatorStates?.nextCursor;
    if (!nextCursor) return;
    await creatorStatesQuery.fetchMore({
      variables: {
        input: {
          campaignId: selectedCampaignId,
          limit: 50,
          cursor: nextCursor,
          ...(selectedSearchPlanId ? { searchPlanId: selectedSearchPlanId } : {}),
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

  // Search-workspace navigation. A selected search plan only exists while the
  // Creator table is on screen, so leaving for the conditions pane clears it.
  const openSearchConditions = () => {
    setSelectedSearchPlanId("");
    setSearchWorkspaceView("conditions");
  };
  const showCampaignCreators = () => {
    setSelectedSearchPlanId("");
    setSearchWorkspaceView("creators");
  };
  const showSearchPlanCreators = (planId: string) => {
    setSelectedSearchPlanId(planId);
    setSearchWorkspaceView("creators");
  };
  const showSentCreators = () => {
    setStateStatuses(applySentCreatorStatePreset);
    showCampaignCreators();
    searchWorkspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadMoreSearchPlans = async () => {
    const nextCursor = searchPlansQuery.data?.affiliateCampaignSearchPlanSummaries?.nextCursor;
    if (!nextCursor || !selectedCampaignId) return;
    await searchPlansQuery.fetchMore({
      variables: {
        input: {
          campaignId: selectedCampaignId,
          limit: 20,
          cursor: nextCursor,
        },
      },
      updateQuery: (previous, { fetchMoreResult }) => ({
        affiliateCampaignSearchPlanSummaries: {
          ...fetchMoreResult.affiliateCampaignSearchPlanSummaries,
          items: [
            ...previous.affiliateCampaignSearchPlanSummaries.items,
            ...fetchMoreResult.affiliateCampaignSearchPlanSummaries.items,
          ],
        },
      }),
    });
  };

  const retryCurrentSearchPlan = async () => {
    if (!selectedCampaignId) return;
    try {
      await retrySearchPlan({ variables: { campaignId: selectedCampaignId } });
      await Promise.all([searchPlansQuery.refetch(), campaignsQuery.refetch()]);
      showToast(t("ecommerce.affiliateCampaign.searchPlanRetryScheduled"), "success");
    } catch (error) {
      showToast(campaignErrorMessage(error, t), "error");
    }
  };

  const copyFirstMessage = async () => {
    if (!selectedCampaign) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(t("ecommerce.affiliateCampaign.firstMessageCopyFailed"));
      }
      await navigator.clipboard.writeText(selectedCampaign.messageTemplateText);
      showToast(t("ecommerce.affiliateCampaign.firstMessageCopied"), "success");
    } catch {
      showToast(t("ecommerce.affiliateCampaign.firstMessageCopyFailed"), "error");
    }
  };

  const copyCampaignProductId = async (productId: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(productId);
      showToast(t("common.copied"), "success");
    } catch {
      showToast(t("ecommerce.affiliateWorkspace.copyFailed"), "error");
    }
  };

  const campaignDetailActions = selectedCampaign ? (
    <div className="affiliate-campaign-detail-actions affiliate-campaign-detail-actions-card">
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
  ) : null;

  return (
    <AffiliatePageFrame className="affiliate-campaign-page">
      <AffiliatePageHeader
        className="affiliate-campaign-hero"
        data-tutorial-id="affiliate-campaign-header"
        eyebrow={t("ecommerce.affiliateCampaign.eyebrow")}
        title={t("ecommerce.affiliateCampaign.title")}
        subtitle={t("ecommerce.affiliateCampaign.subtitle")}
        actions={
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
        }
      />

      <section
        className="affiliate-campaign-command-strip"
        data-tutorial-id="affiliate-campaign-summary"
      >
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
          label={t("ecommerce.affiliateCampaign.activeShops")}
          value={activeShopCount}
          detail={t("ecommerce.affiliateCampaign.activeShopsDescription")}
        />
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
      </section>

      {campaignPortfolio.length === 0 && campaignPortfolioQuery.loading ? (
        <TkPanel
          as="section"
          padding="none"
          clip
          className="affiliate-campaign-directory"
          data-tutorial-id="affiliate-campaign-directory"
        >
          <LoadingSpinner variant="page" />
        </TkPanel>
      ) : campaignPortfolio.length === 0 ? (
        <section
          className="affiliate-campaign-empty"
          data-tutorial-id="affiliate-campaign-directory"
        >
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
        <TkPanel
          as="section"
          padding="none"
          clip
          className="affiliate-campaign-directory"
          data-tutorial-id="affiliate-campaign-directory"
        >
          <TkPanelHeader
            className="affiliate-campaign-directory-header"
            headingLevel={2}
            eyebrow={t("ecommerce.affiliateCampaign.portfolio")}
            title={t("ecommerce.affiliateCampaign.campaignTableTitle")}
            description={t("ecommerce.affiliateCampaign.campaignTableDescription")}
            actions={
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
            }
          />
          <TkTableFrame variant="embedded" className="affiliate-campaign-directory-table-wrap">
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
                    <TkInteractiveTableRow
                      key={campaign.id}
                      data-tutorial-id="affiliate-campaign-item"
                      onActivate={() => setSelectedCampaignId(campaign.id)}
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
                            {campaign.productSnapshot?.title?.trim() ||
                              campaignLeadProductId(campaign)}
                          </strong>
                          <small title={campaignProductReference(campaign, t)}>
                            {campaignProductReference(campaign, t)}
                          </small>
                        </div>
                      </td>
                      <td>
                        <ChevronRightIcon />
                      </td>
                    </TkInteractiveTableRow>
                  );
                })}
              </tbody>
            </table>
          </TkTableFrame>
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
        </TkPanel>
      )}

      <Modal
        isOpen={Boolean(selectedCampaign)}
        onClose={() => setSelectedCampaignId("")}
        title={
          selectedCampaign
            ? `${selectedCampaign.name} - ${campaignShopDisplayName(
                selectedCampaignShop,
                selectedCampaign.shopId,
              )}`
            : t("ecommerce.affiliateCampaign.detailTitle")
        }
        hideCloseButton
        bodyLeadContent={
          selectedCampaign ? (
            <div
              className="affiliate-campaign-modal-lead"
              data-tutorial-id="affiliate-campaign-detail-overview"
            >
              <section className="affiliate-campaign-modal-overview">
                <div className="affiliate-campaign-modal-overview-top">
                  <div className="affiliate-campaign-modal-identity">
                    <div className="affiliate-campaign-modal-product-image">
                      {selectedCampaign.productSnapshot?.coverImage ? (
                        <RemoteMediaImage
                          sourceUrl={selectedCampaign.productSnapshot.coverImage}
                          alt={selectedCampaign.productSnapshot.title}
                          loading="lazy"
                        />
                      ) : (
                        <ShopIcon />
                      )}
                    </div>
                    <div className="affiliate-campaign-modal-identity-copy">
                      <div className="affiliate-campaign-modal-campaign-heading">
                        <strong className="affiliate-campaign-modal-campaign-name">
                          {selectedCampaign.name}
                        </strong>
                        <span
                          className={`affiliate-campaign-status is-${selectedCampaign.status.toLowerCase()}`}
                        >
                          {campaignStatusLabel(selectedCampaign.status, t)}
                        </span>
                      </div>
                      <div className="affiliate-campaign-modal-context">
                        <span>{selectedCampaign.market}</span>
                        <span>{selectedCampaign.resolvedTimeZone}</span>
                        <span>
                          {t("ecommerce.affiliateCampaign.templateVersion", {
                            version: selectedCampaign.templateVersion,
                          })}
                        </span>
                      </div>
                      <div className="affiliate-campaign-modal-shop-line">
                        <ShopIcon />
                        <strong>
                          {campaignShopDisplayName(selectedCampaignShop, selectedCampaign.shopId)}
                        </strong>
                        {selectedCampaignShop?.alias?.trim() &&
                          selectedCampaignShop.shopName?.trim() &&
                          selectedCampaignShop.alias.trim() !==
                            selectedCampaignShop.shopName.trim() && (
                            <small>{selectedCampaignShop.shopName.trim()}</small>
                          )}
                      </div>
                      <div className="affiliate-campaign-modal-product-line">
                        <strong title={selectedCampaign.productSnapshot?.title ?? undefined}>
                          {selectedCampaign.productSnapshot?.title?.trim() ||
                            campaignLeadProductId(selectedCampaign)}
                        </strong>
                        <span>
                          {t("ecommerce.affiliateCampaign.skuLabel")} ·{" "}
                          {selectedCampaign.productSnapshot?.sellerSkus?.[0] ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {campaignDetailActions}
                </div>

                <div className="affiliate-campaign-modal-policy-row">
                  <span className="affiliate-campaign-modal-policy-pill">
                    {campaignStrategyLabel(selectedCampaign.selectionPolicy.strategy, t)}
                  </span>
                  <span
                    className={`affiliate-campaign-modal-readiness${
                      selectionReadiness == null
                        ? ""
                        : selectionReadiness.ready
                          ? " is-ready"
                          : " is-blocked"
                    }`}
                    title={
                      selectionReadiness == null
                        ? t("ecommerce.affiliateCampaign.checkingReadiness")
                        : selectionReadiness.ready
                          ? t("ecommerce.affiliateCampaign.ready")
                          : campaignReadinessMessage(selectionReadiness.reasonCode, t)
                    }
                  >
                    {selectionReadiness == null
                      ? t("ecommerce.affiliateCampaign.checkingReadiness")
                      : selectionReadiness.ready
                        ? t("ecommerce.affiliateCampaign.ready")
                        : campaignReadinessMessage(selectionReadiness.reasonCode, t)}
                  </span>
                  <span className="affiliate-campaign-modal-commission">
                    {t("ecommerce.affiliateCampaign.ordinaryCommissionRate")} ·{" "}
                    {affiliateCampaignCommissionRange(
                      selectedCampaign.products.map((product) => product.commissionRatePercent),
                    )}
                  </span>
                  <span className="affiliate-campaign-modal-commission">
                    {t("ecommerce.affiliateCampaign.shopAdsCommissionRate")} ·{" "}
                    {affiliateCampaignCommissionRange(
                      selectedCampaign.products.map(
                        (product) =>
                          product.shopAdsCommissionRatePercent ?? product.commissionRatePercent,
                      ),
                    )}
                  </span>
                  <button
                    type="button"
                    className="affiliate-campaign-template-toggle"
                    aria-expanded={messageTemplateOpen}
                    onClick={() => setMessageTemplateOpen((open) => !open)}
                  >
                    {messageTemplateOpen
                      ? t("ecommerce.affiliateCampaign.hideFirstMessage")
                      : t("ecommerce.affiliateCampaign.viewFirstMessage")}
                  </button>
                </div>

                {selectedCampaign.products.length > 1 ? (
                  <div className="affiliate-campaign-product-rate-list">
                    {selectedCampaign.products.map((product, index) => {
                      const summary = selectedCampaignProductSummaries.find(
                        (entry) =>
                          entry.shopId === selectedCampaign.shopId &&
                          entry.product.productId === product.productId,
                      )?.product;
                      return (
                        <div
                          className="affiliate-campaign-product-rate-row"
                          key={product.productId}
                        >
                          <div className="affiliate-campaign-product-rate-identity">
                            {summary?.coverImage ? (
                              <RemoteMediaImage
                                sourceUrl={summary.coverImage}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className="affiliate-campaign-product-rate-fallback">
                                <ShopIcon />
                              </span>
                            )}
                            <div>
                              <strong>{summary?.title || `Product ${index + 1}`}</strong>
                              <small>
                                {summary?.skus?.[0]?.sellerSku ||
                                  t("ecommerce.affiliateCampaign.skuLabel")}
                              </small>
                            </div>
                          </div>
                          <div>
                            <span>{t("ecommerce.affiliateCampaign.ordinaryCommissionRate")}</span>
                            <strong>
                              {affiliateCampaignCommissionRange([product.commissionRatePercent])}
                            </strong>
                          </div>
                          <div>
                            <span>{t("ecommerce.affiliateCampaign.shopAdsCommissionRate")}</span>
                            <strong>
                              {affiliateCampaignCommissionRange([
                                product.shopAdsCommissionRatePercent ??
                                  product.commissionRatePercent,
                              ])}
                            </strong>
                          </div>
                          <button
                            type="button"
                            title={product.productId}
                            onClick={() => void copyCampaignProductId(product.productId)}
                          >
                            <CopyIcon />
                            {t("ecommerce.affiliateWorkspace.copyProductPlatformId")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {messageTemplateOpen && (
                  <div
                    className="affiliate-campaign-modal-template data-card-hover"
                    role="region"
                    aria-label={t("ecommerce.affiliateCampaign.firstMessage")}
                  >
                    <div className="affiliate-campaign-modal-template-heading">
                      <span>{t("ecommerce.affiliateCampaign.firstMessage")}</span>
                      <button type="button" onClick={() => void copyFirstMessage()}>
                        {t("ecommerce.affiliateCampaign.copyFirstMessage")}
                      </button>
                    </div>
                    <p>{selectedCampaign.messageTemplateText}</p>
                  </div>
                )}
              </section>

              <section className="affiliate-campaign-kpi-strip data-card-hover">
                <CampaignKpiCard
                  label={t("ecommerce.affiliateCampaign.campaignTodayReachout")}
                  value={latestExecution?.counters.sent ?? 0}
                  denominator={
                    latestExecution?.effectiveTarget ?? selectedCampaign.dailyOutreachTarget
                  }
                  denominatorLabel={t("ecommerce.affiliateCampaign.todayTargetUnit")}
                  supportingText={
                    latestExecution?.nextTickAt
                      ? t("ecommerce.affiliateCampaign.nextSend", {
                          time: formatDateTime(latestExecution.nextTickAt),
                        })
                      : latestExecution?.underDeliveryReason
                        ? campaignExecutionReasonLabel(latestExecution.underDeliveryReason, t)
                        : t("ecommerce.affiliateCampaign.waitingForWindow")
                  }
                  progress
                  emphasis
                />
                <CampaignKpiCard
                  label={t("ecommerce.affiliateCampaign.campaignLifetimeReachout")}
                  value={summary?.lifetimeReachedOut ?? 0}
                  denominator={summary?.activeDayCount ?? 0}
                  denominatorLabel={t("ecommerce.affiliateCampaign.activeDaysUnit")}
                  supportingText={t("ecommerce.affiliateCampaign.lifetimeReachoutDescription")}
                />
                <CampaignKpiCard
                  label={t("ecommerce.affiliateCampaign.shopTodayReachout")}
                  value={summary?.shopDailyCapacity?.countedOutreachCount ?? 0}
                  denominator={summary?.shopDailyCapacity?.effectiveDailyLimit ?? null}
                  denominatorLabel={t("ecommerce.affiliateCampaign.shopCapacityUnit")}
                  supportingText={
                    summary?.shopDailyCapacity?.effectiveDailyLimit == null
                      ? t("ecommerce.affiliateCampaign.dailyCreatorOutreachLimitRequired")
                      : summary.shopDailyCapacity?.circuitOpenUntil
                        ? t("ecommerce.affiliateCampaign.shopCircuitUntil", {
                            time: formatDateTime(summary.shopDailyCapacity.circuitOpenUntil),
                          })
                        : t("ecommerce.affiliateCampaign.shopCapacityRemaining", {
                            count: summary.shopDailyCapacity?.remainingOutreachCapacity ?? 0,
                          })
                  }
                  progress
                />
              </section>
            </div>
          ) : null
        }
        maxWidth={1480}
        portal
        className="affiliate-campaign-detail-modal"
      >
        {selectedCampaign && (
          <div className="affiliate-campaign-detail-modal-body">
            {targetCollaborationQuota?.active && (
              <section className="affiliate-campaign-quota-issue" role="status">
                <div className="affiliate-campaign-quota-issue-copy">
                  <strong>{t("ecommerce.affiliateCampaign.targetCollaborationQuotaTitle")}</strong>
                  <p>
                    {t("ecommerce.affiliateCampaign.targetCollaborationQuotaDescription", {
                      count: targetCollaborationQuota.waitingDeliveryCount,
                    })}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>
                      {t("ecommerce.affiliateCampaign.targetCollaborationQuotaFirstObserved")}
                    </dt>
                    <dd>
                      {targetCollaborationQuota.firstObservedAt
                        ? formatDateTime(targetCollaborationQuota.firstObservedAt)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("ecommerce.affiliateCampaign.targetCollaborationQuotaLastObserved")}</dt>
                    <dd>
                      {targetCollaborationQuota.lastObservedAt
                        ? formatDateTime(targetCollaborationQuota.lastObservedAt)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("ecommerce.affiliateCampaign.targetCollaborationQuotaFailures")}</dt>
                    <dd>{formatNumber(targetCollaborationQuota.liveQuotaErrorCountToday)}</dd>
                  </div>
                  <div>
                    <dt>{t("ecommerce.affiliateCampaign.targetCollaborationQuotaAffected")}</dt>
                    <dd>{formatNumber(targetCollaborationQuota.affectedDeliveryCountToday)}</dd>
                  </div>
                  <div>
                    <dt>{t("ecommerce.affiliateCampaign.targetCollaborationQuotaNextRetry")}</dt>
                    <dd>
                      {targetCollaborationQuota.nextRetryAt
                        ? formatDateTime(targetCollaborationQuota.nextRetryAt)
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {targetCollaborationQuota.recentEvents.length > 0 && (
                  <details>
                    <summary>
                      {t("ecommerce.affiliateCampaign.targetCollaborationQuotaRecent")}
                    </summary>
                    <ol>
                      {targetCollaborationQuota.recentEvents.map((event, index) => (
                        <li key={`${event.occurredAt}-${index}`}>
                          <time>{formatDateTime(event.occurredAt)}</time>
                          <span>
                            {t(
                              event.outcome === "CREATED"
                                ? "ecommerce.affiliateCampaign.targetCollaborationQuotaEventCreated"
                                : "ecommerce.affiliateCampaign.targetCollaborationQuotaEventExhausted",
                              { count: event.affectedDeliveryCount },
                            )}
                          </span>
                          {event.inferredFromLegacy && (
                            <small>
                              {t("ecommerce.affiliateCampaign.targetCollaborationQuotaLegacy")}
                            </small>
                          )}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </section>
            )}
            {targetCollaborationQuotaRecovered &&
              targetCollaborationQuota?.lastSuccessfulCreateAt && (
                <section className="affiliate-campaign-quota-recovered" role="status">
                  <strong>
                    {t("ecommerce.affiliateCampaign.targetCollaborationQuotaRecovered")}
                  </strong>
                  <span>
                    {t("ecommerce.affiliateCampaign.targetCollaborationQuotaRecoveredAt", {
                      time: formatDateTime(targetCollaborationQuota.lastSuccessfulCreateAt),
                    })}
                  </span>
                </section>
              )}

            <CampaignFunnel
              counters={summary?.counters}
              counterSchemaVersion={latestExecution?.counterSchemaVersion ?? 3}
              deliveryFailureReasons={summary?.deliveryFailureReasons ?? []}
              searchPlanCount={latestExecution?.searchPlanExecutions?.length ?? 0}
              onOpenSentCreators={showSentCreators}
              t={t}
            />

            <TkPanel
              as="section"
              padding="none"
              clip
              className="affiliate-campaign-search-plan-panel data-card-hover"
              data-tutorial-id="affiliate-campaign-detail-operations"
            >
              <div
                ref={searchWorkspaceRef}
                className={`affiliate-campaign-search-workspace${
                  searchWorkspaceView === "creators" ? " is-detail" : ""
                }`}
              >
                <div className="affiliate-campaign-search-workspace-track">
                  <div
                    className="affiliate-campaign-search-workspace-pane is-conditions"
                    aria-hidden={searchWorkspaceView !== "conditions"}
                    inert={searchWorkspaceView !== "conditions" ? true : undefined}
                  >
                    <div className="affiliate-campaign-section-heading">
                      <div>
                        <span>{t("ecommerce.affiliateCampaign.dynamicDiscoveryEyebrow")}</span>
                        <h3>{t("ecommerce.affiliateCampaign.searchPlanPerformance")}</h3>
                        <p>{t("ecommerce.affiliateCampaign.searchPlanPerformanceDescription")}</p>
                      </div>
                      <button
                        type="button"
                        className="affiliate-campaign-search-forward"
                        onClick={showCampaignCreators}
                      >
                        {t("ecommerce.affiliateCampaign.viewCampaignCreators")}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    {searchPlanSummaries.length ? (
                      <TkTableFrame className="affiliate-campaign-search-plan-table-wrap">
                        <table className="affiliate-campaign-search-plan-table">
                          <thead>
                            <tr>
                              <th>{t("ecommerce.affiliateCampaign.searchPlan")}</th>
                              <th>{t("ecommerce.affiliateCampaign.searchProgress")}</th>
                              <th>{t("ecommerce.affiliateCampaign.searchYield")}</th>
                              <th>{t("ecommerce.affiliateCampaign.searchFiltered")}</th>
                              <th>{t("ecommerce.affiliateCampaign.funnel.scheduled")}</th>
                              <th>{t("ecommerce.affiliateCampaign.deliveryOutcome")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchPlanSummaries.map((summaryItem) => {
                              const plan = summaryItem.plan;
                              const filtered =
                                summaryItem.duplicateCount +
                                plan.totals.protected +
                                plan.totals.outreachPolicyBlocked +
                                plan.totals.qualificationFailed;
                              const openDetails = () => showSearchPlanCreators(plan.id);
                              return (
                                <TkInteractiveTableRow key={plan.id} onActivate={openDetails}>
                                  <td>
                                    <div className="affiliate-campaign-search-plan-select">
                                      <span>#{plan.generation}</span>
                                      <strong>
                                        {plan.phrase?.text ?? searchPlanStatusLabel(plan.status, t)}
                                      </strong>
                                      <small lang={plan.phrase?.explanationLocale || undefined}>
                                        {plan.phrase?.explanation ??
                                          t(
                                            "ecommerce.affiliateCampaign.dynamicSearchPlanGenerationDescription",
                                          )}
                                      </small>
                                      <em>
                                        {plan.discoveryRules
                                          ? campaignSearchGroupRuleSummary(plan.discoveryRules, t)
                                          : t(
                                              "ecommerce.affiliateCampaign.noAdditionalProviderRules",
                                            )}
                                      </em>
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={`affiliate-campaign-plan-status is-${plan.status.toLowerCase()}`}
                                    >
                                      {searchPlanStatusLabel(plan.status, t)}
                                    </span>
                                    <small>
                                      {plan.pageSequence} / 50{" "}
                                      {t("ecommerce.affiliateCampaign.pagesUnit")}
                                    </small>
                                  </td>
                                  <td>
                                    <strong>{formatNumber(plan.totals.scanned)}</strong>
                                    <small>
                                      {formatNumber(plan.totals.matched)}{" "}
                                      {t("ecommerce.affiliateCampaign.uniqueCreatorsUnit")}
                                    </small>
                                  </td>
                                  <td>
                                    <strong>{formatNumber(filtered)}</strong>
                                    <small>
                                      {t("ecommerce.affiliateCampaign.searchFilteredBreakdown", {
                                        duplicate: summaryItem.duplicateCount,
                                        protected: plan.totals.protected,
                                        policy: plan.totals.outreachPolicyBlocked,
                                        qualification: plan.totals.qualificationFailed,
                                      })}
                                    </small>
                                  </td>
                                  <td>
                                    <strong>{formatNumber(plan.totals.scheduled)}</strong>
                                    <small>
                                      {formatNumber(plan.totals.qualified)}{" "}
                                      {t("ecommerce.affiliateCampaign.qualifiedCreatorsUnit")}
                                    </small>
                                  </td>
                                  <td>
                                    <strong>{formatNumber(summaryItem.delivery.sent)}</strong>
                                    <small>
                                      {t("ecommerce.affiliateCampaign.searchPlanDeliveryOutcome", {
                                        sent: summaryItem.delivery.sent,
                                        failed: summaryItem.delivery.failed,
                                      })}
                                    </small>
                                  </td>
                                </TkInteractiveTableRow>
                              );
                            })}
                          </tbody>
                        </table>
                      </TkTableFrame>
                    ) : (
                      <div className="affiliate-campaign-plan-waiting">
                        <strong>
                          {searchPlanStatusLabel(selectedCampaign.searchPlanning.state, t)}
                        </strong>
                        <p>
                          {t("ecommerce.affiliateCampaign.dynamicSearchPlanGenerationDescription")}
                        </p>
                      </div>
                    )}
                    {(activeSearchPlan?.status === "BLOCKED" ||
                      selectedCampaign.searchPlanning.state === "BLOCKED") && (
                      <div className="affiliate-campaign-search-plan-blocked">
                        <p>
                          {searchPlanGenerationErrorMessage(
                            activeSearchPlan?.errorCode ??
                              selectedCampaign.searchPlanning.generationRequest?.errorCode,
                            t,
                          )}
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={retrySearchPlanState.loading}
                          onClick={() => void retryCurrentSearchPlan()}
                        >
                          {t("ecommerce.affiliateCampaign.retrySearchPlan")}
                        </button>
                      </div>
                    )}
                    {searchPlansQuery.data?.affiliateCampaignSearchPlanSummaries?.nextCursor && (
                      <button
                        type="button"
                        className="btn btn-secondary affiliate-campaign-load-more"
                        disabled={searchPlansQuery.loading}
                        onClick={() => void loadMoreSearchPlans()}
                      >
                        {t("ecommerce.affiliateCampaign.loadMoreSearchPlans")}
                      </button>
                    )}
                  </div>

                  <div
                    className="affiliate-campaign-search-workspace-pane is-creators"
                    aria-hidden={searchWorkspaceView !== "creators"}
                    inert={searchWorkspaceView !== "creators" ? true : undefined}
                  >
                    <div className="affiliate-campaign-search-detail-heading">
                      {currentSearchPlan ? (
                        <button
                          type="button"
                          className="affiliate-campaign-search-back"
                          onClick={openSearchConditions}
                        >
                          <span aria-hidden="true">←</span>
                          {t("ecommerce.affiliateCampaign.backToSearchConditions")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="affiliate-campaign-search-forward"
                          onClick={openSearchConditions}
                        >
                          {t("ecommerce.affiliateCampaign.browseSearchConditions")}
                          <span aria-hidden="true">→</span>
                        </button>
                      )}
                      <div className="affiliate-campaign-section-heading">
                        <div>
                          <span>{t("ecommerce.affiliateCampaign.creatorPipeline")}</span>
                          <h3>{t("ecommerce.affiliateCampaign.creatorStates")}</h3>
                          <p>
                            {currentSearchPlan?.phrase
                              ? t("ecommerce.affiliateCampaign.creatorStatesForSearchPlan", {
                                  generation: currentSearchPlan.generation,
                                  phrase: currentSearchPlan.phrase.text,
                                })
                              : t("ecommerce.affiliateCampaign.creatorStatesForAllSearchPlans")}
                          </p>
                        </div>
                        {currentSearchPlan && (
                          <span className="affiliate-campaign-selected-plan-chip">
                            #{currentSearchPlan.generation} · {currentSearchPlan.phrase?.text}
                          </span>
                        )}
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
                      <button
                        type="button"
                        className={`affiliate-campaign-state-preset${
                          isSentCreatorStatePreset(stateStatuses) ? " is-active" : ""
                        }`}
                        aria-pressed={isSentCreatorStatePreset(stateStatuses)}
                        onClick={() => setStateStatuses(applySentCreatorStatePreset)}
                      >
                        {t("ecommerce.affiliateCampaign.sentCreatorsPreset")}
                      </button>
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
                    <TkTableFrame className="affiliate-campaign-state-table-wrap">
                      <table className="affiliate-campaign-state-table">
                        <thead>
                          <tr>
                            <th>{t("ecommerce.affiliateCampaign.creator")}</th>
                            <th>{t("ecommerce.affiliateCampaign.outreachDisposition")}</th>
                            <th>{t("ecommerce.affiliateCampaign.sentAt")}</th>
                            <th>{t("ecommerce.affiliateCampaign.state")}</th>
                            <th>{t("ecommerce.affiliateCampaign.selectionEvidence")}</th>
                            <th>{t("ecommerce.affiliateCampaign.relationship")}</th>
                            <th>{t("ecommerce.affiliateCampaign.lastActivity")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(creatorStatesQuery.data?.affiliateCampaignCreatorStates?.items ?? []).map(
                            (state) => (
                              <CampaignCreatorStateRow
                                key={state.id}
                                state={state}
                                t={t}
                                waitingForTargetCollaborationQuota={Boolean(
                                  targetCollaborationQuota?.active,
                                )}
                                onOpen={() =>
                                  setSelectedCreatorDetail(campaignCreatorDetailItem(state))
                                }
                              />
                            ),
                          )}
                        </tbody>
                      </table>
                      {creatorStatesViewState === "loading" && (
                        <LoadingSpinner
                          variant="inline"
                          label={t("ecommerce.affiliateCampaign.loadingCreatorStates")}
                        />
                      )}
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
                    </TkTableFrame>
                    {creatorStatesQuery.data?.affiliateCampaignCreatorStates?.nextCursor && (
                      <button
                        type="button"
                        className="btn btn-secondary affiliate-campaign-load-more"
                        disabled={creatorStatesQuery.loading}
                        onClick={() => void loadMoreCreatorStates()}
                      >
                        {t("ecommerce.affiliateCampaign.loadMoreCreators")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </TkPanel>
          </div>
        )}
      </Modal>

      {selectedCreatorDetail && (
        <CreatorRelationshipDetailModal
          item={selectedCreatorDetail}
          selectedShopId={selectedCampaign?.shopId ?? ""}
          onClose={() => setSelectedCreatorDetail(null)}
        />
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
        <div
          className="affiliate-campaign-wizard-body"
          data-tutorial-id="affiliate-campaign-wizard"
        >
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
                      setProductPreviews({});
                      setPendingProductResolution(null);
                    }}
                    options={shopOptions}
                    searchable
                    disabled={Boolean(editingCampaignId)}
                    searchPlaceholder={t("ecommerce.affiliateCampaign.searchShop")}
                    placeholder={t("ecommerce.affiliateCampaign.selectShop")}
                  />
                </label>
                <div className="affiliate-campaign-offer">
                  <span>{t("ecommerce.affiliateCampaign.offerTitle")}</span>
                  {form.products.map((product, index) => {
                    const rowProductId = product.productId.trim();
                    const rowPreview = rowProductId
                      ? (productPreviews[rowProductId] ?? null)
                      : null;
                    return (
                      // Each product owns its own id, rate, fetch and snapshot,
                      // so a resolved product sits under the id it belongs to
                      // instead of in a pile below the list.
                      <div className="affiliate-campaign-offer-item" key={`offer-${index}`}>
                        <div className="affiliate-campaign-offer-row tk-v1-form-action-row">
                          <label className="affiliate-campaign-offer-field">
                            <span>{t("ecommerce.affiliateCampaign.productIdLabel")}</span>
                            <input
                              value={product.productId}
                              disabled={!form.shopId}
                              onChange={(event) => {
                                updateProduct(index, { productId: event.target.value.trim() });
                                if (index === 0) {
                                  updateForm("refreshProductSnapshot", false);
                                  updateForm("messageProductName", "");
                                }
                                setPendingProductResolution(null);
                              }}
                              placeholder={t("ecommerce.affiliateCampaign.productIdPlaceholder")}
                            />
                          </label>
                          <label className="affiliate-campaign-offer-field">
                            <span>{t("ecommerce.affiliateCampaign.ordinaryCommissionColumn")}</span>
                            <input
                              type="number"
                              min={1}
                              max={80}
                              step="0.1"
                              value={product.commissionRate}
                              onChange={(event) =>
                                updateProduct(index, { commissionRate: event.target.value })
                              }
                            />
                          </label>
                          <label className="affiliate-campaign-offer-field">
                            <span>{t("ecommerce.affiliateCampaign.shopAdsCommissionColumn")}</span>
                            <input
                              type="number"
                              min={1}
                              max={80}
                              step="0.1"
                              value={product.shopAdsCommissionRate}
                              onChange={(event) =>
                                updateProduct(index, {
                                  shopAdsCommissionRate: event.target.value,
                                })
                              }
                            />
                          </label>
                          <TkButton
                            className="affiliate-campaign-fetch-button"
                            variant="secondary"
                            loading={
                              fetchingProductId === rowProductId && resolveProductState.loading
                            }
                            disabled={!form.shopId || !rowProductId || resolveProductState.loading}
                            onClick={() => fetchProduct(index)}
                          >
                            {fetchingProductId === rowProductId && resolveProductState.loading
                              ? t("ecommerce.affiliateCampaign.fetchingProduct")
                              : t("ecommerce.affiliateCampaign.fetchProduct")}
                          </TkButton>
                          <TkButton
                            variant="danger"
                            disabled={form.products.length < 2}
                            onClick={() => removeProduct(index)}
                          >
                            {t("ecommerce.affiliateCampaign.removeProduct")}
                          </TkButton>
                        </div>
                        {rowPreview && (
                          <article className="affiliate-campaign-product-preview">
                            {rowPreview.coverImage ? (
                              <img src={rowPreview.coverImage} alt="" />
                            ) : (
                              <div className="affiliate-campaign-product-preview-placeholder">
                                <ShopIcon />
                              </div>
                            )}
                            <div>
                              <span>{t("ecommerce.affiliateCampaign.productVerified")}</span>
                              <strong>{rowPreview.title}</strong>
                              <p>{rowPreview.categoryPathNames.join(" / ")}</p>
                              <small>
                                ${rowPreview.minimumPriceUsdAmount.toFixed(2)}
                                {rowPreview.maximumPriceUsdAmount !==
                                  rowPreview.minimumPriceUsdAmount &&
                                  ` – $${rowPreview.maximumPriceUsdAmount.toFixed(2)}`}
                                {" · "}
                                {rowPreview.brandName || t("ecommerce.affiliateCampaign.noBrand")}
                                {" · "}
                                {t("ecommerce.affiliateCampaign.snapshotObservedAt", {
                                  time: formatDateTime(rowPreview.observedAt),
                                })}
                              </small>
                            </div>
                            <i>{rowPreview.status ?? "—"}</i>
                          </article>
                        )}
                      </div>
                    );
                  })}
                  {/* Not gated on the shop: adding a row is just making space
                      to type an id. Only resolving one needs a shop. */}
                  <button type="button" className="btn btn-secondary" onClick={addProduct}>
                    {t("ecommerce.affiliateCampaign.addProduct")}
                  </button>
                  <small>{t("ecommerce.affiliateCampaign.offerHint")}</small>
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
                    disabled={!aiReadiness?.ready}
                    aria-disabled={!aiReadiness?.ready || undefined}
                    data-selected={
                      form.strategy === GQL.AffiliateCampaignSelectionStrategy.AiPreApproval ||
                      undefined
                    }
                    onClick={() =>
                      updateForm("strategy", GQL.AffiliateCampaignSelectionStrategy.AiPreApproval)
                    }
                  >
                    <span>{t("ecommerce.affiliateCampaign.strategyMlKicker")}</span>
                    <strong>{t("ecommerce.affiliateCampaign.strategyMlTitle")}</strong>
                    <small>{t("ecommerce.affiliateCampaign.strategyMlDescription")}</small>
                    <i>{campaignAiReadinessNote(aiReadiness, aiReadinessLoading, t)}</i>
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
                    <span>{t("ecommerce.affiliateCampaign.endDays")}</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      step="1"
                      value={form.endDays}
                      onChange={(event) => updateForm("endDays", event.target.value)}
                    />
                    <small>{t("ecommerce.affiliateCampaign.endDaysHint")}</small>
                  </label>
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.sellerContactEmail")}</span>
                    <input
                      type="email"
                      value={form.sellerContactEmail}
                      onChange={(event) => updateForm("sellerContactEmail", event.target.value)}
                    />
                    <small>{t("ecommerce.affiliateCampaign.sellerContactEmailHint")}</small>
                  </label>
                  <label className="affiliate-campaign-check-rule">
                    <input
                      type="checkbox"
                      checked={form.isSampleApprovalExempt}
                      onChange={(event) =>
                        updateForm("isSampleApprovalExempt", event.target.checked)
                      }
                    />
                    <span>{t("ecommerce.affiliateCampaign.sampleApprovalExempt")}</span>
                  </label>
                  <p className="form-hint">
                    {t("ecommerce.affiliateCampaign.sampleApprovalExemptHint")}
                  </p>
                </div>
                <section className="affiliate-campaign-dynamic-discovery">
                  <div>
                    <strong>{t("ecommerce.affiliateCampaign.dynamicDiscoveryTitle")}</strong>
                    <p>{t("ecommerce.affiliateCampaign.dynamicDiscoveryDescription")}</p>
                  </div>
                  <ul>
                    <li>{t("ecommerce.affiliateCampaign.dynamicDiscoverySequential")}</li>
                    <li>{t("ecommerce.affiliateCampaign.dynamicDiscoveryPageLimit")}</li>
                    <li>{t("ecommerce.affiliateCampaign.dynamicDiscoveryDesktopRequired")}</li>
                  </ul>
                  <label>
                    <span>{t("ecommerce.affiliateCampaign.searchPlanGuidance")}</span>
                    <textarea
                      value={form.searchPlanGuidance}
                      maxLength={500}
                      rows={4}
                      onChange={(event) => updateForm("searchPlanGuidance", event.target.value)}
                      placeholder={t("ecommerce.affiliateCampaign.searchPlanGuidancePlaceholder")}
                    />
                    <small className="affiliate-campaign-guidance-contract-hint">
                      {t("ecommerce.affiliateCampaign.searchPlanGuidanceHint", {
                        count: form.searchPlanGuidance.length,
                      })}
                    </small>
                  </label>
                </section>
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
                    aria-invalid={unsupportedTemplateVariables.length > 0}
                    aria-describedby={
                      unsupportedTemplateVariables.length > 0
                        ? "affiliate-campaign-template-variable-error"
                        : undefined
                    }
                    onChange={(event) => {
                      updateForm("templateText", event.target.value);
                      updateForm(
                        "templateSource",
                        GQL.AffiliateCampaignMessageTemplateSource.UserAuthored,
                      );
                    }}
                    placeholder={t("ecommerce.affiliateCampaign.messagePlaceholder")}
                  />
                  {unsupportedTemplateVariables.length > 0 && (
                    <small
                      id="affiliate-campaign-template-variable-error"
                      className="affiliate-campaign-template-error"
                      role="alert"
                    >
                      {t("ecommerce.affiliateCampaign.templateUnsupportedVariables", {
                        variables: unsupportedTemplateVariables
                          .map((variable) => `{{${variable}}}`)
                          .join(", "),
                      })}
                    </small>
                  )}
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
                  value={`${selectedShop?.shopName ?? "—"} · ${productPreview?.title ?? leadProductId}`}
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
                  title={t("ecommerce.affiliateCampaign.ordinaryCommissionRate")}
                  value={affiliateCampaignCommissionRange(
                    form.products.map((product) => product.commissionRate),
                  )}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.shopAdsCommissionRate")}
                  value={affiliateCampaignCommissionRange(
                    form.products.map(
                      (product) => product.shopAdsCommissionRate || product.commissionRate,
                    ),
                  )}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.endDays")}
                  value={t("ecommerce.affiliateCampaign.endDaysValue", {
                    count: Number(form.endDays),
                  })}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.sellerContactEmail")}
                  value={form.sellerContactEmail || "—"}
                />
                <ConfirmationItem
                  title={t("ecommerce.affiliateCampaign.sampleApprovalExempt")}
                  value={t(
                    form.isSampleApprovalExempt
                      ? "ecommerce.affiliateCampaign.sampleApprovalExemptOn"
                      : "ecommerce.affiliateCampaign.sampleApprovalExemptOff",
                  )}
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
            : "ecommerce.affiliateCampaign.archiveTitle",
        )}
        message={
          confirmation?.kind === "delete-draft"
            ? t("ecommerce.affiliateCampaign.deleteDraftConfirm", {
                name: confirmation.campaignName,
              })
            : t("ecommerce.affiliateCampaign.archiveConfirm", {
                name: confirmation?.campaignName,
              })
        }
        confirmLabel={t(
          confirmation?.kind === "delete-draft"
            ? "ecommerce.affiliateCampaign.deleteDraft"
            : "ecommerce.affiliateCampaign.archive",
        )}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
      />
    </AffiliatePageFrame>
  );
});

function CampaignCreatorStateRow({
  state,
  t,
  onOpen,
  waitingForTargetCollaborationQuota,
}: {
  state: CampaignCreatorState;
  t: (key: string, options?: Record<string, unknown>) => string;
  onOpen: () => void;
  waitingForTargetCollaborationQuota: boolean;
}) {
  const profile = state.creatorProfile;
  const relationship = state.creatorRelationship;
  const displayName =
    profile?.nickname?.trim() ||
    profile?.username?.trim() ||
    t("ecommerce.affiliateCampaign.profilePending");
  const handle = profile?.username
    ? `@${profile.username.replace(/^@/, "")}`
    : shortId(profile?.creatorOpenId || state.creatorId);
  const relationshipActivity = relationship?.lastInboundAt || relationship?.lastOutboundAt || null;
  const lastActivity =
    state.repliedAt ||
    state.reachedOutAt ||
    state.scheduledAt ||
    relationshipActivity ||
    state.lastSeenAt;
  const disposition = campaignOutreachDisposition(state.status);
  const deliveryFailureCategory = state.outreachErrorCode
    ? campaignDeliveryFailureBreakdown([{ code: state.outreachErrorCode, count: 1 }], 1)[0]
        ?.category
    : null;

  return (
    <tr>
      <td>
        <button
          type="button"
          className="affiliate-campaign-creator-cell"
          title={t("ecommerce.affiliateWorkspace.openCreatorDetail")}
          aria-label={t("ecommerce.affiliateWorkspace.openCreatorDetail")}
          onClick={onOpen}
        >
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
          </div>
        </button>
      </td>
      <td>
        <span className={`affiliate-campaign-disposition is-${disposition}`}>
          {t(`ecommerce.affiliateCampaign.disposition.${disposition}`)}
        </span>
        {waitingForTargetCollaborationQuota &&
        state.status === GQL.AffiliateCampaignCreatorStateStatus.Scheduled ? (
          <small>{t("ecommerce.affiliateCampaign.targetCollaborationQuotaScheduled")}</small>
        ) : state.reachedOutAt ? null : (
          <small>{t("ecommerce.affiliateCampaign.notSent")}</small>
        )}
      </td>
      <td className="affiliate-campaign-sent-at">
        {state.reachedOutAt ? (
          <strong>{formatDateTime(state.reachedOutAt)}</strong>
        ) : (
          <span aria-hidden="true">—</span>
        )}
      </td>
      <td>
        <span className={`affiliate-campaign-state-pill is-${state.status.toLowerCase()}`}>
          {campaignStateLabel(state.status, t)}
        </span>
        <small title={state.decisionReason ?? undefined}>
          {state.eligibilityReasonCode
            ? eligibilityReasonLabel(state.eligibilityReasonCode, t)
            : campaignDecisionReasonLabel(state.decisionReasonCodes, state.decisionReason, t)}
        </small>
        {deliveryFailureCategory && (
          <small>
            <AffiliateMetricLabel
              label={t(`ecommerce.affiliateCampaign.deliveryFailure.${deliveryFailureCategory}`)}
              tooltip={t(
                `ecommerce.affiliateCampaign.deliveryFailureTooltip.${deliveryFailureCategory}`,
              )}
            />
          </small>
        )}
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
              {t("ecommerce.affiliateCampaign.searchPlanGeneration", {
                generation: state.latestSearchPlanGeneration ?? "—",
              })}
            </small>
          </>
        ) : (
          <>
            <strong>{campaignPreApprovalOutcomeLabel(state.preApproved, t)}</strong>
            <small>
              {t("ecommerce.affiliateCampaign.preApprovalScore", {
                probability: formatProbability(state.preApprovalProbability),
                cutoff: formatProbability(state.preApprovalCutoff),
              })}
            </small>
            <small>
              {t("ecommerce.affiliateCampaign.preApprovalModel", {
                model: state.preApprovalModelVersion ?? "—",
              })}
            </small>
            <small>
              {state.preApprovalObservedAt
                ? t("ecommerce.affiliateCampaign.preApprovalObservedAt", {
                    date: formatDateTime(state.preApprovalObservedAt),
                  })
                : t("ecommerce.affiliateCampaign.performancePending")}
            </small>
            <small className="form-hint">
              {t("ecommerce.affiliateCampaign.preApprovalDisclaimer")}
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

function searchPlanStatusLabel(status: string, t: (key: string) => string): string {
  const key = status.toLowerCase();
  return t(`ecommerce.affiliateCampaign.searchPlanStatus.${key}`);
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
  if (campaign.selectionPolicy.strategy === GQL.AffiliateCampaignSelectionStrategy.AiPreApproval) {
    return t("ecommerce.affiliateCampaign.preApprovalSummary");
  }
  return t("ecommerce.affiliateCampaign.dynamicSearchPlanSummary");
}

/**
 * The readiness line under the AI option. It says what the seller can do about
 * it and nothing about which artifact answered.
 */
export function campaignAiReadinessNote(
  readiness: GQL.AffiliateCampaignAiReadiness | null | undefined,
  loading: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (loading || !readiness) return t("ecommerce.affiliateCampaign.strategyMlChecking");
  if (readiness.ready) return t("ecommerce.affiliateCampaign.strategyMlReady");
  return readiness.status === GQL.AffiliateCampaignAiReadinessStatus.TemporarilyUnavailable
    ? t("ecommerce.affiliateCampaign.strategyMlTemporarilyUnavailable")
    : t("ecommerce.affiliateCampaign.strategyMlNotConfigured");
}

function CampaignFunnel({
  counters,
  counterSchemaVersion,
  deliveryFailureReasons,
  searchPlanCount,
  onOpenSentCreators,
  t,
}: {
  counters?: GQL.AffiliateCampaignExecutionCounters;
  counterSchemaVersion: number;
  deliveryFailureReasons: GQL.AffiliateCampaignDeliveryFailureReason[];
  searchPlanCount: number;
  onOpenSentCreators: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const legacyUnrecorded = counterSchemaVersion < 2;
  const matched = campaignFunnelCounterValue({
    counterSchemaVersion,
    introducedInVersion: 2,
    value: counters?.matched ?? 0,
  });
  const duplicate = matched == null ? null : Math.max(0, (counters?.scanned ?? 0) - matched);
  const protectedCount = campaignFunnelCounterValue({
    counterSchemaVersion,
    introducedInVersion: 2,
    value: counters?.protected ?? 0,
  });
  const outreachPolicyCount = campaignFunnelCounterValue({
    counterSchemaVersion,
    introducedInVersion: 2,
    value: counters?.outreachPolicyBlocked ?? 0,
  });
  const qualificationCount = campaignFunnelCounterValue({
    counterSchemaVersion,
    introducedInVersion: 2,
    value: counters?.qualificationFailed ?? 0,
  });
  const ineligibleValues = [duplicate, protectedCount, outreachPolicyCount, qualificationCount];
  const ineligibleTotal = ineligibleValues.some((value) => value == null)
    ? null
    : ineligibleValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const failureBreakdown = campaignDeliveryFailureBreakdown(
    deliveryFailureReasons,
    counters?.failed ?? 0,
  );
  return (
    <section className="affiliate-campaign-funnel">
      <div className="affiliate-campaign-section-heading">
        <div>
          <span>{t("ecommerce.affiliateCampaign.todayFunnel")}</span>
          <h3>{t("ecommerce.affiliateCampaign.discoveryToInvitation")}</h3>
          <p>{t("ecommerce.affiliateCampaign.funnelDescription")}</p>
          {legacyUnrecorded && (
            <small>{t("ecommerce.affiliateCampaign.legacyFunnelPartial")}</small>
          )}
        </div>
      </div>
      <div className="affiliate-campaign-funnel-flow">
        <div className="affiliate-campaign-funnel-mainline">
          <CampaignFunnelStage
            index="01"
            label={t("ecommerce.affiliateCampaign.funnel.scannedToday")}
            value={counters?.scanned ?? 0}
            tone="neutral"
            note={t("ecommerce.affiliateCampaign.searchConditionsUsedToday", {
              count: searchPlanCount,
            })}
          />
          <span className="affiliate-campaign-funnel-connector" aria-hidden="true" />
          <CampaignFunnelStage
            index="02"
            label={t("ecommerce.affiliateCampaign.funnel.scheduledToday")}
            value={counters?.scheduled ?? 0}
            tone="primary"
            note={t("ecommerce.affiliateCampaign.funnelTooltip.scheduled")}
          />
          <span className="affiliate-campaign-funnel-connector" aria-hidden="true" />
          <CampaignFunnelStage
            index="03"
            label={t("ecommerce.affiliateCampaign.funnel.targetInvitationsSent")}
            value={counters?.sent ?? 0}
            tone="success"
            note={t("ecommerce.affiliateCampaign.funnelTooltip.sent")}
            actionLabel={t("ecommerce.affiliateCampaign.openSentCreators")}
            onActivate={onOpenSentCreators}
          />
        </div>
        <div className="affiliate-campaign-funnel-branches">
          <div className="affiliate-campaign-funnel-branch is-filtered">
            <span aria-hidden="true" />
            <CampaignFunnelStage
              index="01A"
              label={t("ecommerce.affiliateCampaign.funnel.ineligible")}
              value={ineligibleTotal}
              tone="warning"
              details={[
                {
                  label: t("ecommerce.affiliateCampaign.funnel.duplicate"),
                  value: duplicate,
                  tooltip: t("ecommerce.affiliateCampaign.funnelTooltip.duplicate"),
                },
                {
                  label: t("ecommerce.affiliateCampaign.funnel.protected"),
                  value: protectedCount,
                  tooltip: t("ecommerce.affiliateCampaign.funnelTooltip.protected"),
                },
                {
                  label: t("ecommerce.affiliateCampaign.funnel.outreachPolicyBlocked"),
                  value: outreachPolicyCount,
                  tooltip: t("ecommerce.affiliateCampaign.funnelTooltip.outreachPolicyBlocked"),
                },
                {
                  label: t("ecommerce.affiliateCampaign.funnel.qualificationFailed"),
                  value: qualificationCount,
                  tooltip: t("ecommerce.affiliateCampaign.funnelTooltip.qualificationFailed"),
                },
              ]}
              collapsibleDetails
              detailsLabel={t("ecommerce.affiliateCampaign.viewBreakdown")}
            />
          </div>
          <div className="affiliate-campaign-funnel-branch is-failed">
            <span aria-hidden="true" />
            <CampaignFunnelStage
              index="02A"
              label={t("ecommerce.affiliateCampaign.funnel.deliveryFailed")}
              value={counters?.failed ?? 0}
              tone="danger"
              details={failureBreakdown.map((reason) => ({
                label: t(`ecommerce.affiliateCampaign.deliveryFailure.${reason.category}`),
                value: reason.count,
                tooltip: t(`ecommerce.affiliateCampaign.deliveryFailureTooltip.${reason.category}`),
              }))}
              emptyNote={t("ecommerce.affiliateCampaign.noDeliveryFailuresToday")}
              collapsibleDetails
              detailsLabel={t("ecommerce.affiliateCampaign.viewBreakdown")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CampaignKpiCard({
  label,
  value,
  denominator,
  denominatorLabel,
  supportingText,
  progress = false,
  emphasis = false,
}: {
  label: string;
  value: number;
  denominator: number | null;
  denominatorLabel: string;
  supportingText: string;
  progress?: boolean;
  emphasis?: boolean;
}) {
  const progressValue =
    denominator && denominator > 0 ? Math.min(100, Math.max(0, (value / denominator) * 100)) : 0;
  return (
    <article className={`affiliate-campaign-kpi-card${emphasis ? " is-emphasis" : ""}`}>
      <span>{label}</span>
      <div className="affiliate-campaign-kpi-value">
        <strong>{formatNumber(value)}</strong>
        <small>
          / {denominator == null ? "—" : formatNumber(denominator)} {denominatorLabel}
        </small>
      </div>
      {progress && (
        <div className="affiliate-campaign-kpi-progress" aria-hidden="true">
          <i style={{ width: `${progressValue}%` }} />
        </div>
      )}
      <p>{supportingText}</p>
    </article>
  );
}

type CampaignFunnelDetail = {
  label: string;
  value: number | null;
  tooltip: string;
};

function CampaignFunnelStage({
  index,
  label,
  value,
  tone,
  details = [],
  note,
  emptyNote,
  collapsibleDetails = false,
  detailsLabel,
  actionLabel,
  onActivate,
}: {
  index: string;
  label: string;
  value: number | null;
  tone: "neutral" | "warning" | "primary" | "danger" | "success";
  details?: CampaignFunnelDetail[];
  note?: string;
  emptyNote?: string;
  collapsibleDetails?: boolean;
  detailsLabel?: string;
  /** With `onActivate`, the whole stage becomes a button labelled by this text. */
  actionLabel?: string;
  onActivate?: () => void;
}) {
  const detailRows = details.length > 0 && (
    <div className="affiliate-campaign-funnel-details">
      {details.map((detail) => (
        <div key={detail.label}>
          <AffiliateMetricLabel label={detail.label} tooltip={detail.tooltip} />
          <strong>{detail.value == null ? "—" : formatNumber(detail.value)}</strong>
        </div>
      ))}
    </div>
  );
  return (
    <article
      className={`affiliate-campaign-funnel-stage data-card-hover is-${tone}${
        onActivate ? " is-interactive" : ""
      }`}
    >
      <header>
        <span>{index}</span>
        <strong>{label}</strong>
      </header>
      <div className="affiliate-campaign-funnel-stage-value">
        {value == null ? "—" : formatNumber(value)}
      </div>
      {details.length > 0 && collapsibleDetails ? (
        <details className="affiliate-campaign-funnel-detail-disclosure">
          <summary>{detailsLabel}</summary>
          {detailRows}
        </details>
      ) : details.length > 0 ? (
        detailRows
      ) : note || emptyNote ? (
        <p>{note ?? emptyNote}</p>
      ) : null}
      {onActivate && (
        <button
          type="button"
          className="affiliate-campaign-funnel-stage-action"
          onClick={onActivate}
        >
          {actionLabel}
          <span aria-hidden="true">→</span>
        </button>
      )}
    </article>
  );
}

type CampaignDeliveryFailureCategory =
  | "duplicateCollaboration"
  | "invalidCreator"
  | "providerNotAccepted"
  | "otherProviderRejection";

export function campaignDeliveryFailureBreakdown(
  reasons: ReadonlyArray<{ code: string; count: number }>,
  failedTotal: number,
): Array<{ category: CampaignDeliveryFailureCategory; count: number }> {
  const counts = new Map<CampaignDeliveryFailureCategory, number>();
  for (const reason of reasons) {
    const category: CampaignDeliveryFailureCategory =
      reason.code === "COLLABORATION_CREATOR_PRODUCT_CONFLICT"
        ? "duplicateCollaboration"
        : reason.code === "COLLABORATION_CREATOR_INVALID_OPEN_ID"
          ? "invalidCreator"
          : reason.code === "COLLABORATION_CREATOR_NOT_ACCEPTED"
            ? "providerNotAccepted"
            : "otherProviderRejection";
    counts.set(category, (counts.get(category) ?? 0) + reason.count);
  }
  const explained = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (failedTotal > explained) {
    counts.set(
      "otherProviderRejection",
      (counts.get("otherProviderRejection") ?? 0) + failedTotal - explained,
    );
  }
  return (
    [
      "duplicateCollaboration",
      "invalidCreator",
      "providerNotAccepted",
      "otherProviderRejection",
    ] as const
  )
    .map((category) => ({ category, count: counts.get(category) ?? 0 }))
    .filter(({ count }) => count > 0);
}

function CampaignWizardSteps({ step, t }: { step: number; t: (key: string) => string }) {
  const labels = [
    t("ecommerce.affiliateCampaign.wizardShop"),
    t("ecommerce.affiliateCampaign.wizardTarget"),
    t("ecommerce.affiliateCampaign.wizardMessage"),
    t("ecommerce.affiliateCampaign.wizardConfirm"),
  ];
  return (
    <div
      className="affiliate-campaign-wizard-steps"
      data-tutorial-id="affiliate-campaign-wizard-stages"
    >
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

/**
 * The product a Campaign is searched and written around: the first it promotes.
 * Mirrors the backend, which reads the same position rather than a separate
 * field.
 */
export function campaignLeadProductId(campaign: Pick<GQL.AffiliateCampaign, "products">): string {
  return campaign.products?.[0]?.productId ?? "";
}

function campaignProductReference(
  campaign: Pick<GQL.AffiliateCampaign, "products" | "productSnapshot">,
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
    return `${t("ecommerce.affiliateCampaign.productIdLabel")} · ${campaignLeadProductId(campaign)}`;
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

export function campaignDecisionReasonLabel(
  reasonCodes: readonly string[] | null | undefined,
  rawReason: string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const codes = new Set((reasonCodes ?? []).map((code) => code.trim().toUpperCase()));
  if (codes.has("PROVIDER_FILTER_MATCH") || codes.has("PROVIDER_ORDER")) {
    return t("ecommerce.affiliateCampaign.decisionReason.providerFilterMatch");
  }
  if (codes.has("PRE_APPROVAL_QUALIFIED")) {
    return t("ecommerce.affiliateCampaign.decisionReason.preApprovalQualified");
  }
  if (codes.has("PRE_APPROVAL_REJECTED")) {
    return t("ecommerce.affiliateCampaign.decisionReason.preApprovalRejected");
  }
  // Every remaining Pre-Approval code is a technical failure. The seller is
  // told the screening could not run, never which internal code said so.
  if ([...codes].some((code) => code.startsWith("PRE_APPROVAL_"))) {
    return t("ecommerce.affiliateCampaign.decisionReason.preApprovalUnavailable");
  }
  if (!rawReason?.trim()) return "—";
  return t("ecommerce.affiliateCampaign.decisionReason.recorded");
}

export function campaignCreatorDetailItem(
  state: CampaignCreatorState,
): CreatorRelationshipDetailItem {
  const relationship = state.creatorRelationship ?? null;
  return {
    creatorId: state.creatorProfile?.id ?? state.creatorId,
    creatorProfile:
      (state.creatorProfile as GQL.AffiliateCreatorIdentity | null | undefined) ?? null,
    creatorRelation: (relationship as GQL.AffiliateCreatorRelationship | null | undefined) ?? null,
    shopState:
      (relationship?.shopStates.find((shopState) => shopState.shopId === state.shopId) as
        | GQL.AffiliateCreatorRelationshipShopState
        | undefined) ?? null,
    managementItem: null,
    workItems: [],
  };
}

export function isAffiliateCampaignCommissionRateValid(value: string | number): boolean {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 1 && rate <= 80;
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
  return input.counterSchemaVersion < (input.introducedInVersion ?? 1) ? null : input.value;
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
    [
      "AFFILIATE_CAMPAIGN_DAILY_CREATOR_OUTREACH_LIMIT_REQUIRED",
      "dailyCreatorOutreachLimitRequired",
    ],
    ["AFFILIATE_CAMPAIGN_DAILY_CREATOR_OUTREACH_LIMIT_INVALID", "dailyCreatorOutreachLimitInvalid"],
    ["AFFILIATE_CAMPAIGN_MAINTENANCE", "campaignMaintenance"],
    ["AFFILIATE_CAMPAIGN_QUALIFICATION_MODEL_NOT_READY", "modelNotReady"],
    ["AFFILIATE_CAMPAIGN_MODEL_READINESS_RETRY", "modelTemporarilyUnavailable"],
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

function searchPlanGenerationErrorMessage(
  errorCode: string | null | undefined,
  t: (key: string) => string,
): string {
  if (errorCode?.includes("SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_UNSUPPORTED")) {
    return t("ecommerce.affiliateCampaign.errors.searchPlanHardConstraintUnsupported");
  }
  if (errorCode?.includes("SEARCH_PLAN_GUIDANCE")) {
    return t("ecommerce.affiliateCampaign.errors.searchPlanHardConstraintRequired");
  }
  return t("ecommerce.affiliateCampaign.errors.generic");
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

function formatProbability(value?: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
}

export function campaignPreApprovalOutcomeLabel(
  preApproved: boolean | null | undefined,
  t: (key: string) => string,
): string {
  if (preApproved == null) {
    return t("ecommerce.affiliateCampaign.preApprovalUnavailable");
  }
  return preApproved
    ? t("ecommerce.affiliateCampaign.preApprovalPassed")
    : t("ecommerce.affiliateCampaign.preApprovalFailed");
}

function formatDateTime(value: string) {
  return formatShortDateTime(value, panelI18n.language);
}

export function normalizeCampaignExplanationLocale(
  value: string,
): "EN" | "ZH" | "DE" | "ES" | "FR" | "ID" | "IT" | "TH" {
  const locale = value.normalize("NFKC").trim().toLocaleLowerCase().split(/[-_]/u)[0];
  return ["en", "zh", "de", "es", "fr", "id", "it", "th"].includes(locale)
    ? (locale.toLocaleUpperCase() as "EN" | "ZH" | "DE" | "ES" | "FR" | "ID" | "IT" | "TH")
    : "EN";
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

/** Customer-facing commission summary. Product ids belong in technical
 * metadata and must never be concatenated into this label. */
export function affiliateCampaignCommissionRange(
  values: ReadonlyArray<number | string | null | undefined>,
): string {
  const rates = [
    ...new Set(
      values.flatMap((value) => {
        if (value == null || String(value).trim() === "") return [];
        const numeric = Number(value);
        return Number.isFinite(numeric) ? [numeric] : [];
      }),
    ),
  ].sort((left, right) => left - right);
  if (rates.length === 0) return "—";
  const format = (value: number) =>
    `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}%`;
  const first = format(rates[0]!);
  const last = format(rates[rates.length - 1]!);
  return first === last ? first : `${first}–${last}`;
}
