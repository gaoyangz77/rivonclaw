// @vitest-environment jsdom
import type { DocumentNode } from "graphql";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { WorkspaceTabProvider } from "../../lib/workspace-tab-context.js";
import { AffiliateCampaignRoute } from "./AffiliateStaffRoutes.js";

/**
 * Wizard defaults and options: the commission defaults of a new product row, the Creator-list-only
 * "reach protected Creators" option (ADR-121) and the first-touch tooltips.
 */

vi.mock("../../components/inputs/MessageEmojiPicker.js", () => ({ default: () => null }));
vi.mock("./AffiliateTeamPage.js", () => ({ AffiliateTeamPage: () => null }));
vi.mock("./hooks/useCreatorListDraft.js", () => ({
  useCreatorListDraft: () => ({
    draft: {
      status: "ready",
      fileName: "list.xlsx",
      prepared: { usernames: ["alpha"], duplicateCount: 0, invalid: [], tooMany: false },
    },
    readFile: vi.fn(),
    reset: vi.fn(),
  }),
}));

const OWNER = { id: "owner", isOwner: true, permissionScopes: ["AFFILIATE"] };
const LEAD = "1737647724406212416";

const state = vi.hoisted(() => ({
  entityStore: {} as Record<string, unknown>,
  data: {} as Record<string, unknown>,
  write: vi.fn(),
  preview: {} as Record<string, unknown>,
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.entityStore }));
vi.mock("@apollo/client/react", () => ({
  useMutation: (document: DocumentNode) => {
    const definition = document.definitions.find((d) => d.kind === "OperationDefinition");
    const operation = definition?.kind === "OperationDefinition" ? definition.name!.value : "";
    return [operation === "WriteAffiliateCampaign" ? state.write : vi.fn(), { loading: false }];
  },
  useLazyQuery: () => [
    vi.fn(() => Promise.resolve({ data: { affiliateCampaignProductPreview: state.preview } })),
    { loading: false },
  ],
  useApolloClient: () => ({
    query: () =>
      Promise.resolve({
        data: {
          affiliateCampaignNamingContext: {
            template: "",
            businessDeveloperName: null,
            businessDeveloperEnglishName: null,
            sequence: 1,
          },
        },
      }),
  }),
  useQuery: (_document: DocumentNode, options?: { skip?: boolean }) => ({
    data: options?.skip ? undefined : state.data,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    fetchMore: vi.fn(),
  }),
}));

const stored = {
  id: "c-1",
  userId: "seller",
  shopId: "shop-1",
  name: "Stored list",
  status: "ACTIVE",
  productSnapshot: {
    productId: LEAD,
    title: "Compact product",
    categoryPathNames: ["Home"],
    minimumPriceUsdAmount: 10,
    maximumPriceUsdAmount: 10,
    observedAt: "2026-11-25T08:00:00.000Z",
    snapshotHash: "a".repeat(64),
    status: "ACTIVATE",
    brandName: null,
    coverImage: null,
  },
  searchPlanGuidance: null,
  market: "US",
  dailyOutreachTarget: 20,
  products: [{ productId: LEAD, commissionRatePercent: 12, shopAdsCommissionRatePercent: 7 }],
  selectionPolicy: { strategy: "CREATOR_LIST" },
  searchPlanning: { state: "READY", activePlanId: null, generationRequest: null },
  collaborationInvitationText: "Welcome to our shop",
  messageTemplateText: "Hi {{creator_name}}",
  messageTemplateSource: "USER_AUTHORED",
  firstTouchMode: "DIRECT_MESSAGE",
  reachProtectedCreators: true,
  templateVersion: 1,
  updatedAt: "2026-11-25T08:00:00.000Z",
  createdAt: "2026-11-25T08:00:00.000Z",
  createdByBusinessDeveloperId: null,
  createdBy: { kind: "OWNER", displayName: null },
};

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

const CHECKBOX = "触达保护达人";
const numberInputs = () => screen.getAllByRole("spinbutton") as HTMLInputElement[];

async function openWizard() {
  fireEvent.click(screen.getAllByRole("button", { name: /新建推广计划/ })[0]);
  fireEvent.click(await screen.findByText("选择已授权店铺"));
  fireEvent.click((await screen.findAllByText("Holylegend")).at(-1)!);
}

async function reachStepTwo() {
  await openWizard();
  fireEvent.change(screen.getByPlaceholderText("夏季达人获客"), { target: { value: "My list" } });
  fireEvent.change(screen.getByPlaceholderText("输入准确的 TikTok Shop 商品 ID"), {
    target: { value: LEAD },
  });
  fireEvent.click(screen.getByRole("button", { name: "抓取商品" }));
  await screen.findByText("已验证商品快照");
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  await screen.findByText("定义每日运行边界");
}

