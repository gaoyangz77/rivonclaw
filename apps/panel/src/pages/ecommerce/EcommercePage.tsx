import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useToast } from "../../components/Toast.js";
import { hasUpgradeRequired } from "./ecommerce-utils.js";
import type { DrawerTab } from "./ecommerce-types.js";
import { useOAuthFlow } from "./hooks/useOAuthFlow.js";
import { useEscalation } from "./hooks/useEscalation.js";
import { useDeviceBinding } from "./hooks/useDeviceBinding.js";
import { ShopTable } from "./components/ShopTable.js";
import { ConnectShopModal } from "./components/ConnectShopModal.js";
import { ShopDrawer } from "./components/ShopDrawer.js";

export interface UnpaidReachoutStageDraft {
  id?: string;
  enabled: boolean;
  delayMinutes: string;
  messageTemplate: string;
}

function defaultUnpaidReachoutTemplate(region: string | undefined): string {
  const templates: Record<string, string> = {
    DE: "Hallo, ich sehe, dass Ihre Bestellung {{order_id}} mit {{product_count}} Artikel(n) noch unbezahlt ist. Wenn es beim Checkout oder Bezahlen ein Problem gab oder Sie noch Fragen zum Produkt haben, helfe ich gern.",
    ES: "Hola, veo que su pedido {{order_id}} con {{product_count}} artículo(s) aún está sin pagar. Si tuvo algún problema con el checkout o el pago, o si aún tiene dudas sobre el producto, con gusto le ayudo.",
    FR: "Bonjour, j’ai remarqué que votre commande {{order_id}} avec {{product_count}} article(s) n’est pas encore payée. Si vous avez eu un souci au paiement, ou si vous avez encore des questions sur le produit, je peux vous aider.",
    IT: "Ciao, ho notato che il tuo ordine {{order_id}} con {{product_count}} articolo/i risulta ancora non pagato. Se hai avuto problemi con checkout o pagamento, o hai ancora domande sul prodotto, sono qui per aiutarti.",
  };
  return templates[region ?? ""] ?? "Hi, I noticed your order {{order_id}} with {{product_count}} item(s) is still unpaid. If checkout or payment failed, or if you still have questions about the product, I am happy to help.";
}

