// @vitest-environment jsdom
import type { DocumentNode } from "graphql";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { mockObjectUrls } from "../../../test/mock-object-urls.js";
import { AffiliateAccessContext } from "../../hooks/useAffiliateAccess.js";
import { resolveAffiliateStaffAccess } from "../../lib/affiliate-access.js";
import { CreatorRelationshipDetailModal } from "./AffiliateManagementPage.js";
import {
  AffiliateCreatorsRoute,
  AffiliateHistoryRoute,
  AffiliateManualWorkbenchRoute,
  AffiliateWorkbenchRoute,
} from "./AffiliateStaffRoutes.js";

/**
 * What a team lead and a region admin see of the Affiliate workspace (ADR-112).
 * The Backend refuses every operation these logins may not call, so each page
 * they can open must neither issue such an operation nor show the control that
 * would.
 */

vi.mock("../../components/inputs/MessageEmojiPicker.js", () => ({ default: () => null }));
vi.mock("./AffiliateTeamPage.js", () => ({ AffiliateTeamPage: () => null }));

const LEAD = { id: "lead", isOwner: false, permissionScopes: ["AFFILIATE_TEAM_LEAD"] };
const ADMIN = { id: "admin", isOwner: false, permissionScopes: ["AFFILIATE_REGION_ADMIN"] };
const BOTH = {
  id: "both",
  isOwner: false,
  permissionScopes: ["AFFILIATE_TEAM_LEAD", "AFFILIATE_REGION_ADMIN"],
};

const COLLABORATION = {
  id: "collab-1",
  userId: "seller",
  shopId: "shop-1",
  creatorIds: [],
  creatorOpenIds: [],
  productIds: [],
  products: [],
  type: "OPEN",
  status: "ACTIVE",
  platformCollaborationId: "platform-collab-1",
  campaignId: null,
  name: "Summer open plan",
  message: null,
  commissionRate: 0.1,
  openSampleRule: null,
  freeSampleRule: null,
  sellerContactInfo: null,
  lastObservedAt: "2026-09-27T10:00:00.000Z",
};

const creatorItem = (id: string, shopId: string, owner: string | null) => ({
  creatorId: id,
  creatorProfile: { id, displayName: `Creator ${id}`, nickname: `Creator ${id}`, username: id, performances: [] },
  creatorRelation: {
    id: `rel-${id}`,
    businessDeveloperId: owner,
    manualTags: [],
    systemTags: [],
    shopStates: [{ shopId }],
  },
  latestAffiliateCollaboration: null,
  lastInteractionAt: null,
});

const state = vi.hoisted(() => ({
  operations: [] as string[],
  creatorInputs: [] as Record<string, unknown>[],
  entityStore: {} as Record<string, unknown>,
  capabilities: { kind: "STAFF", isTeamLead: true, isRegionAdmin: false },
  detail: {} as Record<string, unknown>,
  // One object per test: a query result that changes identity every render would loop the loaded-query hooks.
  data: {} as Record<string, unknown>,
  refetch: vi.fn(),
  fetchMore: vi.fn(),
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.entityStore }));
vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  useLazyQuery: () => [vi.fn(), { loading: false }],
  useApolloClient: () => ({ query: vi.fn() }),
  useQuery: (
    document: DocumentNode,
    options?: { skip?: boolean; variables?: { input?: Record<string, unknown> } },
  ) => {
    const definition = document.definitions.find((d) => d.kind === "OperationDefinition");
    const operation = definition?.kind === "OperationDefinition" ? definition.name!.value : "";
    if (!options?.skip) state.operations.push(operation);
    if (!options?.skip && operation === "AffiliateCreators") state.creatorInputs.push(options?.variables?.input ?? {});
    return {
      data: options?.skip ? undefined : state.data,
      loading: false,
      refetch: state.refetch,
      fetchMore: state.fetchMore,
    };
  },
}));

