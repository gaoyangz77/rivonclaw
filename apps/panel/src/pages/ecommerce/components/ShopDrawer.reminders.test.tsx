import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ShopDrawer } from "./ShopDrawer.js";

const { store } = vi.hoisted(() => ({ store: {
  shops: [{ id: "shop", shopName: "Demo", platformShopId: "platform-shop", region: "IT", authStatus: "AUTHORIZED",
    services: { customerService: { enabled: true, pickupReminderEnabled: false }, wms: { enabled: false }, affiliateService: { enabled: false } },
    handlesCustomerServiceOnDevice: () => false,
  }],
  adsAdvertisers: [], adsStoreBindings: [], availableTools: [], providerKeys: [], llmManager: { catalog: [] },
  setShopPickupReminderEnabled: vi.fn(),
} }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => store }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));
vi.mock("../../../components/billing/CustomerServiceBillingCta.js", () => ({ CustomerServiceBillingCta: () => null }));
vi.mock("../../../components/inputs/KeyModelSelector.js", () => ({ KeyModelSelector: () => null }));
vi.mock("./UnpaidOrderReachoutSettings.js", () => ({ UnpaidOrderReachoutSettings: () => <div>Unpaid settings</div> }));
vi.mock("./AffiliateManagementTab.js", () => ({ AffiliateManagementTab: () => null }));
vi.mock("./InventoryManagementTab.js", () => ({ InventoryManagementTab: () => null }));

it("navigates to a reminders group containing unpaid and pickup settings", () => {
  const props = {
    shopId: "shop", isOpen: true, activeTab: "aiCustomerService", onClose: vi.fn(), onTabChange: vi.fn(),
    editBusinessPrompt: "", runProfileOptions: [], selectedRunProfile: null,
    selectedCSProvider: "", selectedCSModel: "", selectedRunProfileId: "", escalationChannelSelectOptions: [], escalationRecipientOptions: [],
    draftBadReviewReachoutMaxAttempts: "1", draftBadReviewReachoutStars: "1", draftBadReviewReachoutRecentDays: "7",
    draftEscalationChannel: "", draftEscalationRecipient: "", myDeviceId: null,
    upgradePrompt: false,
    togglingServiceId: null, onToggleCustomerService: vi.fn(),
    togglingInventoryServiceId: null, onToggleInventoryManagement: vi.fn(),
    togglingAffiliateServiceId: null, onToggleAffiliateService: vi.fn(),
    onEditBusinessPrompt: vi.fn(), savingSettings: false, onSaveBusinessPrompt: vi.fn(),
    savingRunProfile: false, onRunProfileChange: vi.fn(), savingModel: false, onCSModelChange: vi.fn(),
    draftUnpaidReachoutEnabled: false, draftUnpaidReachoutStages: [], draftUnpaidExperimentEnabled: false, draftUnpaidHoldoutPercent: "5",
    onToggleUnpaidReachoutEnabled: vi.fn(), onDraftUnpaidReachoutStagesChange: vi.fn(),
    onDraftUnpaidExperimentEnabledChange: vi.fn(), onDraftUnpaidHoldoutPercentChange: vi.fn(),
    draftReviewOptimizationEnabled: false, draftBadReviewReachoutEnabled: false, savingReviewOptimizationSettings: false,
    onToggleReviewOptimizationEnabled: vi.fn(), onToggleBadReviewReachoutEnabled: vi.fn(),
    onDraftBadReviewReachoutStarsChange: vi.fn(), onDraftBadReviewReachoutRecentDaysChange: vi.fn(),
    onDraftBadReviewReachoutMaxAttemptsChange: vi.fn(), onSaveReviewOptimizationSettings: vi.fn(),
    savingEscalation: false, onDraftEscalationChannelChange: vi.fn(), onEscalationRecipientChange: vi.fn(),
    togglingBindShopId: null, onBindDevice: vi.fn(), onUnbindDevice: vi.fn(),
    selectedAffiliateRunProfileId: "", selectedAffiliateRunProfile: null, savingAffiliateRunProfile: false,
    onAffiliateRunProfileChange: vi.fn(), editAffiliateBusinessPrompt: "", onEditAffiliateBusinessPrompt: vi.fn(),
    editAffiliateMinExpectedSalesUnits: "", onEditAffiliateMinExpectedSalesUnits: vi.fn(), onCommitAffiliateMinExpectedSalesUnits: vi.fn(),
    savingAffiliateSettings: false, onSaveAffiliateBusinessPrompt: vi.fn(),
    onSaveAffiliateDailyCreatorOutreachLimit: vi.fn().mockResolvedValue(undefined),
    onSaveAffiliateSamplePerformanceFollowUp: vi.fn().mockResolvedValue(undefined),
    togglingAffiliateBindShopId: null, onBindAffiliateDevice: vi.fn(), onUnbindAffiliateDevice: vi.fn(),
  } satisfies ComponentProps<typeof ShopDrawer>;
  const { container } = render(<ShopDrawer {...props} />);
  const reminders = container.ownerDocument.getElementById("shop-workspace-aiCustomerService-reminders")!;
  expect(reminders).toBeTruthy();
  expect(reminders.contains(screen.getByText("Unpaid settings"))).toBe(true);
  expect(reminders.contains(screen.getByText("ecommerce.pickupReminder.title"))).toBe(true);
  const scroll = vi.fn();
  reminders.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole("button", { name: "ecommerce.shopDrawer.aiCS.reminders" }));
  expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  expect(screen.queryByRole("button", { name: "ecommerce.shopDrawer.aiCS.unpaidReachout" })).toBeNull();
});