/** The strategy title also appears elsewhere on the step, so click the strategy choice itself. */
function chooseCreatorListStrategy() {
  const title = i18n.t("ecommerce.affiliateCampaign.creatorList.strategyTitle");
  const choice = screen
    .getAllByText(title)
    .map((node) => node.closest("button.affiliate-campaign-strategy-choice"))
    .find(Boolean)!;
  fireEvent.click(choice);
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  state.write.mockReset();
  state.preview = {
    productId: LEAD,
    title: "Compact product",
    categoryPathNames: ["Home"],
    minimumPriceUsdAmount: 10,
    maximumPriceUsdAmount: 10,
    observedAt: "2026-11-25T08:00:00.000Z",
    snapshotHash: "a".repeat(64),
    status: "ACTIVATE",
    brandName: null,
    coverImage: null,
  };
  state.data = {
    affiliateCampaigns: [stored],
    shops: [
      {
        id: "shop-1",
        shopName: "Holylegend",
        alias: null,
        region: "US",
        timezone: "America/Los_Angeles",
        platform: "TIKTOK_SHOP",
        authStatus: "AUTHORIZED",
        services: { affiliateService: { campaignDailyCreatorOutreachLimit: 100 } },
      },
    ],
  };
});
afterEach(() => cleanup());

describe("commission defaults of a new product row", () => {
  it("starts the first row at 10% and Shop Ads 5%, and so does an added row", async () => {
    renderCampaigns();
    await openWizard();
    expect(numberInputs().map((input) => input.value)).toEqual(["10", "5"]);
    fireEvent.click(screen.getByRole("button", { name: /添加商品/ }));
    expect(numberInputs().map((input) => input.value)).toEqual(["10", "5", "10", "5"]);
  });
});

describe("reach protected Creators (ADR-121)", () => {
  it("is shown only for the Creator-list strategy, off by default, and goes out with the write", async () => {
    state.write.mockResolvedValue({ data: { writeAffiliateCampaign: { ...stored, id: "c-new" } } });
    renderCampaigns();
    await reachStepTwo();
    expect(screen.queryByLabelText(CHECKBOX)).toBeNull();

    chooseCreatorListStrategy();
    const checkbox = (await screen.findByLabelText(CHECKBOX)) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText(/保护名单里的达人通常不会收到任何推广计划的触达/)).toBeTruthy();
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    fireEvent.change(document.querySelector('input[type="email"]')!, {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    const template = await screen.findByPlaceholderText(/你好 \{\{creator_name\}\}/);
    fireEvent.change(template, { target: { value: "Hi {{creator_name}}" } });
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("已开启：保护达人也会收到邀约")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "创建并开启" }));

    await waitFor(() => expect(state.write).toHaveBeenCalledOnce());
    expect(state.write.mock.calls[0][0].variables.input).toMatchObject({
      selectionPolicy: { strategy: "CREATOR_LIST" },
      reachProtectedCreators: true,
      creatorUsernames: ["alpha"],
    });
  });

  it("loads the stored value into an edit and shows it in the Campaign detail", async () => {
    renderCampaigns();
    fireEvent.click(await screen.findByText("Stored list"));
    // The detail shows the option as a badge next to the Campaign's other settings.
    expect(await screen.findAllByText(CHECKBOX)).not.toHaveLength(0);
    fireEvent.click(await screen.findByRole("button", { name: "修改配置" }));
    // Step 1 first; the strategy is locked to the Creator list for an existing list Campaign.
    fireEvent.click(await screen.findByRole("button", { name: "继续" }));
    const checkbox = (await screen.findByLabelText(CHECKBOX)) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});

describe("first-touch tooltips", () => {
  it("explains the invitation intro and the direct message in step 3 and in the detail", async () => {
    renderCampaigns();
    fireEvent.click(await screen.findByText("Stored list"));
    fireEvent.click(await screen.findByRole("button", { name: /查看合作邀约/ }));
    const region = await screen.findByRole("region", { name: "合作邀约介绍" });
    expect(
      within(region).getByRole("button", {
        name: /显示在 TikTok 定向合作（定邀）卡片里的介绍文字/,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /查看私信首信|查看第一条私信/ }));
    const dm = await screen.findByRole("region", { name: "私信首信" });
    expect(
      within(dm).getByRole("button", { name: /单独发给达人的一条私信，在定向合作卡片之前发出/ }),
    ).toBeTruthy();
  });
});