function buildData() {
  const page = { items: [], productSummaries: [], hasMore: false, nextCursor: null };
  return {
    affiliateViewerCapabilities: state.capabilities,
    affiliateTeamLeadSubtree: {
      self: { id: "lead-self", displayName: "Mei", parentLeadId: null },
      descendantLeads: [],
      businessDevelopers: [{ id: "bd-alice", displayName: "Alice", parentLeadId: "lead-self" }],
    },
    affiliateRegionBusinessDeveloperOptions: [{ id: "bd-alice", displayName: "Alice" }],
    affiliateCollaborations: [COLLABORATION],
    affiliateCollaborationDetail: {
      collaboration: COLLABORATION,
      creators: [],
      sampleApplications: [],
      productSummaries: [],
    },
    affiliateProductSummaries: [],
    affiliateCreators: {
      items: [
        creatorItem("in-scope", "shop-1", "bd-alice"),
        creatorItem("public", "shop-1", null),
        creatorItem("outside", "shop-9", "bd-alice"),
      ],
      hasMore: false,
    },
    creatorManualTags: [],
    affiliateCreatorSystemTagDefinitions: [],
    affiliateActionProposalPage: page,
    affiliateEscalationPage: { items: [], totalCount: 0 },
    affiliateWorkbenchSamplePage: { items: [], hasMore: false, nextCursor: null },
    affiliateWorkbenchPendingConversationPage: { items: [], hasMore: false, nextCursor: null },
    affiliateCreatorRelationshipDetail: state.detail,
    affiliateRelationshipSampleApplications: page,
    affiliateRelationshipPlatformCollaborations: page,
    affiliateRelationshipTimeline: { items: [], hasOlder: false },
    affiliateCreatorMessageHistory: { items: [], hasMore: false },
    affiliateCreatorContactState: { channelContacts: [], whatsAppAccounts: [], emailAccounts: [] },
  };
}

function signIn(user: typeof LEAD | typeof ADMIN | typeof BOTH, capabilities: typeof state.capabilities) {
  state.capabilities = capabilities;
  state.data = buildData();
  state.entityStore = {
    currentUser: user,
    shops: [
      {
        id: "shop-1",
        alias: "Shop One",
        shopName: "Shop One",
        platform: "TIKTOK_SHOP",
        authStatus: "AUTHORIZED",
        services: { affiliateService: { enabled: true } },
      },
    ],
    fetchShops: vi.fn().mockResolvedValue(undefined),
    messageTranslation: { translate: vi.fn() },
    ensureCategories: vi.fn().mockResolvedValue(undefined),
    productCategoryName: () => null,
    affiliateWorkspace: {
      businessDevelopers: [],
      replaceAffiliateBusinessDevelopers: vi.fn(),
      getBusinessDeveloper: vi.fn(),
      proposalProjection: () => null,
      upsertAffiliateActionProposal: vi.fn(),
      upsertAffiliateCreatorRelationship: vi.fn(),
    },
  };
}
const asLead = () => signIn(LEAD, { kind: "STAFF", isTeamLead: true, isRegionAdmin: false });
const asRegionAdmin = () => signIn(ADMIN, { kind: "STAFF", isTeamLead: false, isRegionAdmin: true });
const asBoth = () => signIn(BOTH, { kind: "STAFF", isTeamLead: true, isRegionAdmin: true });

// Operations the Backend refuses a team lead / a region admin (ADR-112).
const REFUSED_TO_STAFF = [
  "AffiliateBusinessDevelopers",
  "AffiliateSampleReviewerOptions",
  "AffiliateChatCampaignTemplates",
  "AffiliateCreatorUpdateExportPage",
];
const REFUSED_TO_REGION_ADMIN = [
  "AffiliateCreatorContactState",
  "AffiliateCreatorMessageHistory",
  "AffiliateActionProposals",
  "AffiliateRelationshipPlatformCollaborations",
  "AffiliateOperationalProjectionHealth",
];

