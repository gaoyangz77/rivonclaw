// @vitest-environment jsdom
import type { DocumentNode } from "graphql";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { WorkspaceTabProvider } from "../../lib/workspace-tab-context.js";
import { AffiliateCampaignRoute } from "./AffiliateStaffRoutes.js";
import {
  campaignCreatorLabel,
  campaignStrategyOffered,
  defaultCampaignStrategy,
} from "./affiliate-campaign-access.js";
import { campaignErrorMessage } from "./AffiliateCampaignPage.js";

/**
 * What each login sees of the Campaign page and which operations it issues
 * (ADR-118). The Backend refuses the search-only helpers for a BD, so the page
 * must not request them; a region admin without `CAMPAIGN` and a team lead see
 * no page at all.
 */

vi.mock("../../components/inputs/MessageEmojiPicker.js", () => ({ default: () => null }));
vi.mock("./AffiliateTeamPage.js", () => ({ AffiliateTeamPage: () => null }));

const BD = { id: "bd", isOwner: false, permissionScopes: ["AFFILIATE_BUSINESS_DEVELOPER"] };
const OWNER = { id: "owner", isOwner: true, permissionScopes: ["AFFILIATE"] };
const REGION_ADMIN = { id: "ra", isOwner: false, permissionScopes: ["AFFILIATE_REGION_ADMIN"] };
const TEAM_LEAD = { id: "lead", isOwner: false, permissionScopes: ["AFFILIATE_TEAM_LEAD"] };

const FORBIDDEN_FOR_BD = [
  "AffiliateCampaignAiReadiness",
  "AffiliateMarketplaceCreatorRuleCapabilities",
  "AffiliateCampaignSearchPlanSummaries",
];

const campaign = (id: string, name: string, createdBy: Record<string, unknown> | null) => ({
  id,
  userId: "seller",
  shopId: "shop-1",
  name,
  status: "ACTIVE",
  productSnapshot: null,
  searchPlanGuidance: null,
  market: "US",
  dailyOutreachTarget: 20,
  products: [{ productId: "p1", commissionRatePercent: 10, shopAdsCommissionRatePercent: 10 }],
  selectionPolicy: { strategy: "CREATOR_LIST" },
  templateVersion: 1,
  updatedAt: "2026-11-25T08:00:00.000Z",
  createdAt: "2026-11-25T08:00:00.000Z",
  createdByBusinessDeveloperId: null,
  createdBy,
});

const state = vi.hoisted(() => ({
  operations: [] as string[],
  entityStore: {} as Record<string, unknown>,
  capabilities: {} as Record<string, unknown>,
  data: {} as Record<string, unknown>,
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.entityStore }));
vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  useLazyQuery: () => [vi.fn(), { loading: false }],
  useApolloClient: () => ({ query: vi.fn() }),
  useQuery: (document: DocumentNode, options?: { skip?: boolean }) => {
    const definition = document.definitions.find((d) => d.kind === "OperationDefinition");
    const operation = definition?.kind === "OperationDefinition" ? definition.name!.value : "";
    if (!options?.skip) state.operations.push(operation);
    const data =
      operation === "AffiliateViewerCapabilities"
        ? { affiliateViewerCapabilities: state.capabilities }
        : state.data;
    return {
      data: options?.skip ? undefined : data,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      fetchMore: vi.fn(),
    };
  },
}));

function renderCampaigns(user: Record<string, unknown>) {
  state.entityStore = { currentUser: user };
  return render(
    <ToastProvider>
      <WorkspaceTabProvider
        value={{ tabId: "t", active: true, view: {}, setView: vi.fn(), setDirty: vi.fn() }}
      >
        <AffiliateCampaignRoute />
      </WorkspaceTabProvider>
    </ToastProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  state.operations = [];
  state.capabilities = {};
  state.data = {
    affiliateCampaigns: [
      campaign("c-owner", "Owner Campaign", { kind: "OWNER", displayName: null }),
      campaign("c-admin", "Region Admin Campaign", { kind: "MEMBER", displayName: "Rae Region" }),
      campaign("c-bd", "Casey Campaign", {
        kind: "BUSINESS_DEVELOPER",
        displayName: "Casey",
        businessDeveloperId: "bd-1",
      }),
      campaign("c-old", "Old Campaign", null),
    ],
    shops: [],
  };
});

afterEach(() => cleanup());

