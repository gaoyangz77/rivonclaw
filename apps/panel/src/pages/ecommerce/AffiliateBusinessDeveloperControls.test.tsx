// @vitest-environment jsdom
import type { DocumentNode } from "graphql";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { AffiliateCreatorsPage, AffiliateHistoryPage } from "./AffiliateManagementPage.js";

/**
 * A business developer (BD) only member works a reduced Affiliate workspace
 * (ADR 085). The backend refuses supervision operations for them, so the pages
 * they can open must not offer the controls that would call those operations.
 */

const BD_ONLY = {
  id: "bd-user",
  isOwner: false,
  permissionScopes: ["AFFILIATE_BUSINESS_DEVELOPER"],
};
const SUPERVISOR = {
  id: "supervisor-user",
  isOwner: false,
  permissionScopes: ["AFFILIATE", "AFFILIATE_BUSINESS_DEVELOPER"],
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

const CREATOR_ITEM = {
  creatorId: "creator-1",
  creatorProfile: {
    id: "creator-1",
    displayName: "Test Creator",
    nickname: "Test Creator",
    username: "tester",
    performances: [],
  },
  creatorRelation: {
    id: "relationship-1",
    businessDeveloperId: "bd-alice",
    manualTags: [],
    systemTags: [],
    shopStates: [],
  },
  latestAffiliateCollaboration: null,
  lastInteractionAt: null,
};

const state = vi.hoisted(() => ({
  operations: [] as string[],
  entityStore: {} as Record<string, unknown>,
  openedDeveloperDetails: [] as string[],
}));

// The roster detail is the Team page in detail mode, whose first read is the supervision-only
// `affiliateBusinessDeveloperPage`. A stub records that it was mounted, and for whom.
vi.mock("./AffiliateTeamPage.js", () => ({
  AffiliateTeamPage: ({ detailOnlyDeveloper }: { detailOnlyDeveloper?: { id: string } }) => {
    if (detailOnlyDeveloper) state.openedDeveloperDetails.push(detailOnlyDeveloper.id);
    return null;
  },
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
    return {
      data: {
        affiliateCollaborations: [COLLABORATION],
        affiliateCollaborationDetail: {
          collaboration: COLLABORATION,
          creators: [],
          sampleApplications: [],
          productSummaries: [],
        },
        affiliateProductSummaries: [],
        affiliateCreators: { items: [CREATOR_ITEM], hasMore: false },
        affiliateBusinessDevelopers: [{ id: "bd-alice", displayName: "Alice" }],
        creatorManualTags: [],
        affiliateCreatorSystemTagDefinitions: [],
      },
      loading: false,
      refetch: vi.fn(),
      fetchMore: vi.fn(),
    };
  },
}));

function signIn(user: typeof BD_ONLY | typeof SUPERVISOR) {
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
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  state.operations.length = 0;
  state.openedDeveloperDetails.length = 0;
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const collaborationKey = (key: string) =>
  i18n.t(`ecommerce.affiliateWorkspace.collaborationOperations.${key}`);

function renderHistory() {
  render(
    <ToastProvider>
      <AffiliateHistoryPage />
    </ToastProvider>,
  );
}

function openCollaboration() {
  fireEvent.click(screen.getByText("Summer open plan"));
}

describe("Collaboration history for a business developer", () => {
  it("lists and opens collaborations without offering to create, configure, edit or remove", () => {
    signIn(BD_ONLY);
    renderHistory();

    expect(screen.queryByRole("button", { name: collaborationKey("newCollaboration") })).toBeNull();
    expect(screen.queryByRole("button", { name: collaborationKey("openSettings") })).toBeNull();

    openCollaboration();
    expect(screen.getByRole("heading", { name: "Summer open plan" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: collaborationKey("editConfiguration") }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: collaborationKey("removeFromPlatform") }),
    ).toBeNull();
  });

  it("keeps every collaboration control for a supervisor", () => {
    signIn(SUPERVISOR);
    renderHistory();

    expect(screen.getByRole("button", { name: collaborationKey("newCollaboration") })).toBeTruthy();
    expect(screen.getByRole("button", { name: collaborationKey("openSettings") })).toBeTruthy();

    openCollaboration();
    expect(
      screen.getByRole("button", { name: collaborationKey("editConfiguration") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: collaborationKey("removeFromPlatform") }),
    ).toBeTruthy();
  });
});

describe("Creators list for a business developer", () => {
  function renderCreators() {
    render(
      <ToastProvider>
        <AffiliateCreatorsPage />
      </ToastProvider>,
    );
  }

  it("shows the owning BD as text and never loads the BD roster detail", () => {
    signIn(BD_ONLY);
    renderCreators();

    expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(state.openedDeveloperDetails).toEqual([]);
  });

  it("lets a supervisor open the BD roster detail from a Creator row", () => {
    signIn(SUPERVISOR);
    renderCreators();

    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    expect(state.openedDeveloperDetails).toEqual(["bd-alice"]);
  });
});
