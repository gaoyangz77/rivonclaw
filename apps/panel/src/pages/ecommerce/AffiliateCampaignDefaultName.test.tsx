// @vitest-environment jsdom
import type { DocumentNode } from "graphql";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { WorkspaceTabProvider } from "../../lib/workspace-tab-context.js";
import { AffiliateCampaignRoute } from "./AffiliateStaffRoutes.js";

/**
 * ADR-120 in the Campaign wizard: a new Campaign's name follows the seller's default template until
 * the person types one, and a copy is named from the same template. The Backend facts are mocked; the
 * Panel renders them.
 */

vi.mock("../../components/inputs/MessageEmojiPicker.js", () => ({ default: () => null }));
vi.mock("./AffiliateTeamPage.js", () => ({ AffiliateTeamPage: () => null }));

const OWNER = { id: "owner", isOwner: true, permissionScopes: ["AFFILIATE"] };
const LEAD = "1737647724406212416";

const state = vi.hoisted(() => ({
  entityStore: {} as Record<string, unknown>,
  data: {} as Record<string, unknown>,
  namingContext: vi.fn(),
  duplicate: vi.fn(),
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.entityStore }));
vi.mock("@apollo/client/react", () => ({
  useMutation: (document: DocumentNode) => {
    const definition = document.definitions.find((d) => d.kind === "OperationDefinition");
    const operation = definition?.kind === "OperationDefinition" ? definition.name!.value : "";
    return [
      operation === "DuplicateAffiliateCampaign" ? state.duplicate : vi.fn(),
      { loading: false },
    ];
  },
  useLazyQuery: () => [vi.fn(), { loading: false }],
  useApolloClient: () => ({
    query: (options: { variables: unknown }) => state.namingContext(options.variables),
  }),
  useQuery: (_document: DocumentNode, options?: { skip?: boolean }) => ({
    data: options?.skip ? undefined : state.data,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    fetchMore: vi.fn(),
  }),
}));

const sourceCampaign = {
  id: "c-source",
  userId: "seller",
  shopId: "shop-1",
  name: "Summer list",
  status: "ACTIVE",
  productSnapshot: null,
  searchPlanGuidance: null,
  market: "US",
  dailyOutreachTarget: 20,
  products: [{ productId: LEAD, commissionRatePercent: 10, shopAdsCommissionRatePercent: 10 }],
  selectionPolicy: { strategy: "CREATOR_LIST" },
  searchPlanning: { state: "READY", activePlanId: null, generationRequest: null },
  collaborationInvitationText: "",
  messageTemplateText: "Hi {{creator_name}}",
  messageTemplateSource: "USER_AUTHORED",
  templateVersion: 1,
  updatedAt: "2026-11-25T08:00:00.000Z",
  createdAt: "2026-11-25T08:00:00.000Z",
  createdByBusinessDeveloperId: null,
  createdBy: { kind: "OWNER", displayName: null },
};

function namingContext(template: string, sequence = 3) {
  return {
    data: {
      affiliateCampaignNamingContext: {
        template,
        businessDeveloperName: "黄海燕",
        businessDeveloperEnglishName: "Rosa",
        sequence,
      },
    },
  };
}

function renderCampaigns() {
  state.entityStore = { currentUser: OWNER };
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

const nameInput = () => screen.getByPlaceholderText("夏季达人获客") as HTMLInputElement;

async function openWizardAndPickShop() {
  fireEvent.click(screen.getAllByRole("button", { name: /新建推广计划/ })[0]);
  fireEvent.click(await screen.findByText("选择已授权店铺"));
  // The dropdown is portalled to the end of the body, after the Campaign table's own shop cell.
  fireEvent.click((await screen.findAllByText("Holylegend")).at(-1)!);
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  state.namingContext.mockReset();
  state.duplicate.mockReset();
  state.data = {
    affiliateCampaigns: [sourceCampaign],
    shops: [
      {
        id: "shop-1",
        shopName: "Holylegend",
        alias: null,
        region: "US",
        timezone: "America/Los_Angeles",
        platform: "TIKTOK_SHOP",
        authStatus: "AUTHORIZED",
      },
    ],
  };
});
afterEach(() => cleanup());