describe("Campaign page for a BD", () => {
  it("never requests an operation the Backend refuses a BD", () => {
    renderCampaigns(BD);
    expect(state.operations).toContain("AffiliateCampaigns");
    for (const operation of FORBIDDEN_FOR_BD) {
      expect(state.operations, operation).not.toContain(operation);
    }
    // The BD reads Campaign products through the Campaign query, never the VIEW one.
    expect(state.operations).not.toContain("AffiliateProductSummaries");
  });

  it("is not held on a capabilities request", () => {
    renderCampaigns(BD);
    expect(state.operations).not.toContain("AffiliateViewerCapabilities");
    expect(screen.queryByText(i18n.t("ecommerce.affiliateStaff.unavailableTitle"))).toBeNull();
  });
});

describe("Campaign page for a supervisor", () => {
  it("keeps requesting the AI readiness helper", () => {
    renderCampaigns(OWNER);
    expect(state.operations).toContain("AffiliateCampaignAiReadiness");
  });
});

describe("Campaign creator column", () => {
  it("names the BD, the member and the owner, and shows 管理员 for a Campaign without a creator", () => {
    renderCampaigns(OWNER);
    const body = document.body.textContent ?? "";
    expect(screen.getAllByText("创建人").length).toBeGreaterThan(0);
    expect(body).toContain("Casey");
    expect(body).toContain("Rae Region");
    expect(body).toContain("主账号");
    expect(screen.getAllByText("管理员").length).toBe(1);
  });

  it("labels a missing creator as an admin in every language", async () => {
    for (const language of ["en", "zh", "de", "es", "fr", "id", "it", "th"]) {
      await i18n.changeLanguage(language);
      expect(campaignCreatorLabel({ createdBy: null }, i18n.t.bind(i18n))).toBe(
        i18n.t("ecommerce.affiliateCampaign.createdByAdmin"),
      );
      expect(i18n.exists("ecommerce.affiliateCampaign.createdByLabel")).toBe(true);
    }
  });
});

describe("Campaign page for staff", () => {
  const regionAdmin = (permissions: string[]) => ({
    kind: "STAFF",
    isTeamLead: false,
    isRegionAdmin: true,
    teamLeadPermissions: [],
    regionAdminPermissions: permissions,
  });

  it("opens for a region admin holding CAMPAIGN and requests the search helpers", () => {
    state.capabilities = regionAdmin(["ALLOCATE", "CAMPAIGN"]);
    renderCampaigns(REGION_ADMIN);
    expect(state.operations).toContain("AffiliateCampaigns");
    expect(state.operations).toContain("AffiliateCampaignAiReadiness");
  });

  it("shows a region admin without CAMPAIGN the unavailable state and no Campaign request", () => {
    state.capabilities = regionAdmin(["VIEW", "OPERATE", "ALLOCATE"]);
    renderCampaigns(REGION_ADMIN);
    expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.unavailableTitle"))).toBeTruthy();
    expect(state.operations).not.toContain("AffiliateCampaigns");
  });

  it("shows a team lead the unavailable state and no Campaign request", () => {
    state.capabilities = {
      kind: "STAFF",
      isTeamLead: true,
      isRegionAdmin: false,
      teamLeadPermissions: ["VIEW", "OPERATE", "ALLOCATE"],
      regionAdminPermissions: [],
    };
    renderCampaigns(TEAM_LEAD);
    expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.unavailableTitle"))).toBeTruthy();
    expect(state.operations).not.toContain("AffiliateCampaigns");
  });
});

describe("strategy choice", () => {
  const { MarketplaceRules, AiPreApproval, CreatorList } = GQL.AffiliateCampaignSelectionStrategy;

  it("offers a BD the Creator list alone and starts on it", () => {
    expect(campaignStrategyOffered([CreatorList], CreatorList)).toBe(true);
    expect(campaignStrategyOffered([CreatorList], MarketplaceRules)).toBe(false);
    expect(campaignStrategyOffered([CreatorList], AiPreApproval)).toBe(false);
    expect(defaultCampaignStrategy([CreatorList])).toBe(CreatorList);
  });

  it("starts a full-access login on the rule search", () => {
    expect(defaultCampaignStrategy([MarketplaceRules, AiPreApproval, CreatorList])).toBe(
      MarketplaceRules,
    );
  });
});

describe("a BD writing a search strategy", () => {
  it("is told in plain words, not the generic failure", async () => {
    for (const language of ["en", "zh", "de", "es", "fr", "id", "it", "th"]) {
      await i18n.changeLanguage(language);
      const message = campaignErrorMessage(
        new Error("CAMPAIGN_STRATEGY_NOT_ALLOWED: Business developers can only create Creator-list Campaigns"),
        i18n.t.bind(i18n),
      );
      expect(message).toBe(i18n.t("ecommerce.affiliateCampaign.errors.strategyNotAllowed"));
      expect(message).not.toBe(i18n.t("ecommerce.affiliateCampaign.errors.generic"));
    }
  });
});