beforeEach(async () => {
  mockObjectUrls();
  await i18n.changeLanguage("en");
  state.operations.length = 0;
  state.creatorInputs.length = 0;
  state.detail = {
    viewerCanPerformDailyOperations: false,
    viewerCanEditCreatorConfiguration: false,
    creator: { id: "creator-profile", displayName: "Test Creator", nickname: "Test Creator", username: "tester", performances: [] },
    creatorRelationship: {
      id: "rel-in-scope",
      businessDeveloperId: "bd-alice",
      shopStates: [{ shopId: "shop-1", sampleTier: "SAMPLE_DELIVERED" }],
      agendaItems: [],
      manualTags: [],
      systemTags: [],
      workSummary: { agentRequiredCount: 0, staffRequiredCount: 0, externalWaitingCount: 0 },
    },
    includedShopIds: ["shop-1"],
    counts: { sampleApplicationCount: 0, platformCollaborationCount: 0, pendingProposalCount: 0, lifecycleEventCount: 0 },
    shopActivitySummaries: [],
  };
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const toast = (node: React.ReactNode) => <ToastProvider>{node}</ToastProvider>;
const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

describe("Creator list for a team lead", () => {
  it("reads BDs from the subtree, never the roster, and offers the team as the default filter", () => {
    asLead();
    render(toast(<AffiliateCreatorsRoute />));

    expect(state.operations).toContain("AffiliateTeamLeadSubtree");
    expect(state.operations).not.toContain("AffiliateRegionBusinessDeveloperOptions");
    for (const refused of REFUSED_TO_STAFF) expect(state.operations).not.toContain(refused);
    const filter = screen.getByRole("button", { name: text("ecommerce.affiliateWorkspace.businessDeveloperFilter") });
    expect(filter.textContent).toContain(text("ecommerce.affiliateStaff.allMyTeam"));
    // The default sends no BD filter: the Backend answers with the whole subtree.
    expect(state.creatorInputs.at(-1)).toMatchObject({ businessDeveloperId: null });
  });

  it("names owners from the subtree, offers no export and no allocation", () => {
    asLead();
    render(toast(<AffiliateCreatorsRoute />));

    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
    expect(screen.queryByRole("button", { name: text("ecommerce.creatorExport.button") })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change BD" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign BD" })).toBeNull();
    expect(screen.getByText(text("ecommerce.affiliateStaff.teamLeadNotice"))).toBeTruthy();
  });
});