export const EcommercePage = observer(function EcommercePage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const runProfiles = entityStore.allRunProfiles;
  const platformApps = entityStore.platformApps;

  const { showToast } = useToast();

  // Loading flags
  const [_platformAppsLoading, setPlatformAppsLoading] = useState(false);

  // Top-level UI state
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const [editBusinessPrompt, setEditBusinessPrompt] = useState("");
  const [draftUnpaidReachoutEnabled, setDraftUnpaidReachoutEnabled] = useState(false);
  const [draftUnpaidReachoutStages, setDraftUnpaidReachoutStages] = useState<UnpaidReachoutStageDraft[]>([]);
  const [draftUnpaidExperimentEnabled, setDraftUnpaidExperimentEnabled] = useState(false);
  const [draftUnpaidHoldoutPercent, setDraftUnpaidHoldoutPercent] = useState("5");
  const [draftReviewOptimizationEnabled, setDraftReviewOptimizationEnabled] = useState(false);
  const [draftBadReviewReachoutEnabled, setDraftBadReviewReachoutEnabled] = useState(false);
  const [draftBadReviewReachoutStars, setDraftBadReviewReachoutStars] = useState("3");
  const [draftBadReviewReachoutRecentDays, setDraftBadReviewReachoutRecentDays] = useState("7");
  const [editAffiliateBusinessPrompt, setEditAffiliateBusinessPrompt] = useState("");
  const [editAffiliateMinExpectedSalesUnits, setEditAffiliateMinExpectedSalesUnits] = useState("");
  const [editAffiliateModelUsageScope, setEditAffiliateModelUsageScope] = useState<"USER_LEVEL" | "REGION_LEVEL" | "SHOP_LEVEL">("USER_LEVEL");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAffiliateSettings, setSavingAffiliateSettings] = useState(false);
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);
  const [togglingInventoryServiceId, setTogglingInventoryServiceId] = useState<string | null>(null);
  const [togglingAffiliateServiceId, setTogglingAffiliateServiceId] = useState<string | null>(null);
  const [savingRunProfile, setSavingRunProfile] = useState(false);
  const [savingAffiliateRunProfile, setSavingAffiliateRunProfile] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [savingUnpaidReachoutSettings, setSavingUnpaidReachoutSettings] = useState(false);
  const [savingReviewOptimizationSettings, setSavingReviewOptimizationSettings] = useState(false);
  const [confirmDeleteShopId, setConfirmDeleteShopId] = useState<string | null>(null);
  const [affiliateBindConflictShopId, setAffiliateBindConflictShopId] = useState<string | null>(null);
  const [togglingAffiliateBindShopId, setTogglingAffiliateBindShopId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;

  // Hooks
  const oauthFlow = useOAuthFlow();
  const escalation = useEscalation(selectedShopId, setUpgradePrompt);
  const deviceBinding = useDeviceBinding();

  // ── Error handler ──
  function handleError(err: unknown, fallbackKey: string) {
    if (hasUpgradeRequired(err)) {
      setUpgradePrompt(true);
    } else {
      setUpgradePrompt(false);
      showToast(err instanceof Error ? err.message : t(fallbackKey), "error");
    }
  }

  // ── Fetch helpers ──
  async function handleFetchPlatformApps() {
    setPlatformAppsLoading(true);
    try { await entityStore.fetchPlatformApps(); } catch { /* ignore */ } finally { setPlatformAppsLoading(false); }
  }
  // ── Effects ──

  // Fetch platform apps on mount (shops arrive via MST/SSE)
  useEffect(() => {
    if (user) {
      void entityStore.fetchShops().catch(() => {});
      handleFetchPlatformApps();
    }
  }, [user]);

  // Model catalog is read from entityStore.llmManager.catalog (shared, auto-refreshed).
  // Trigger initial catalog load if not yet populated.
  useEffect(() => {
    if (!entityStore.llmManager.catalogReady) {
      entityStore.llmManager.refreshCatalog();
    }
  }, []);

  // Sync editable CS drafts from shop data (re-runs when shop changes or after mutations refresh the shop)
  useEffect(() => {
    if (selectedShop) {
      setEditBusinessPrompt(selectedShop.services?.customerService?.businessPrompt ?? "");
      setDraftUnpaidReachoutEnabled(
        selectedShop.services?.customerService?.unpaidOrderReachoutEnabled ?? false,
      );
      setDraftUnpaidReachoutStages(
        (selectedShop.services?.customerService?.unpaidOrderReachoutStages ?? []).map((stage) => ({
          id: stage.id,
          enabled: stage.enabled,
          delayMinutes: String(stage.delayMinutes),
          messageTemplate: stage.messageTemplate,
        })),
      );
      setDraftUnpaidExperimentEnabled(
        selectedShop.services?.customerService?.unpaidOrderReachoutExperiment?.enabled ?? false,
      );
      setDraftUnpaidHoldoutPercent(String(
        selectedShop.services?.customerService?.unpaidOrderReachoutExperiment?.holdoutPercent ?? 5,
      ));
      setDraftReviewOptimizationEnabled(
        selectedShop.services?.customerService?.reviewOptimization?.enabled ?? false,
      );
      setDraftBadReviewReachoutEnabled(
        selectedShop.services?.customerService?.reviewOptimization?.badReviewReachout?.enabled ?? false,
      );
      setDraftBadReviewReachoutStars(
        String(selectedShop.services?.customerService?.reviewOptimization?.badReviewReachout?.stars ?? 3),
      );
      setDraftBadReviewReachoutRecentDays(
        String(selectedShop.services?.customerService?.reviewOptimization?.badReviewReachout?.recentDays ?? 7),
      );
    }
  }, [
    selectedShop?.id,
    selectedShop?.services?.customerService?.businessPrompt,
    selectedShop?.services?.customerService?.unpaidOrderReachoutEnabled,
    selectedShop?.services?.customerService?.unpaidOrderReachoutStages,
    selectedShop?.services?.customerService?.unpaidOrderReachoutExperiment?.enabled,
    selectedShop?.services?.customerService?.unpaidOrderReachoutExperiment?.holdoutPercent,
    selectedShop?.services?.customerService?.reviewOptimization?.enabled,
    selectedShop?.services?.customerService?.reviewOptimization?.badReviewReachout?.enabled,
    selectedShop?.services?.customerService?.reviewOptimization?.badReviewReachout?.stars,
    selectedShop?.services?.customerService?.reviewOptimization?.badReviewReachout?.recentDays,
  ]);

  useEffect(() => {
    if (selectedShop) {
      setEditAffiliateBusinessPrompt(selectedShop.services?.affiliateService?.businessPrompt ?? "");
      const minExpectedSalesUnits = selectedShop.services?.affiliateService?.decisionThresholds?.minExpectedSalesUnits;
      setEditAffiliateMinExpectedSalesUnits(typeof minExpectedSalesUnits === "number" ? String(minExpectedSalesUnits) : "");
      const modelUsageScope = selectedShop.services?.affiliateService?.modelUsageScope;
      setEditAffiliateModelUsageScope(
        modelUsageScope === "SHOP_LEVEL" || modelUsageScope === "REGION_LEVEL" ? modelUsageScope : "USER_LEVEL",
      );
    }
  }, [
    selectedShop?.id,
    selectedShop?.services?.affiliateService?.businessPrompt,
    selectedShop?.services?.affiliateService?.decisionThresholds?.minExpectedSalesUnits,
    selectedShop?.services?.affiliateService?.modelUsageScope,
  ]);

  // ── Handlers ──

  async function handleRefreshShops() {
    setRefreshing(true);
    try {
      await Promise.all([
        entityStore.fetchShops(),
        handleFetchPlatformApps(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleConnectShop(platformAppId: string) {
    if (!platformAppId) return;
    setUpgradePrompt(false);
    oauthFlow.initiateOAuth(
      platformAppId,
      async () => {
        await entityStore.fetchShops();
        setConnectModalOpen(false);
      },
      (err) => handleError(err, "ecommerce.oauthFailed"),
    ).catch(() => {}); // Error already handled by onError callback
  }

  async function handleReauthorize(shopId: string) {
    const shop = shops.find((s) => s.id === shopId);
    const appId = shop?.platformAppId || (platformApps.length > 0 ? platformApps[0].id : "");
    if (!appId) {
      showToast(t("ecommerce.oauthFailed"), "error");
      return;
    }
    setUpgradePrompt(false);
    try {
      await oauthFlow.initiateOAuth(
        appId,
        async () => {
          await entityStore.fetchShops();
          setConnectModalOpen(false);
        },
        (err) => handleError(err, "ecommerce.oauthFailed"),
      );
      // Open modal after OAuth URL is set (initiateOAuth sets oauthWaiting on success)
      setConnectModalOpen(true);
    } catch {
      // Error already handled by the onError callback
    }
  }

  async function handleDeleteShop(shopId: string) {
    setConfirmDeleteShopId(null);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      await shop.delete();
      await entityStore.fetchShops();
      if (selectedShopId === shopId) {
        closeDrawer();
      }
      showToast(t("ecommerce.disconnectSuccess"), "success");
    } catch (err) {
      handleError(err, "ecommerce.deleteFailed");
    }
  }

  async function handleUpdateAlias(shopId: string, alias: string) {
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      await (shop as typeof shop & { updateAlias: (nextAlias: string) => Promise<unknown> }).updateAlias(alias);
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
      throw err;
    }
  }

  async function handleToggleCustomerService(shopId: string, currentValue: boolean) {
    setTogglingServiceId(shopId);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      await shop.update({
        services: { customerService: { enabled: !currentValue } },
      });
      // If disabling CS while on the AI CS tab, switch back to overview
      if (currentValue && activeTab === "aiCustomerService") {
        setActiveTab("overview");
      }
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setTogglingServiceId(null);
    }
  }

  async function handleToggleInventoryManagement(shopId: string, currentValue: boolean) {
    setTogglingInventoryServiceId(shopId);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      const nextValue = !currentValue;
      await shop.update({
        services: { wms: { enabled: nextValue } },
      });
      if (nextValue) {
        await entityStore.ecommerceInventory.syncShopWarehouses(shopId);
      } else if (activeTab === "warehouseMapping") {
        setActiveTab("overview");
      }
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setTogglingInventoryServiceId(null);
    }
  }

  async function handleToggleAffiliateService(shopId: string, currentValue: boolean) {
    setTogglingAffiliateServiceId(shopId);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      const nextValue = !currentValue;
      await shop.update({
        services: {
          affiliateService: {
            enabled: nextValue,
            ...(nextValue && !shop.services?.affiliateService?.runProfileId
              ? { runProfileId: "AFFILIATE_OPERATOR" }
              : {}),
          },
        },
      });
      if (!nextValue && activeTab === "affiliateManagement") {
        setActiveTab("overview");
      }
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setTogglingAffiliateServiceId(null);
    }
  }

  async function handleSaveBusinessPrompt() {
    if (!selectedShopId) return;
    setSavingSettings(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: { customerService: { businessPrompt: editBusinessPrompt } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveUnpaidReachoutSettings() {
    if (!selectedShopId) return;
    const normalizedStages = draftUnpaidReachoutStages.map((stage) => ({
      id: stage.id,
      enabled: stage.enabled,
      delayMinutes: Number(stage.delayMinutes.trim()),
      messageTemplate: stage.messageTemplate,
    })).sort((a, b) => a.delayMinutes - b.delayMinutes);
    const enabledDelays = normalizedStages.filter((stage) => stage.enabled).map((stage) => stage.delayMinutes);
    if (
      normalizedStages.length > 3 ||
      normalizedStages.some((stage) => !Number.isInteger(stage.delayMinutes) || stage.delayMinutes < 1 || stage.delayMinutes > 2879) ||
      new Set(enabledDelays).size !== enabledDelays.length
    ) {
      showToast(t("ecommerce.shopDrawer.aiCS.unpaidReachoutInvalidDelay"), "error");
      return;
    }
    const holdoutPercent = Number(draftUnpaidHoldoutPercent.trim());
    if (!Number.isInteger(holdoutPercent) || holdoutPercent < 1 || holdoutPercent > 20) {
      showToast("Holdout must be an integer between 1% and 20%.", "error");
      return;
    }

    setSavingUnpaidReachoutSettings(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: {
          customerService: {
            unpaidOrderReachoutEnabled: draftUnpaidReachoutEnabled,
            unpaidOrderReachoutStages: normalizedStages,
            unpaidOrderReachoutExperiment: {
              enabled: draftUnpaidExperimentEnabled,
              holdoutPercent,
            },
          },
        },
      });
      await entityStore.fetchShops();
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingUnpaidReachoutSettings(false);
    }
  }

  async function handleSaveReviewOptimizationSettings() {
    if (!selectedShopId) return;
    const trimmedStars = draftBadReviewReachoutStars.trim();
    const parsedStars = Number(trimmedStars);
    if (!Number.isInteger(parsedStars) || parsedStars < 1 || parsedStars > 3) {
      showToast(t("ecommerce.shopDrawer.aiCS.reviewOptimizationInvalidStars"), "error");
      return;
    }

    const trimmedRecentDays = draftBadReviewReachoutRecentDays.trim();
    const parsedRecentDays = Number(trimmedRecentDays);
    if (!Number.isInteger(parsedRecentDays) || parsedRecentDays < 1 || parsedRecentDays > 90) {
      showToast(t("ecommerce.shopDrawer.aiCS.reviewOptimizationInvalidRecentDays"), "error");
      return;
    }

    setSavingReviewOptimizationSettings(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: {
          customerService: {
            reviewOptimization: {
              enabled: draftReviewOptimizationEnabled,
              badReviewReachout: {
                enabled: draftBadReviewReachoutEnabled,
                stars: parsedStars,
                recentDays: parsedRecentDays,
              },
            },
          },
        },
      });
      setDraftBadReviewReachoutStars(String(parsedStars));
      setDraftBadReviewReachoutRecentDays(String(parsedRecentDays));
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingReviewOptimizationSettings(false);
    }
  }

  async function handleSaveAffiliateBusinessPrompt() {
    if (!selectedShopId) return;
    setSavingAffiliateSettings(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: { affiliateService: { businessPrompt: editAffiliateBusinessPrompt } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingAffiliateSettings(false);
    }
  }

  async function handleSaveAffiliateDecisionThresholds(value = editAffiliateMinExpectedSalesUnits, shopId = selectedShopId) {
    if (!shopId) return;
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    const currentMinExpectedSalesUnits =
      shop.services?.affiliateService?.decisionThresholds?.minExpectedSalesUnits;
    const currentValue =
      typeof currentMinExpectedSalesUnits === "number" ? String(currentMinExpectedSalesUnits) : "";
    if (value.trim() === currentValue) return;

    const trimmed = value.trim();
    let decisionThresholds: { minExpectedSalesUnits?: number } = {};
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        showToast(t("ecommerce.shopDrawer.affiliate.invalidDecisionThreshold"), "error");
        return;
      }
      decisionThresholds = { minExpectedSalesUnits: parsed };
    }

    setSavingAffiliateSettings(true);
    setUpgradePrompt(false);
    try {
      await shop.update({
        services: {
          affiliateService: {
            decisionThresholds,
          },
        },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingAffiliateSettings(false);
    }
  }

  async function handleAffiliateModelUsageScopeChange(value: "USER_LEVEL" | "REGION_LEVEL" | "SHOP_LEVEL") {
    if (!selectedShopId) return;
    setEditAffiliateModelUsageScope(value);
    if (value === (selectedShop?.services?.affiliateService?.modelUsageScope ?? "USER_LEVEL")) return;
    setSavingAffiliateSettings(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: {
          affiliateService: {
            modelUsageScope: value,
          },
        },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingAffiliateSettings(false);
    }
  }

  async function handleRunProfileChange(profileId: string) {
    if (!selectedShopId) return;
    setSavingRunProfile(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: { customerService: { runProfileId: profileId } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingRunProfile(false);
    }
  }

  async function handleAffiliateRunProfileChange(profileId: string) {
    if (!selectedShopId) return;
    setSavingAffiliateRunProfile(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: { affiliateService: { runProfileId: profileId } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingAffiliateRunProfile(false);
    }
  }

  async function handleBindAffiliateDevice(shopId: string) {
    if (!deviceBinding.myDeviceId) return;
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    const existingDeviceId = shop.services?.affiliateService?.csDeviceId;
    if (existingDeviceId && existingDeviceId !== deviceBinding.myDeviceId) {
      setAffiliateBindConflictShopId(shopId);
      return;
    }
    setTogglingAffiliateBindShopId(shopId);
    try {
      await shop.update({
        services: { affiliateService: { csDeviceId: deviceBinding.myDeviceId } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setTogglingAffiliateBindShopId(null);
    }
  }

  async function handleForceBindAffiliateConfirmed() {
    const shopId = affiliateBindConflictShopId;
    setAffiliateBindConflictShopId(null);
    if (!shopId || !deviceBinding.myDeviceId) return;
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    setTogglingAffiliateBindShopId(shopId);
    try {
      await shop.update({
        services: { affiliateService: { csDeviceId: deviceBinding.myDeviceId } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setTogglingAffiliateBindShopId(null);
    }
  }

  async function handleUnbindAffiliateDevice(shopId: string) {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    setTogglingAffiliateBindShopId(shopId);
    try {
      await shop.update({
        services: { affiliateService: { csDeviceId: "" } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setTogglingAffiliateBindShopId(null);
    }
  }

  async function handleCSModelChange(provider: string, model: string) {
    if (!selectedShopId) return;
    setSavingModel(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      // Empty provider+model means "use global default"
      await shop.update({
        services: { customerService: {
          csProviderOverride: provider,
          csModelOverride: model,
        } },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingModel(false);
    }
  }

  function openDrawer(shopId: string) {
    setSelectedShopId(shopId);
    setActiveTab("overview");
    setUpgradePrompt(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    // Delay clearing selection so close animation plays
    setTimeout(() => {
      setSelectedShopId(null);
      setUpgradePrompt(false);
    }, 300);
  }

  // ── Computed ──

  const selectedRunProfileId = selectedShop?.services?.customerService?.runProfileId ?? "";
  const selectedRunProfile = runProfiles.find((p) => p.id === selectedRunProfileId) ?? null;
  const selectedAffiliateRunProfileId = selectedShop?.services?.affiliateService?.runProfileId ?? "AFFILIATE_OPERATOR";
  const selectedAffiliateRunProfile = runProfiles.find((p) => p.id === selectedAffiliateRunProfileId) ?? null;

  const runProfileOptions = runProfiles.map((p) => ({
    value: p.id,
    label: !p.userId ? (t(`surfaces.systemNames.${p.name}`, { defaultValue: p.name }) as string) : p.name,
  }));

  const selectedCSProvider = selectedShop?.services?.customerService?.csProviderOverride ?? "";
  const selectedCSModel = selectedShop?.services?.customerService?.csModelOverride ?? "";

  // ── Render ──

  if (authChecking) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="ecommerce-page-header">
        <div>
          <h1>{t("ecommerce.title")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.subtitle")}</p>
        </div>
      </div>

      {upgradePrompt && (
        <div className="info-box info-box-blue">
          {t("ecommerce.upgradeRequired")}
        </div>
      )}

      {/* Shop Table */}
      <ShopTable
        shops={shops}
        oauthLoading={oauthFlow.oauthLoading}
        oauthWaiting={oauthFlow.oauthWaiting}
        refreshing={refreshing}
        onRefresh={handleRefreshShops}
        onAddShop={() => {
          oauthFlow.resetOAuthUI();
          setConnectModalOpen(true);
        }}
        onUpdateAlias={handleUpdateAlias}
        onOpenDrawer={openDrawer}
        onReauthorize={handleReauthorize}
        onRequestDelete={setConfirmDeleteShopId}
      />

      {/* Add Shop Modal */}
      <ConnectShopModal
        isOpen={connectModalOpen}
        onClose={() => {
          if (oauthFlow.oauthWaiting) {
            oauthFlow.cleanupOAuthWait();
          }
          setConnectModalOpen(false);
        }}
        platformApps={platformApps}
        oauthLoading={oauthFlow.oauthLoading}
        oauthWaiting={oauthFlow.oauthWaiting}
        oauthAuthUrl={oauthFlow.oauthAuthUrl}
        linkCopied={oauthFlow.linkCopied}
        onConnectShop={handleConnectShop}
        onCopyAuthUrl={oauthFlow.handleCopyAuthUrl}
        onCancelOAuth={() => {
          oauthFlow.cleanupOAuthWait();
          setConnectModalOpen(false);
        }}
      />

      {/* Shop Detail Drawer */}
      <ShopDrawer
        shopId={selectedShopId}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        upgradePrompt={upgradePrompt}
        togglingServiceId={togglingServiceId}
        onToggleCustomerService={handleToggleCustomerService}
        togglingInventoryServiceId={togglingInventoryServiceId}
        onToggleInventoryManagement={handleToggleInventoryManagement}
        togglingAffiliateServiceId={togglingAffiliateServiceId}
        onToggleAffiliateService={handleToggleAffiliateService}
        editBusinessPrompt={editBusinessPrompt}
        onEditBusinessPrompt={setEditBusinessPrompt}
        savingSettings={savingSettings}
        onSaveBusinessPrompt={handleSaveBusinessPrompt}
        selectedRunProfileId={selectedRunProfileId}
        runProfileOptions={runProfileOptions}
        selectedRunProfile={selectedRunProfile}
        savingRunProfile={savingRunProfile}
        onRunProfileChange={handleRunProfileChange}
        selectedCSProvider={selectedCSProvider}
        selectedCSModel={selectedCSModel}
        savingModel={savingModel}
        onCSModelChange={handleCSModelChange}
        draftUnpaidReachoutEnabled={draftUnpaidReachoutEnabled}
        draftUnpaidReachoutStages={draftUnpaidReachoutStages}
        draftUnpaidExperimentEnabled={draftUnpaidExperimentEnabled}
        draftUnpaidHoldoutPercent={draftUnpaidHoldoutPercent}
        savingUnpaidReachoutSettings={savingUnpaidReachoutSettings}
        onToggleUnpaidReachoutEnabled={(enabled) => {
          setDraftUnpaidReachoutEnabled(enabled);
          if (enabled && draftUnpaidReachoutStages.length === 0) {
            const isEurope = ["DE", "ES", "FR", "IE", "IT"].includes(selectedShop?.region ?? "");
            setDraftUnpaidReachoutStages([{ enabled: true, delayMinutes: isEurope ? "3" : "1440", messageTemplate: defaultUnpaidReachoutTemplate(selectedShop?.region) }]);
          }
        }}
        onDraftUnpaidReachoutStagesChange={setDraftUnpaidReachoutStages}
        onDraftUnpaidExperimentEnabledChange={setDraftUnpaidExperimentEnabled}
        onDraftUnpaidHoldoutPercentChange={setDraftUnpaidHoldoutPercent}
        onSaveUnpaidReachoutSettings={handleSaveUnpaidReachoutSettings}
        draftReviewOptimizationEnabled={draftReviewOptimizationEnabled}
        draftBadReviewReachoutEnabled={draftBadReviewReachoutEnabled}
        draftBadReviewReachoutStars={draftBadReviewReachoutStars}
        draftBadReviewReachoutRecentDays={draftBadReviewReachoutRecentDays}
        savingReviewOptimizationSettings={savingReviewOptimizationSettings}
        onToggleReviewOptimizationEnabled={setDraftReviewOptimizationEnabled}
        onToggleBadReviewReachoutEnabled={setDraftBadReviewReachoutEnabled}
        onDraftBadReviewReachoutStarsChange={setDraftBadReviewReachoutStars}
        onDraftBadReviewReachoutRecentDaysChange={setDraftBadReviewReachoutRecentDays}
        onSaveReviewOptimizationSettings={handleSaveReviewOptimizationSettings}
        savingEscalation={escalation.savingEscalation}
        draftEscalationChannel={escalation.draftEscalationChannel}
        draftEscalationRecipient={escalation.draftEscalationRecipient}
        escalationChannelSelectOptions={escalation.escalationChannelSelectOptions}
        escalationRecipientOptions={escalation.escalationRecipientOptions}
        onDraftEscalationChannelChange={escalation.handleDraftEscalationChannelChange}
        onEscalationRecipientChange={escalation.handleEscalationRecipientChange}
        myDeviceId={deviceBinding.myDeviceId}
        togglingBindShopId={deviceBinding.togglingBindShopId}
        onBindDevice={deviceBinding.handleBindDevice}
        onUnbindDevice={deviceBinding.handleUnbindDevice}
        selectedAffiliateRunProfileId={selectedAffiliateRunProfileId}
        selectedAffiliateRunProfile={selectedAffiliateRunProfile}
        savingAffiliateRunProfile={savingAffiliateRunProfile}
        onAffiliateRunProfileChange={handleAffiliateRunProfileChange}
        editAffiliateBusinessPrompt={editAffiliateBusinessPrompt}
        onEditAffiliateBusinessPrompt={setEditAffiliateBusinessPrompt}
        editAffiliateMinExpectedSalesUnits={editAffiliateMinExpectedSalesUnits}
        onEditAffiliateMinExpectedSalesUnits={setEditAffiliateMinExpectedSalesUnits}
        onCommitAffiliateMinExpectedSalesUnits={() => handleSaveAffiliateDecisionThresholds()}
        editAffiliateModelUsageScope={editAffiliateModelUsageScope}
        onEditAffiliateModelUsageScope={handleAffiliateModelUsageScopeChange}
        savingAffiliateSettings={savingAffiliateSettings}
        onSaveAffiliateBusinessPrompt={handleSaveAffiliateBusinessPrompt}
        togglingAffiliateBindShopId={togglingAffiliateBindShopId}
        onBindAffiliateDevice={handleBindAffiliateDevice}
        onUnbindAffiliateDevice={handleUnbindAffiliateDevice}
      />

      {/* Delete Shop Confirm */}
      <ConfirmDialog
        isOpen={confirmDeleteShopId !== null}
        title={t("ecommerce.disconnect")}
        message={t("ecommerce.confirmDisconnect")}
        confirmLabel={t("ecommerce.disconnect")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => confirmDeleteShopId && handleDeleteShop(confirmDeleteShopId)}
        onCancel={() => setConfirmDeleteShopId(null)}
      />

      {/* Device Bind Conflict Confirm */}
      <ConfirmDialog
        isOpen={deviceBinding.bindConflictShopId !== null}
        title={t("ecommerce.shopDrawer.aiCS.csBindConflictTitle")}
        message={t("ecommerce.shopDrawer.aiCS.csBindConflict")}
        confirmLabel={t("common.done")}
        cancelLabel={t("common.cancel")}
        onConfirm={deviceBinding.handleForceBindConfirmed}
        onCancel={() => deviceBinding.setBindConflictShopId(null)}
      />

      <ConfirmDialog
        isOpen={affiliateBindConflictShopId !== null}
        title={t("ecommerce.shopDrawer.affiliate.bindConflictTitle")}
        message={t("ecommerce.shopDrawer.affiliate.bindConflict")}
        confirmLabel={t("common.done")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleForceBindAffiliateConfirmed}
        onCancel={() => setAffiliateBindConflictShopId(null)}
      />
    </div>
  );
});