describe("default Campaign name in the wizard (ADR-120)", () => {
  it("fills the name from the template once the shop and the lead product are known, and re-renders on a product change", async () => {
    state.namingContext.mockImplementation((variables: { input: { productId: string } }) =>
      Promise.resolve(
        namingContext(
          "{{bd_english_name}}--{{product_id}}--{{sequence}}",
          variables.input.productId === LEAD ? 3 : 1,
        ),
      ),
    );
    renderCampaigns();
    await openWizardAndPickShop();
    // Nothing is asked before the lead product is known.
    expect(state.namingContext).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("输入准确的 TikTok Shop 商品 ID"), {
      target: { value: LEAD },
    });
    await waitFor(() => expect(nameInput().value).toBe(`Rosa--${LEAD}--3`));
    expect(state.namingContext).toHaveBeenCalledOnce();
    expect(state.namingContext).toHaveBeenCalledWith({
      input: {
        shopId: "shop-1",
        productId: LEAD,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    fireEvent.change(screen.getByPlaceholderText("输入准确的 TikTok Shop 商品 ID"), {
      target: { value: "999" },
    });
    await waitFor(() => expect(nameInput().value).toBe("Rosa--999--1"));
  });

  it("stops following once the person types a name", async () => {
    state.namingContext.mockResolvedValue(namingContext("{{sequence}}"));
    renderCampaigns();
    await openWizardAndPickShop();
    const productInput = screen.getByPlaceholderText("输入准确的 TikTok Shop 商品 ID");
    fireEvent.change(productInput, { target: { value: LEAD } });
    await waitFor(() => expect(nameInput().value).toBe("3"));
    fireEvent.change(nameInput(), { target: { value: "My own name" } });
    fireEvent.change(productInput, { target: { value: "999" } });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(nameInput().value).toBe("My own name");
    expect(state.namingContext).toHaveBeenCalledOnce();
  });

  it("changes nothing while the seller has no template", async () => {
    state.namingContext.mockResolvedValue(namingContext(""));
    renderCampaigns();
    await openWizardAndPickShop();
    fireEvent.change(screen.getByPlaceholderText("输入准确的 TikTok Shop 商品 ID"), {
      target: { value: LEAD },
    });
    await waitFor(() => expect(state.namingContext).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(nameInput().value).toBe("");
  });

  it("starts following again for the next new Campaign", async () => {
    state.namingContext.mockResolvedValue(namingContext("{{sequence}}"));
    renderCampaigns();
    await openWizardAndPickShop();
    fireEvent.change(nameInput(), { target: { value: "typed" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await openWizardAndPickShop();
    fireEvent.change(screen.getByPlaceholderText("输入准确的 TikTok Shop 商品 ID"), {
      target: { value: LEAD },
    });
    await waitFor(() => expect(nameInput().value).toBe("3"));
  });
});

describe("copying a Campaign (ADR-120)", () => {
  const copy = { ...sourceCampaign, id: "c-copy", status: "DRAFT" };

  async function copySource() {
    state.duplicate.mockResolvedValue({ data: { duplicateAffiliateCampaign: copy } });
    renderCampaigns();
    fireEvent.click(await screen.findByText("Summer list"));
    fireEvent.click(await screen.findByRole("button", { name: "复制推广计划" }));
    await waitFor(() => expect(state.duplicate).toHaveBeenCalledOnce());
  }

  it("names the copy from the template, rendered for the source's shop and lead product", async () => {
    state.namingContext.mockResolvedValue(
      namingContext("{{bd_english_name}}-{{product_id}}-{{sequence}}", 2),
    );
    await copySource();
    expect(state.namingContext).toHaveBeenCalledWith({
      input: {
        shopId: "shop-1",
        productId: LEAD,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    expect(state.duplicate).toHaveBeenCalledWith({
      variables: { input: { campaignId: "c-source", name: `Rosa-${LEAD}-2` } },
    });
  });

  it("keeps the old copy name while the seller has no template", async () => {
    state.namingContext.mockResolvedValue(namingContext(""));
    await copySource();
    expect(state.duplicate).toHaveBeenCalledWith({
      variables: { input: { campaignId: "c-source", name: "Summer list（副本）" } },
    });
  });

  it("does not copy when the naming facts cannot be read", async () => {
    state.namingContext.mockRejectedValue(new Error("network failure"));
    renderCampaigns();
    fireEvent.click(await screen.findByText("Summer list"));
    fireEvent.click(await screen.findByRole("button", { name: "复制推广计划" }));
    await waitFor(() => expect(state.namingContext).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state.duplicate).not.toHaveBeenCalled();
  });
});