describe("Creator list for a region admin", () => {
  it("reads BD options for the region, and none of what the Backend refuses a region admin", () => {
    asRegionAdmin();
    render(toast(<AffiliateCreatorsRoute />));

    expect(state.operations).toContain("AffiliateRegionBusinessDeveloperOptions");
    expect(state.operations).not.toContain("AffiliateTeamLeadSubtree");
    for (const refused of [...REFUSED_TO_STAFF, ...REFUSED_TO_REGION_ADMIN]) {
      expect(state.operations).not.toContain(refused);
    }
    const filter = screen.getByRole("button", { name: text("ecommerce.affiliateWorkspace.businessDeveloperFilter") });
    expect(filter.textContent).toContain(text("ecommerce.affiliateWorkspace.allBusinessDevelopers"));
  });

  it("offers assign or change and release only on Creators whose shops are all in scope", () => {
    asRegionAdmin();
    render(toast(<AffiliateCreatorsRoute />));

    // One owned in-scope Creator (change + release), one public-pool Creator (assign), one with a
    // shop outside the admin's shops (nothing).
    expect(screen.getAllByRole("button", { name: "Change BD" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Assign BD" })).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: text("ecommerce.affiliateWorkspace.releaseCreator") }),
    ).toHaveLength(1);
    expect(screen.getByText(text("ecommerce.affiliateStaff.regionAdminNotice"))).toBeTruthy();
  });

  it("opens no BD roster detail from an owner name and offers no export", () => {
    asRegionAdmin();
    render(toast(<AffiliateCreatorsRoute />));
    expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
    expect(screen.queryByRole("button", { name: text("ecommerce.creatorExport.button") })).toBeNull();
  });

  it("opening a Creator's allocation does not open its detail", () => {
    asRegionAdmin();
    render(toast(<AffiliateCreatorsRoute />));
    fireEvent.click(screen.getAllByRole("button", { name: "Assign BD" })[0]!);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector(".affiliate-relationship-work-modal")).toBeNull();
  });
});

describe("a login holding both facets", () => {
  it("reads the subtree and the region options, and allocates", () => {
    asBoth();
    render(toast(<AffiliateCreatorsRoute />));
    expect(state.operations).toContain("AffiliateTeamLeadSubtree");
    expect(state.operations).toContain("AffiliateRegionBusinessDeveloperOptions");
    expect(screen.getAllByRole("button", { name: "Change BD" })).toHaveLength(1);
    expect(screen.getByText(text("ecommerce.affiliateStaff.teamLeadAndRegionAdminNotice"))).toBeTruthy();
  });
});

describe("pages closed to the wrong kind of staff", () => {
  it.each([
    ["Agent Workbench", AffiliateWorkbenchRoute],
    ["Manual Workbench", AffiliateManualWorkbenchRoute],
    ["Platform collaborations", AffiliateHistoryRoute],
  ])("shows a region admin that %s is not for their role, and loads none of it", (_name, Route) => {
    asRegionAdmin();
    render(toast(<Route />));
    expect(screen.getByText(text("ecommerce.affiliateStaff.unavailableTitle"))).toBeTruthy();
    expect(state.operations).toEqual(["AffiliateViewerCapabilities"]);
  });

  it("says a staff login without a profile is not set up, and loads no Affiliate data", () => {
    signIn(LEAD, { kind: "STAFF", isTeamLead: false, isRegionAdmin: false });
    render(toast(<AffiliateCreatorsRoute />));
    expect(screen.getByText(text("ecommerce.affiliateStaff.notSetUpTitle"))).toBeTruthy();
    expect(state.operations).toEqual(["AffiliateViewerCapabilities"]);
  });
});

describe("Workbenches for a team lead", () => {
  it.each([
    ["Agent Workbench", AffiliateWorkbenchRoute],
    ["Manual Workbench", AffiliateManualWorkbenchRoute],
  ])("%s filters by the team and never reads the BD roster", (_name, Route) => {
    asLead();
    render(toast(<Route />));

    expect(state.operations).toContain("AffiliateTeamLeadSubtree");
    for (const refused of REFUSED_TO_STAFF) expect(state.operations).not.toContain(refused);
    const filter = screen.getByRole("button", { name: text("ecommerce.affiliateWorkspace.businessDeveloperFilter") });
    expect(filter.textContent).toContain(text("ecommerce.affiliateStaff.allMyTeam"));
    expect(screen.getByText(text("ecommerce.affiliateStaff.teamLeadNotice"))).toBeTruthy();
  });
});

describe("Platform collaborations for a team lead", () => {
  it("lists and opens collaborations without offering to create, configure, edit or remove", () => {
    asLead();
    render(toast(<AffiliateHistoryRoute />));
    const operation = (key: string) => text(`ecommerce.affiliateWorkspace.collaborationOperations.${key}`);

    expect(screen.queryByRole("button", { name: operation("newCollaboration") })).toBeNull();
    expect(screen.queryByRole("button", { name: operation("openSettings") })).toBeNull();
    for (const refused of REFUSED_TO_STAFF) expect(state.operations).not.toContain(refused);

    fireEvent.click(screen.getByText("Summer open plan"));
    expect(screen.getByRole("heading", { name: "Summer open plan" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: operation("editConfiguration") })).toBeNull();
    expect(screen.queryByRole("button", { name: operation("removeFromPlatform") })).toBeNull();
  });
});

describe("Creator detail", () => {
  const renderDetail = (access: ReturnType<typeof resolveAffiliateStaffAccess>) =>
    render(
      toast(
        <AffiliateAccessContext.Provider value={access!}>
          <CreatorRelationshipDetailModal
            relationshipId="rel-in-scope"
            selectedShopId=""
            businessDeveloperOnly={false}
            initialTab="overview"
            onClose={() => {}}
          />
        </AffiliateAccessContext.Provider>,
      ),
    );
  const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent ?? "");
  const label = (key: string) => text(`ecommerce.affiliateWorkspace.${key}`);

  it("gives a region admin the profile, samples and activity tabs and opens on the profile", () => {
    asRegionAdmin();
    renderDetail(resolveAffiliateStaffAccess({ kind: "STAFF", isTeamLead: false, isRegionAdmin: true }));

    const names = tabNames().join("|");
    expect(names).toContain(label("relationshipPanelProfile"));
    expect(names).toContain(label("relationshipPanelSamples"));
    expect(names).toContain(label("relationshipPanelActivity"));
    expect(names).not.toContain(label("relationshipPanelCurrentWork"));
    expect(names).not.toContain(label("relationshipPanelCommunication"));
    expect(names).not.toContain(label("relationshipPanelPlatformCollaborations"));
    expect(
      screen.getByRole("tab", { name: new RegExp(label("relationshipPanelProfile")) }).getAttribute("aria-selected"),
    ).toBe("true");
    for (const refused of [...REFUSED_TO_STAFF, ...REFUSED_TO_REGION_ADMIN]) {
      expect(state.operations).not.toContain(refused);
    }
  });

  it("hides the contact routes from a region admin and shows allocation in management", () => {
    asRegionAdmin();
    renderDetail(resolveAffiliateStaffAccess({ kind: "STAFF", isTeamLead: false, isRegionAdmin: true }));

    expect(screen.queryByRole("tab", { name: label("relationshipInspectorContacts") })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: label("relationshipInspectorManagement") }));
    expect(state.operations).not.toContain("AffiliateBusinessDevelopers");
    expect(screen.getByRole("button", { name: "Change BD" })).toBeTruthy();
    expect(screen.getByText(text("ecommerce.affiliateStaff.creatorViewOnly"))).toBeTruthy();
  });

  it("gives a team lead every tab, names the owner from the subtree and offers no write", () => {
    asLead();
    renderDetail(resolveAffiliateStaffAccess({ kind: "STAFF", isTeamLead: true, isRegionAdmin: false }));

    const names = tabNames().join("|");
    expect(names).toContain(label("relationshipPanelCurrentWork"));
    expect(names).toContain(label("relationshipPanelCommunication"));
    expect(names).toContain(label("relationshipPanelPlatformCollaborations"));
    fireEvent.click(screen.getByRole("tab", { name: label("relationshipInspectorManagement") }));
    expect(state.operations).not.toContain("AffiliateBusinessDevelopers");
    const owner = document.querySelector(".affiliate-relationship-owner-value strong");
    expect(owner?.textContent).toBe("Alice");
    expect(screen.queryByRole("button", { name: "Change BD" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign BD" })).toBeNull();
    expect(screen.queryByRole("button", { name: text("ecommerce.affiliateWorkspace.releaseCreator") })).toBeNull();
  });

  it("offers allocation only when every shop of the Creator is in the admin's shops", () => {
    asRegionAdmin();
    (state.detail.creatorRelationship as { shopStates: unknown[] }).shopStates = [
      { shopId: "shop-1" },
      { shopId: "shop-9" },
    ];
    renderDetail(resolveAffiliateStaffAccess({ kind: "STAFF", isTeamLead: false, isRegionAdmin: true }));
    fireEvent.click(screen.getByRole("tab", { name: label("relationshipInspectorManagement") }));
    const management = document.querySelector(".affiliate-relationship-owner-card") as HTMLElement;
    expect(within(management).queryByRole("button", { name: "Change BD" })).toBeNull();
  });
});
