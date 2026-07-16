import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { CheckIcon, ChevronRightIcon, CloseIcon, DownloadIcon, InfoIcon, RefreshIcon, UserIcon, UserPlusIcon } from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { formatShopRegionLabel } from "../../lib/ecommerce-labels.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
  AFFILIATE_BUSINESS_DEVELOPER_PAGE_QUERY,
  AFFILIATE_CREATOR_PROTECTION_INTENTS_QUERY,
  AFFILIATE_OPERATIONAL_SETTINGS_QUERY,
  ARCHIVE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
  ASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION,
  ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION,
  COMPLETE_AFFILIATE_OPERATIONAL_ONBOARDING_MUTATION,
  EMAIL_ACCOUNT_BINDINGS_QUERY,
  IMPORT_AFFILIATE_CREATOR_PROTECTIONS_MUTATION,
  UNASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION,
  UNASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION,
  WHATSAPP_ACCOUNT_BINDINGS_QUERY,
  WRITE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
} from "../../api/shops-queries.js";
import { AffiliateEmailAccountPanel } from "./components/AffiliateEmailAccountPanel.js";
import { AffiliateApprovalPolicyPanel } from "./components/AffiliateApprovalPolicyPanel.js";
import { AffiliateWhatsAppAccountPanel } from "./components/AffiliateWhatsAppAccountPanel.js";

const UNASSIGNED_ID = "__UNASSIGNED__";
const DEVELOPER_PAGE_SIZE = 25;
export const SHOP_REGIONS = Object.values(GQL.ShopRegion);

type DeveloperSummary = GQL.AffiliateBusinessDeveloperSummary;
type ConnectChannel = "WHATSAPP" | "EMAIL" | null;

type DeveloperForm = {
  displayName: string;
  regions: GQL.ShopRegion[];
  acceptingCreators: boolean;
  agentAssistanceMode: GQL.AffiliateAgentAssistanceMode;
  businessPrompt: string;
};

type ProtectionPreviewRow = {
  rowNumber: number;
  platform: GQL.ShopPlatform;
  creatorOpenId: string | null;
  username: string | null;
  businessDeveloperId: string | null;
  businessDeveloperName: string | null;
  note: string | null;
  error: string | null;
};

const EMPTY_DEVELOPER: DeveloperForm = {
  displayName: "",
  regions: [],
  acceptingCreators: true,
  agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
  businessPrompt: "",
};

export const AffiliateTeamPage = observer(function AffiliateTeamPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const workspace = entityStore.affiliateWorkspace;
  const [developerPage, setDeveloperPage] = useState(0);
  const [developerSearch, setDeveloperSearch] = useState("");
  const [showArchivedDevelopers, setShowArchivedDevelopers] = useState(false);
  const [detailSummary, setDetailSummary] = useState<DeveloperSummary | null>(null);
  const [connectChannel, setConnectChannel] = useState<ConnectChannel>(null);
  const [showUnassignedAccounts, setShowUnassignedAccounts] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingDeveloperId, setEditingDeveloperId] = useState<string | null>(null);
  const [form, setForm] = useState<DeveloperForm>(EMPTY_DEVELOPER);
  const [protectionRows, setProtectionRows] = useState<ProtectionPreviewRow[]>([]);
  const [manualCreator, setManualCreator] = useState("");
  const [manualDeveloperId, setManualDeveloperId] = useState(UNASSIGNED_ID);
  const [manualNote, setManualNote] = useState("");
  const [confirmedProtectionBoundary, setConfirmedProtectionBoundary] = useState(false);
  const [showProtectionManager, setShowProtectionManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deferredDeveloperSearch = useDeferredValue(developerSearch.trim());

  const developersQuery = useQuery<{ affiliateBusinessDevelopers: GQL.AffiliateBusinessDeveloper[] }>(
    AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
    { variables: { includeArchived: true }, fetchPolicy: "cache-and-network" },
  );
  const developerPageQuery = useQuery<
    { affiliateBusinessDeveloperPage: GQL.AffiliateBusinessDeveloperPage },
    { input: GQL.AffiliateBusinessDeveloperPageInput }
  >(AFFILIATE_BUSINESS_DEVELOPER_PAGE_QUERY, {
    variables: {
      input: {
        offset: developerPage * DEVELOPER_PAGE_SIZE,
        limit: DEVELOPER_PAGE_SIZE,
        search: deferredDeveloperSearch || null,
        includeArchived: showArchivedDevelopers,
      },
    },
    fetchPolicy: "cache-and-network",
  });
  const settingsQuery = useQuery<{ affiliateOperationalSettings: GQL.AffiliateOperationalSettings }>(
    AFFILIATE_OPERATIONAL_SETTINGS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const protectionQuery = useQuery<{ affiliateCreatorProtectionIntents: GQL.AffiliateCreatorProtectionIntent[] }>(
    AFFILIATE_CREATOR_PROTECTION_INTENTS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const whatsappQuery = useQuery<{ whatsAppAccountBindings: GQL.WhatsAppAccountBinding[] }>(
    WHATSAPP_ACCOUNT_BINDINGS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const emailQuery = useQuery<{ emailAccountBindings: GQL.EmailAccountBinding[] }>(
    EMAIL_ACCOUNT_BINDINGS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );

  useEffect(() => {
    if (developersQuery.data) workspace.replaceAffiliateBusinessDevelopers(developersQuery.data.affiliateBusinessDevelopers);
  }, [developersQuery.data, workspace]);
  useEffect(() => {
    if (settingsQuery.data) workspace.setAffiliateOperationalSettings(settingsQuery.data.affiliateOperationalSettings);
  }, [settingsQuery.data, workspace]);
  useEffect(() => {
    if (protectionQuery.data) workspace.replaceAffiliateCreatorProtectionIntents(protectionQuery.data.affiliateCreatorProtectionIntents);
  }, [protectionQuery.data, workspace]);
  useEffect(() => {
    if (whatsappQuery.data) workspace.replaceAffiliateWhatsAppAccounts(whatsappQuery.data.whatsAppAccountBindings);
  }, [whatsappQuery.data, workspace]);
  useEffect(() => {
    if (emailQuery.data) workspace.replaceAffiliateEmailAccounts(emailQuery.data.emailAccountBindings);
  }, [emailQuery.data, workspace]);
  useEffect(() => {
    setDeveloperPage(0);
  }, [deferredDeveloperSearch, showArchivedDevelopers]);

  const [writeDeveloper, writeState] = useMutation<
    { writeAffiliateBusinessDeveloper: GQL.AffiliateBusinessDeveloper },
    { input: GQL.WriteAffiliateBusinessDeveloperInput }
  >(WRITE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [archiveDeveloper, archiveState] = useMutation<
    { archiveAffiliateBusinessDeveloper: GQL.AffiliateBusinessDeveloper },
    { id: string }
  >(ARCHIVE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [assignWhatsapp] = useMutation(ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION);
  const [unassignWhatsapp] = useMutation(UNASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION);
  const [assignEmail] = useMutation(ASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION);
  const [unassignEmail] = useMutation(UNASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION);
  const [importProtections, importState] = useMutation<
    { importAffiliateCreatorProtections: GQL.AffiliateCreatorProtectionIntent[] },
    { input: GQL.ImportAffiliateCreatorProtectionsInput }
  >(IMPORT_AFFILIATE_CREATOR_PROTECTIONS_MUTATION);
  const [completeOnboarding, onboardingState] = useMutation<{
    completeAffiliateOperationalOnboarding: GQL.AffiliateOperationalSettings;
  }>(COMPLETE_AFFILIATE_OPERATIONAL_ONBOARDING_MUTATION);

  const activeDevelopers = workspace.businessDevelopers.filter((developer) => !developer.archivedAt);
  const developerPageData = developerPageQuery.data?.affiliateBusinessDeveloperPage;
  const developerSummaries = developerPageData?.items ?? [];
  const developerTotalCount = developerPageData?.totalCount ?? 0;
  const developerTotalPages = Math.max(1, Math.ceil(developerTotalCount / DEVELOPER_PAGE_SIZE));
  const detailDeveloper = detailSummary
    ? workspace.getBusinessDeveloper(detailSummary.developer.id) ?? detailSummary.developer
    : null;
  const editingDeveloper = editingDeveloperId
    ? workspace.getBusinessDeveloper(editingDeveloperId)
    : null;
  const activeWhatsappAccounts = workspace.whatsappAccounts.filter(
    (account) => account.status !== GQL.WhatsAppAccountStatus.Revoked,
  );
  const activeEmailAccounts = workspace.emailAccounts.filter(
    (account) => account.status !== GQL.EmailAccountStatus.Revoked,
  );
  const detailWhatsapp = detailDeveloper
    ? activeWhatsappAccounts.filter((account) => account.businessDeveloperId === detailDeveloper.id)
    : [];
  const detailEmail = detailDeveloper
    ? activeEmailAccounts.filter((account) => account.businessDeveloperId === detailDeveloper.id)
    : [];
  const unassignedWhatsapp = activeWhatsappAccounts.filter((account) => !account.businessDeveloperId);
  const unassignedEmail = activeEmailAccounts.filter((account) => !account.businessDeveloperId);
  const totalChannelCount = activeWhatsappAccounts.length + activeEmailAccounts.length;
  const unassignedChannelCount = unassignedWhatsapp.length + unassignedEmail.length;
  const ownerOptions = useMemo(() => [
    { value: UNASSIGNED_ID, label: t("ecommerce.affiliateTeam.unassignedOwner") },
    ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
  ], [activeDevelopers, t]);
  const protectionOwnerOptions = useMemo(() => [
    { value: UNASSIGNED_ID, label: t("ecommerce.affiliateTeam.protectionUnassigned") },
    ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
  ], [activeDevelopers, t]);
  const loading = developersQuery.loading || developerPageQuery.loading || settingsQuery.loading || whatsappQuery.loading || emailQuery.loading;
  const onboardingComplete = Boolean(workspace.operationalSettings?.onboardingCompletedAt);
  const protectedCreatorCount = workspace.creatorProtectionIntents.length;
  const appliedProtectionCount = workspace.creatorProtectionIntents.filter((intent) => intent.appliedAt).length;
  const protectionManagerOpen = !onboardingComplete || showProtectionManager;
  const archiveBlocked = Boolean(detailSummary && (
    detailSummary.creatorRelationshipCount
    + detailSummary.whatsappAccountCount
    + detailSummary.emailAccountCount > 0
  ));

  useEffect(() => {
    if (developerPage > 0 && developerPage >= developerTotalPages) {
      setDeveloperPage(developerTotalPages - 1);
    }
  }, [developerPage, developerTotalPages]);

  const refreshChannelData = useCallback(async () => {
    const [whatsappResult, emailResult, pageResult] = await Promise.all([
      whatsappQuery.refetch(),
      emailQuery.refetch(),
      developerPageQuery.refetch(),
    ]);
    workspace.replaceAffiliateWhatsAppAccounts(whatsappResult.data?.whatsAppAccountBindings ?? []);
    workspace.replaceAffiliateEmailAccounts(emailResult.data?.emailAccountBindings ?? []);
    setDetailSummary((current) => {
      if (!current) return current;
      return pageResult.data?.affiliateBusinessDeveloperPage.items.find(
        (item) => item.developer.id === current.developer.id,
      ) ?? current;
    });
  }, [developerPageQuery, emailQuery, whatsappQuery, workspace]);

  function openDeveloperDetail(summary: DeveloperSummary) {
    setDetailSummary(summary);
    setConnectChannel(null);
  }

  function beginCreateDeveloper() {
    setEditingDeveloperId(null);
    setForm(EMPTY_DEVELOPER);
    setEditing(true);
  }

  function beginEditDeveloper(developer: {
    id: string;
    displayName: string;
    regions: readonly string[];
    acceptingCreators: boolean;
    agentAssistanceMode: string;
    businessPrompt?: string | null;
  } | null) {
    if (!developer) return;
    setEditingDeveloperId(developer.id);
    setForm({
      displayName: developer.displayName,
      regions: Array.from(developer.regions) as GQL.ShopRegion[],
      acceptingCreators: developer.acceptingCreators,
      agentAssistanceMode: developer.agentAssistanceMode as GQL.AffiliateAgentAssistanceMode,
      businessPrompt: developer.businessPrompt ?? "",
    });
    setDetailSummary(null);
    setEditing(true);
  }

  async function saveDeveloper() {
    const displayName = form.displayName.trim();
    if (!displayName) {
      showToast(t("ecommerce.affiliateTeam.nameRequired"), "error");
      return;
    }
    try {
      const result = await writeDeveloper({
        variables: {
          input: {
            id: editingDeveloper?.id ?? null,
            displayName,
            regions: form.regions,
            acceptingCreators: form.acceptingCreators,
            agentAssistanceMode: form.agentAssistanceMode,
            businessPrompt: form.businessPrompt.trim() || null,
          },
        },
      });
      const developer = result.data?.writeAffiliateBusinessDeveloper;
      if (!developer) throw new Error("AffiliateBusinessDeveloper was not returned");
      workspace.upsertAffiliateBusinessDeveloper(developer);
      setEditing(false);
      setEditingDeveloperId(null);
      if (!editingDeveloper) setDeveloperPage(0);
      await Promise.all([developersQuery.refetch(), developerPageQuery.refetch()]);
      showToast(t("ecommerce.affiliateTeam.saved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function closeDeveloperEditor() {
    if (writeState.loading) return;
    setEditing(false);
    setEditingDeveloperId(null);
  }

  async function handleArchiveDeveloper() {
    if (!detailDeveloper || archiveBlocked) return;
    if (!window.confirm(t("ecommerce.affiliateTeam.archiveConfirm", { name: detailDeveloper.displayName }))) return;
    try {
      const result = await archiveDeveloper({ variables: { id: detailDeveloper.id } });
      if (result.data?.archiveAffiliateBusinessDeveloper) {
        workspace.upsertAffiliateBusinessDeveloper(result.data.archiveAffiliateBusinessDeveloper);
      }
      setDetailSummary(null);
      await Promise.all([developersQuery.refetch(), developerPageQuery.refetch()]);
      showToast(t("ecommerce.affiliateTeam.archived"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function changeAccountOwner(channel: "WHATSAPP" | "EMAIL", accountId: string, nextOwner: string) {
    if (!window.confirm(t("ecommerce.affiliateTeam.transferConfirm"))) return;
    try {
      if (channel === "WHATSAPP") {
        if (nextOwner === UNASSIGNED_ID) await unassignWhatsapp({ variables: { accountBindingId: accountId } });
        else await assignWhatsapp({ variables: { accountBindingId: accountId, businessDeveloperId: nextOwner } });
      } else {
        if (nextOwner === UNASSIGNED_ID) await unassignEmail({ variables: { accountBindingId: accountId } });
        else await assignEmail({ variables: { accountBindingId: accountId, businessDeveloperId: nextOwner } });
      }
      await refreshChannelData();
      showToast(t("ecommerce.affiliateTeam.accountMoved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function handleProtectionFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!sheet) throw new Error(t("ecommerce.affiliateTeam.emptySpreadsheet"));
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const developersByName = new Map(activeDevelopers.map((developer) => [developer.displayName.trim().toLowerCase(), developer]));
      const seen = new Set<string>();
      const parsed = rawRows.map((raw, index): ProtectionPreviewRow => {
        const row = normalizeSpreadsheetRow(raw);
        const creatorOpenId = cleanCell(row.creator_open_id ?? row.creatoropenid);
        const username = cleanCell(row.username ?? row.creator_username);
        const developerName = cleanCell(
          row.business_developer_name ?? row.business_developer ?? row.bd,
        );
        const developer = developerName ? developersByName.get(developerName.toLowerCase()) : null;
        const key = creatorOpenId ? `id:${creatorOpenId}` : username ? `username:${username.toLowerCase()}` : "";
        let error: string | null = null;
        if (!key) error = t("ecommerce.affiliateTeam.missingCreatorIdentity");
        else if (seen.has(key)) error = t("ecommerce.affiliateTeam.duplicateCreator");
        else if (developerName && !developer) error = t("ecommerce.affiliateTeam.unknownDeveloper", { name: developerName });
        if (key) seen.add(key);
        return {
          rowNumber: index + 2,
          platform: GQL.ShopPlatform.TiktokShop,
          creatorOpenId,
          username,
          businessDeveloperId: developer?.id ?? null,
          businessDeveloperName: developerName,
          note: cleanCell(row.note),
          error,
        };
      });
      setProtectionRows(parsed);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function addManualProtection() {
    const identity = manualCreator.trim().replace(/^@/, "");
    if (!identity) {
      showToast(t("ecommerce.affiliateTeam.missingCreatorIdentity"), "error");
      return;
    }
    const isOpenId = /^\d+$/.test(identity);
    const duplicate = protectionRows.some((row) => (
      isOpenId ? row.creatorOpenId === identity : row.username?.toLowerCase() === identity.toLowerCase()
    ));
    if (duplicate) {
      showToast(t("ecommerce.affiliateTeam.duplicateCreator"), "error");
      return;
    }
    const developer = manualDeveloperId === UNASSIGNED_ID ? null : workspace.getBusinessDeveloper(manualDeveloperId);
    setProtectionRows((rows) => [...rows, {
      rowNumber: rows.reduce((highest, row) => Math.max(highest, row.rowNumber), 1) + 1,
      platform: GQL.ShopPlatform.TiktokShop,
      creatorOpenId: isOpenId ? identity : null,
      username: isOpenId ? null : identity,
      businessDeveloperId: developer?.id ?? null,
      businessDeveloperName: developer?.displayName ?? null,
      note: manualNote.trim() || null,
      error: null,
    }]);
    setManualCreator("");
    setManualNote("");
  }

  async function submitProtectionRows() {
    const validRows = protectionRows.filter((row) => !row.error);
    if (!validRows.length) return;
    try {
      const result = await importProtections({
        variables: {
          input: {
            importBatchId: globalThis.crypto?.randomUUID?.() ?? `import-${Date.now()}`,
            entries: validRows.map((row) => ({
              platform: row.platform,
              creatorOpenId: row.creatorOpenId,
              username: row.username,
              businessDeveloperId: row.businessDeveloperId,
              note: row.note,
            })),
          },
        },
      });
      workspace.replaceAffiliateCreatorProtectionIntents(result.data?.importAffiliateCreatorProtections ?? []);
      setProtectionRows([]);
      await protectionQuery.refetch();
      showToast(t("ecommerce.affiliateTeam.protectionsImported", { count: validRows.length }), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function finishOnboarding() {
    if (!confirmedProtectionBoundary) return;
    try {
      const result = await completeOnboarding();
      if (result.data?.completeAffiliateOperationalOnboarding) {
        workspace.setAffiliateOperationalSettings(result.data.completeAffiliateOperationalOnboarding);
      }
      setShowProtectionManager(false);
      showToast(t("ecommerce.affiliateTeam.onboardingCompleted"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([[
      "platform",
      "creator_open_id",
      "username",
      "business_developer_name",
      "note",
    ]]);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 32 },
      { wch: 48 },
    ];
    const instructions = XLSX.utils.aoa_to_sheet([
      [
        t("ecommerce.affiliateTeam.templateField"),
        t("ecommerce.affiliateTeam.templateRequirement"),
        t("ecommerce.affiliateTeam.templateInstructions"),
      ],
      ["platform", t("ecommerce.affiliateTeam.templateRequired"), "TIKTOK_SHOP"],
      ["creator_open_id / username", t("ecommerce.affiliateTeam.templateIdentityRequired"), t("ecommerce.affiliateTeam.templateIdentityHint")],
      ["business_developer_name", t("ecommerce.affiliateTeam.templateOptional"), t("ecommerce.affiliateTeam.templateDeveloperHint")],
      ["note", t("ecommerce.affiliateTeam.templateOptional"), t("ecommerce.affiliateTeam.templateNoteHint")],
    ]);
    instructions["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 76 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Protected creators");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
    XLSX.writeFile(workbook, "affiliate-protected-creators.xlsx");
  }

  function removeProtectionRow(rowNumber: number) {
    setProtectionRows((rows) => rows.filter((row) => row.rowNumber !== rowNumber));
  }

  return (
    <div className="affiliate-team-page">
      <header className="affiliate-team-header">
        <div className="affiliate-team-title-block">
          <span className="affiliate-team-eyebrow">{t("ecommerce.affiliateTeam.eyebrow")}</span>
          <h1>{t("ecommerce.affiliateTeam.title")}</h1>
          <p>{t("ecommerce.affiliateTeam.subtitle")}</p>
        </div>
        <div className="affiliate-team-header-actions">
          <button className="btn btn-secondary" type="button" onClick={() => void Promise.all([
            developersQuery.refetch(), developerPageQuery.refetch(), settingsQuery.refetch(), whatsappQuery.refetch(), emailQuery.refetch(),
          ])} disabled={loading}>
            <RefreshIcon /> {t("common.refresh")}
          </button>
          <button className="btn btn-primary" type="button" onClick={beginCreateDeveloper}>
            <UserPlusIcon /> {t("ecommerce.affiliateTeam.addDeveloper")}
          </button>
        </div>
      </header>

      <section className="affiliate-team-overview" aria-label={t("ecommerce.affiliateTeam.operationsOverview")}>
        <div className={`affiliate-team-overview-status ${onboardingComplete ? "is-ready" : "needs-setup"}`}>
          <span className="affiliate-team-overview-icon">{onboardingComplete ? <CheckIcon /> : <InfoIcon />}</span>
          <div>
            <span>{t("ecommerce.affiliateTeam.setupStatus")}</span>
            <strong>{t(onboardingComplete ? "ecommerce.affiliateTeam.setupReady" : "ecommerce.affiliateTeam.setupRequired")}</strong>
          </div>
        </div>
        <div><span>{t("ecommerce.affiliateTeam.humanDevelopers")}</span><strong>{activeDevelopers.length}</strong></div>
        <div><span>{t("ecommerce.affiliateTeam.connectedChannels")}</span><strong>{totalChannelCount}</strong><small>{t("ecommerce.affiliateTeam.unassignedChannels", { count: unassignedChannelCount })}</small></div>
        <div><span>{t("ecommerce.affiliateTeam.protectedCreators")}</span><strong>{protectedCreatorCount}</strong><small>{t("ecommerce.affiliateTeam.appliedProtections", { count: appliedProtectionCount })}</small></div>
      </section>

      <section className="affiliate-team-policy-section">
        <div className="affiliate-team-policy-heading">
          <div>
            <span className="affiliate-team-eyebrow">
              {t("ecommerce.affiliateWorkspace.policies.title")}
            </span>
            <h2>
              {t("ecommerce.affiliateTeam.globalApprovalPolicies", {
                defaultValue: "Account-wide approval policies",
              })}
            </h2>
          </div>
          <p>
            {t("ecommerce.affiliateTeam.globalApprovalPoliciesHint", {
              defaultValue:
                "Applies to every Affiliate shop under this seller account. SEND_MESSAGE rules review the exact draft before provider delivery.",
            })}
          </p>
        </div>
        <AffiliateApprovalPolicyPanel />
      </section>

      <section className={`affiliate-protection-boundary ${protectionManagerOpen ? "is-open" : ""}`}>
        <div className="affiliate-protection-boundary-head">
          <div className="affiliate-protection-boundary-title">
            <span className="affiliate-protection-boundary-icon"><InfoIcon /></span>
            <div>
              <span>{t("ecommerce.affiliateTeam.protectionBoundary")}</span>
              <h2>{t("ecommerce.affiliateTeam.onboardingTitle")}</h2>
              <p>{t(onboardingComplete ? "ecommerce.affiliateTeam.protectionBoundaryReady" : "ecommerce.affiliateTeam.onboardingHint")}</p>
            </div>
          </div>
          {onboardingComplete && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowProtectionManager((value) => !value)}>
              {t(protectionManagerOpen ? "ecommerce.affiliateTeam.hideProtectionManager" : "ecommerce.affiliateTeam.showProtectionManager")}
            </button>
          )}
        </div>

        {protectionManagerOpen && (
          <div className="affiliate-protection-console">
            <div className="affiliate-protection-console-toolbar">
              <div>
                <strong>{t("ecommerce.affiliateTeam.addProtectionEntries")}</strong>
                <span>{t("ecommerce.affiliateTeam.protectionEntryHint")}</span>
              </div>
              <div className="affiliate-onboarding-actions">
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleProtectionFile} />
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => void downloadTemplate()}>
                  <DownloadIcon /> {t("ecommerce.affiliateTeam.downloadTemplate")}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => fileInputRef.current?.click()}>
                  {t("ecommerce.affiliateTeam.importProtected")}
                </button>
              </div>
            </div>
            <div className="affiliate-protection-manual">
              <label>
                <span>{t("ecommerce.affiliateTeam.creatorIdentity")}</span>
                <input value={manualCreator} onChange={(event) => setManualCreator(event.target.value)} placeholder={t("ecommerce.affiliateTeam.creatorIdentityPlaceholder")} />
              </label>
              <label>
                <span>{t("ecommerce.affiliateTeam.assignProtectionDeveloper")}</span>
                <Select value={manualDeveloperId} options={protectionOwnerOptions} onChange={setManualDeveloperId} />
              </label>
              <label>
                <span>{t("ecommerce.affiliateTeam.note")}</span>
                <input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder={t("ecommerce.affiliateTeam.notePlaceholder")} />
              </label>
              <button className="btn btn-secondary" type="button" onClick={addManualProtection}>{t("ecommerce.affiliateTeam.addProtectedCreator")}</button>
            </div>
            {protectionRows.length > 0 && (
              <div className="affiliate-protection-preview">
                <div className="affiliate-protection-preview-head">
                  <strong>{t("ecommerce.affiliateTeam.importPreview")}</strong>
                  <button className="btn btn-primary btn-sm" type="button" onClick={submitProtectionRows} disabled={importState.loading || protectionRows.every((row) => row.error)}>
                    {t("ecommerce.affiliateTeam.importValid", { count: protectionRows.filter((row) => !row.error).length })}
                  </button>
                </div>
                {protectionRows.slice(0, 20).map((row) => (
                  <div className={`affiliate-protection-row ${row.error ? "affiliate-protection-row-error" : ""}`} key={row.rowNumber}>
                    <span>#{row.rowNumber}</span>
                    <strong>{row.username ? `@${row.username}` : row.creatorOpenId}</strong>
                    <span>{row.businessDeveloperName || t("ecommerce.affiliateTeam.protectedOnly")}</span>
                    <em>{row.error || t("ecommerce.affiliateTeam.ready")}</em>
                    <button className="affiliate-protection-remove" type="button" onClick={() => removeProtectionRow(row.rowNumber)} title={t("ecommerce.affiliateTeam.removePreviewRow")} aria-label={t("ecommerce.affiliateTeam.removePreviewRow")}><CloseIcon /></button>
                  </div>
                ))}
              </div>
            )}
            {!onboardingComplete && (
              <div className="affiliate-onboarding-completion">
                <label className="affiliate-onboarding-confirm">
                  <input type="checkbox" checked={confirmedProtectionBoundary} onChange={(event) => setConfirmedProtectionBoundary(event.target.checked)} />
                  <span>{t("ecommerce.affiliateTeam.confirmBoundary")}</span>
                </label>
                <button className="btn btn-primary" type="button" onClick={finishOnboarding} disabled={!confirmedProtectionBoundary || onboardingState.loading}>
                  {t("ecommerce.affiliateTeam.completeSetup")}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="affiliate-team-responsibility">
        <div className="affiliate-team-responsibility-head">
          <div>
            <span>{t("ecommerce.affiliateTeam.responsibilityMap")}</span>
            <h2>{t("ecommerce.affiliateTeam.responsibilityTitle")}</h2>
            <p>{t("ecommerce.affiliateTeam.responsibilityHint", { defaultValue: "Review each BD's workload and outreach accounts." })}</p>
          </div>
          <span className="affiliate-team-owner-count">{t("ecommerce.affiliateTeam.ownerCount", { count: developerTotalCount })}</span>
        </div>
        <div className="affiliate-team-workspace">
          <div className="affiliate-bd-table-toolbar">
            <label className="affiliate-bd-search">
              <span>{t("ecommerce.affiliateTeam.tableSearch", { defaultValue: "Search BDs" })}</span>
              <input
                className="input"
                value={developerSearch}
                onChange={(event) => setDeveloperSearch(event.target.value)}
                placeholder={t("ecommerce.affiliateTeam.ownerSearchPlaceholder", { defaultValue: "Search by name" })}
              />
            </label>
            <div className="affiliate-bd-table-filters">
              <label className="affiliate-bd-archive-toggle">
                <input
                  type="checkbox"
                  checked={showArchivedDevelopers}
                  onChange={(event) => setShowArchivedDevelopers(event.target.checked)}
                />
                <span>{t("ecommerce.affiliateTeam.showArchived", { defaultValue: "Show archived" })}</span>
              </label>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => setShowUnassignedAccounts(true)}
                disabled={unassignedChannelCount === 0}
              >
                {t("ecommerce.affiliateTeam.unassignedAccounts", {
                  count: unassignedChannelCount,
                  defaultValue: `Unassigned accounts (${unassignedChannelCount})`,
                })}
              </button>
            </div>
          </div>

          {developerSummaries.length > 0 ? (
            <>
              <div className="affiliate-bd-table-scroll">
                <table className="affiliate-bd-table">
                  <thead>
                    <tr>
                      <th>{t("ecommerce.affiliateTeam.businessDeveloper")}</th>
                      <th>{t("ecommerce.affiliateTeam.acceptingCreators")}</th>
                      <th className="is-numeric">{t("ecommerce.affiliateTeam.managedCreators", { defaultValue: "Creators" })}</th>
                      <th className="is-numeric">WhatsApp</th>
                      <th className="is-numeric">Outlook</th>
                      <th>{t("ecommerce.affiliateTeam.workMode")}</th>
                      <th><span className="sr-only">{t("common.actions", { defaultValue: "Actions" })}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {developerSummaries.map((summary) => {
                      const developer = summary.developer;
                      return (
                        <tr
                          key={developer.id}
                          className={developer.archivedAt ? "is-archived" : undefined}
                          tabIndex={0}
                          onClick={() => openDeveloperDetail(summary)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openDeveloperDetail(summary);
                            }
                          }}
                        >
                          <td>
                            <div className="affiliate-bd-identity">
                              <span className="affiliate-bd-avatar"><UserIcon /></span>
                              <span>
                                <strong>{developer.displayName}</strong>
                                <small>{developer.regions.length > 0 ? developer.regions.map((region) => formatShopRegionLabel(region, t)).join(", ") : t("ecommerce.affiliateTeam.allRegions", { defaultValue: "All regions" })}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`affiliate-bd-availability ${developer.acceptingCreators && !developer.archivedAt ? "is-accepting" : "is-paused"}`}>
                              {developer.archivedAt
                                ? t("ecommerce.affiliateTeam.archivedStatus", { defaultValue: "Archived" })
                                : developer.acceptingCreators
                                  ? t("ecommerce.affiliateTeam.acceptingStatus", { defaultValue: "Accepting" })
                                  : t("ecommerce.affiliateTeam.pausedStatus", { defaultValue: "Paused" })}
                            </span>
                          </td>
                          <td className="is-numeric"><strong>{summary.creatorRelationshipCount}</strong></td>
                          <td className="is-numeric"><ChannelCount total={summary.whatsappAccountCount} unhealthy={summary.unhealthyWhatsappAccountCount} /></td>
                          <td className="is-numeric"><ChannelCount total={summary.emailAccountCount} unhealthy={summary.unhealthyEmailAccountCount} /></td>
                          <td>{developer.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? t("ecommerce.affiliateTeam.humanOnly") : t("ecommerce.affiliateTeam.aiAssisted")}</td>
                          <td className="affiliate-bd-row-action"><ChevronRightIcon /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="affiliate-bd-pagination">
                <span>{t("ecommerce.affiliateTeam.paginationSummary", {
                  start: developerPage * DEVELOPER_PAGE_SIZE + 1,
                  end: Math.min((developerPage + 1) * DEVELOPER_PAGE_SIZE, developerTotalCount),
                  total: developerTotalCount,
                  defaultValue: `${developerPage * DEVELOPER_PAGE_SIZE + 1}-${Math.min((developerPage + 1) * DEVELOPER_PAGE_SIZE, developerTotalCount)} of ${developerTotalCount}`,
                })}</span>
                <div>
                  <button
                    className="affiliate-bd-page-button is-previous"
                    type="button"
                    onClick={() => setDeveloperPage((page) => Math.max(0, page - 1))}
                    disabled={developerPage === 0}
                    title={t("ecommerce.affiliateTeam.previousPage", { defaultValue: "Previous page" })}
                    aria-label={t("ecommerce.affiliateTeam.previousPage", { defaultValue: "Previous page" })}
                  ><ChevronRightIcon /></button>
                  <span>{developerPage + 1} / {developerTotalPages}</span>
                  <button
                    className="affiliate-bd-page-button"
                    type="button"
                    onClick={() => setDeveloperPage((page) => Math.min(developerTotalPages - 1, page + 1))}
                    disabled={developerPage + 1 >= developerTotalPages}
                    title={t("ecommerce.affiliateTeam.nextPage", { defaultValue: "Next page" })}
                    aria-label={t("ecommerce.affiliateTeam.nextPage", { defaultValue: "Next page" })}
                  ><ChevronRightIcon /></button>
                </div>
              </div>
            </>
          ) : developerPageQuery.loading ? (
            <div className="affiliate-bd-table-message">{t("common.loading")}</div>
          ) : (
            <div className="affiliate-team-empty-developers">
              <span className="affiliate-team-empty-developers-icon"><UserPlusIcon /></span>
              <h3>{deferredDeveloperSearch
                ? t("ecommerce.affiliateTeam.noSearchResults", { defaultValue: "No matching business developers" })
                : t("ecommerce.affiliateTeam.emptyDevelopersTitle")}</h3>
              <p>{deferredDeveloperSearch
                ? t("ecommerce.affiliateTeam.noSearchResultsHint", { defaultValue: "Try a different name or clear the archived filter." })
                : t("ecommerce.affiliateTeam.emptyDevelopersHint")}</p>
              {!deferredDeveloperSearch && <button className="btn btn-primary" type="button" onClick={beginCreateDeveloper}><UserPlusIcon />{t("ecommerce.affiliateTeam.addDeveloper")}</button>}
            </div>
          )}
        </div>
      </section>

      <Modal
        isOpen={Boolean(detailDeveloper && detailSummary)}
        onClose={() => setDetailSummary(null)}
        title={detailDeveloper?.displayName ?? t("ecommerce.affiliateTeam.businessDeveloper")}
        maxWidth={1120}
        className="affiliate-bd-detail-modal"
        closeLabel={t("common.close")}
        portal
      >
        {detailDeveloper && detailSummary && <>
          <div className="affiliate-bd-command-header">
            <div className="affiliate-bd-command-identity">
              <span className="affiliate-bd-command-avatar"><UserIcon /></span>
              <div>
                <div className="affiliate-bd-command-chips">
                  <span className={`affiliate-bd-availability ${detailDeveloper.acceptingCreators && !detailDeveloper.archivedAt ? "is-accepting" : "is-paused"}`}>
                    {detailDeveloper.archivedAt
                      ? t("ecommerce.affiliateTeam.archivedStatus", { defaultValue: "Archived" })
                      : detailDeveloper.acceptingCreators
                        ? t("ecommerce.affiliateTeam.acceptingStatus", { defaultValue: "Accepting" })
                        : t("ecommerce.affiliateTeam.pausedStatus", { defaultValue: "Paused" })}
                  </span>
                  <span>{detailDeveloper.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? t("ecommerce.affiliateTeam.humanOnly") : t("ecommerce.affiliateTeam.aiAssisted")}</span>
                </div>
                <p>{detailDeveloper.regions.length > 0 ? detailDeveloper.regions.map((region) => formatShopRegionLabel(region, t)).join(", ") : t("ecommerce.affiliateTeam.allRegions", { defaultValue: "All regions" })}</p>
              </div>
            </div>
            <div className="affiliate-bd-command-metric">
              <span>{t("ecommerce.affiliateTeam.managedCreators", { defaultValue: "Managed creators" })}</span>
              <strong>{detailSummary.creatorRelationshipCount}</strong>
            </div>
          </div>

          <div className="affiliate-bd-detail-scroll">
            <section className="affiliate-bd-channel-command">
              <div className="affiliate-bd-command-section-head">
                <div>
                  <strong>{t("ecommerce.affiliateTeam.channels")}</strong>
                  <span>{t("ecommerce.affiliateTeam.channelTransferHint", { defaultValue: "Transfer an account by choosing another BD in its owner field." })}</span>
                </div>
                <span>{detailSummary.whatsappAccountCount + detailSummary.emailAccountCount}</span>
              </div>
              <div className="affiliate-bd-channel-grid">
                <ChannelWorkspaceCard
                  channel="WHATSAPP"
                  accounts={detailWhatsapp}
                  ownerOptions={ownerOptions}
                  onOwnerChange={changeAccountOwner}
                  canConnect={!detailDeveloper.archivedAt}
                  connecting={connectChannel === "WHATSAPP"}
                  onConnect={() => setConnectChannel((value) => value === "WHATSAPP" ? null : "WHATSAPP")}
                  t={t}
                />
                <ChannelWorkspaceCard
                  channel="EMAIL"
                  accounts={detailEmail}
                  ownerOptions={ownerOptions}
                  onOwnerChange={changeAccountOwner}
                  canConnect={!detailDeveloper.archivedAt}
                  connecting={connectChannel === "EMAIL"}
                  onConnect={() => setConnectChannel((value) => value === "EMAIL" ? null : "EMAIL")}
                  t={t}
                />
              </div>
              {connectChannel && <div className="affiliate-channel-connectors">
                {connectChannel === "WHATSAPP"
                  ? <AffiliateWhatsAppAccountPanel businessDeveloperId={detailDeveloper.id} showAccountList={false} onAccountsChanged={refreshChannelData} />
                  : <AffiliateEmailAccountPanel businessDeveloperId={detailDeveloper.id} showAccountList={false} onAccountsChanged={refreshChannelData} />}
              </div>}
            </section>

            <section className="affiliate-bd-profile-section">
              <div className="affiliate-bd-command-section-head">
                <div>
                  <strong>{t("ecommerce.affiliateTeam.detailOverview", { defaultValue: "Overview" })}</strong>
                  <span>{t("ecommerce.affiliateTeam.workingStyle")}</span>
                </div>
              </div>
              <div className="affiliate-bd-profile-grid">
                <dl className="affiliate-bd-metadata">
                  <div><dt>{t("ecommerce.affiliateTeam.workMode")}</dt><dd>{detailDeveloper.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? t("ecommerce.affiliateTeam.humanOnly") : t("ecommerce.affiliateTeam.aiAssisted")}</dd></div>
                  <div><dt>{t("ecommerce.affiliateTeam.regions")}</dt><dd>{detailDeveloper.regions.length > 0 ? detailDeveloper.regions.map((region) => formatShopRegionLabel(region, t)).join(", ") : t("ecommerce.affiliateTeam.allRegions", { defaultValue: "All regions" })}</dd></div>
                  <div><dt>{t("ecommerce.affiliateTeam.acceptingCreators")}</dt><dd>{t(detailDeveloper.acceptingCreators ? "common.yes" : "common.no")}</dd></div>
                </dl>
                <div className="affiliate-team-instructions">
                  <span>{t("ecommerce.affiliateTeam.workingStyle")}</span>
                  <p>{detailDeveloper.businessPrompt || t("ecommerce.affiliateTeam.noWorkingStyle", { defaultValue: "No additional working instructions." })}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="affiliate-bd-detail-footer">
            {archiveBlocked && <span>{t("ecommerce.affiliateTeam.archiveBlockedHint", { defaultValue: "Move all creators and outreach accounts before archiving this BD." })}</span>}
            <div>
              {!detailDeveloper.archivedAt && <button className="btn btn-secondary" type="button" onClick={() => beginEditDeveloper(detailDeveloper)}>{t("common.edit")}</button>}
              {!detailDeveloper.archivedAt && <button className="btn btn-danger" type="button" onClick={handleArchiveDeveloper} disabled={archiveState.loading || archiveBlocked}>{t("ecommerce.affiliateTeam.archive")}</button>}
            </div>
          </div>
        </>}
      </Modal>

      <Modal
        isOpen={showUnassignedAccounts}
        onClose={() => setShowUnassignedAccounts(false)}
        title={t("ecommerce.affiliateTeam.unassignedAccountsTitle", { defaultValue: "Unassigned outreach accounts" })}
        maxWidth={920}
        className="affiliate-unassigned-modal"
        closeLabel={t("common.close")}
        portal
      >
        <div className="affiliate-unassigned-body">
          <p>{t("ecommerce.affiliateTeam.unassignedAccountsHint", { defaultValue: "Assign each account to the BD who will use it for creator communication." })}</p>
          <ChannelAccountRows channel="WHATSAPP" accounts={unassignedWhatsapp} ownerOptions={ownerOptions} onOwnerChange={changeAccountOwner} t={t} />
          <ChannelAccountRows channel="EMAIL" accounts={unassignedEmail} ownerOptions={ownerOptions} onOwnerChange={changeAccountOwner} t={t} />
          {unassignedChannelCount === 0 && <div className="affiliate-channel-empty">{t("ecommerce.affiliateTeam.noUnassignedAccounts", { defaultValue: "All outreach accounts are assigned." })}</div>}
        </div>
      </Modal>

      <Modal
        isOpen={editing}
        onClose={closeDeveloperEditor}
        title={editingDeveloper?.displayName ?? t("ecommerce.affiliateTeam.newDeveloper")}
        maxWidth={720}
        className="affiliate-developer-modal"
        closeLabel={t("common.close")}
        preventBackdropClose={writeState.loading}
        portal
      >
        <DeveloperEditor
          form={form}
          setForm={setForm}
          onCancel={closeDeveloperEditor}
          onSave={saveDeveloper}
          saving={writeState.loading}
          t={t}
        />
      </Modal>
    </div>
  );
});

export function DeveloperEditor({ form, setForm, onCancel, onSave, saving, t }: {
  form: DeveloperForm;
  setForm: (form: DeveloperForm) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return <div className="affiliate-developer-editor">
    <label><span>{t("ecommerce.affiliateTeam.name")}</span><input className="input" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
    <label><span>{t("ecommerce.affiliateTeam.workMode")}</span><Select value={form.agentAssistanceMode} onChange={(value) => setForm({ ...form, agentAssistanceMode: value as GQL.AffiliateAgentAssistanceMode })} options={[
      { value: GQL.AffiliateAgentAssistanceMode.AiAssisted, label: t("ecommerce.affiliateTeam.aiAssisted") },
      { value: GQL.AffiliateAgentAssistanceMode.HumanOnly, label: t("ecommerce.affiliateTeam.humanOnly") },
    ]} /></label>
    <fieldset><legend>{t("ecommerce.affiliateTeam.regions")}</legend><div className="affiliate-region-grid">{SHOP_REGIONS.map((region) => <label key={region}><input type="checkbox" checked={form.regions.includes(region)} onChange={(event) => setForm({ ...form, regions: event.target.checked ? [...form.regions, region] : form.regions.filter((item) => item !== region) })} /><span>{formatShopRegionLabel(region, t)}</span></label>)}</div></fieldset>
    <label className="affiliate-developer-toggle"><input type="checkbox" checked={form.acceptingCreators} onChange={(event) => setForm({ ...form, acceptingCreators: event.target.checked })} /><span>{t("ecommerce.affiliateTeam.acceptingCreators")}</span></label>
    <label><span>{t("ecommerce.affiliateTeam.workingStyle")}</span><textarea className="input" rows={7} value={form.businessPrompt} onChange={(event) => setForm({ ...form, businessPrompt: event.target.value })} placeholder={t("ecommerce.affiliateTeam.workingStylePlaceholder")} /></label>
    <div className="affiliate-developer-editor-actions"><button className="btn btn-secondary" type="button" onClick={onCancel}>{t("common.cancel")}</button><button className="btn btn-primary" type="button" onClick={onSave} disabled={saving || !form.displayName.trim()}>{t("common.save")}</button></div>
  </div>;
}

function ChannelCount({ total, unhealthy }: { total: number; unhealthy: number }) {
  return <span className={`affiliate-bd-channel-count ${unhealthy > 0 ? "has-warning" : ""}`}>
    <strong>{total}</strong>
    {unhealthy > 0 && <small>{unhealthy}</small>}
  </span>;
}

function ChannelAccountRows({ channel, accounts, ownerOptions, onOwnerChange, t }: {
  channel: "WHATSAPP" | "EMAIL";
  accounts: Array<{ id: string; businessDeveloperId?: string | null; status: string; displayName?: string | null; phoneNumber?: string | null; emailAddress?: string | null }>;
  ownerOptions: Array<{ value: string; label: string }>;
  onOwnerChange: (channel: "WHATSAPP" | "EMAIL", accountId: string, ownerId: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return <>{accounts.map((account) => {
    const address = account.phoneNumber || account.emailAddress;
    const statusLabel = channel === "WHATSAPP"
      ? t(`ecommerce.affiliateWorkspace.whatsapp.status.${account.status}`, { defaultValue: account.status })
      : t(`ecommerce.affiliateWorkspace.email.status.${account.status.toLowerCase()}`, { defaultValue: account.status });
    return <div className="affiliate-channel-row" key={account.id}>
      <span className="affiliate-channel-kind">{channel === "WHATSAPP" ? "WhatsApp" : "Outlook"}</span>
      <div>
        <strong>{account.displayName || address || t("ecommerce.affiliateTeam.unnamedAccount")}</strong>
        {address && account.displayName && <small>{address}</small>}
      </div>
      <span className={`affiliate-channel-health ${account.status.toLowerCase()}`}>{statusLabel}</span>
      <Select value={account.businessDeveloperId ?? UNASSIGNED_ID} onChange={(value) => onOwnerChange(channel, account.id, value)} options={ownerOptions} />
    </div>;
  })}</>;
}

function ChannelWorkspaceCard({ channel, accounts, ownerOptions, onOwnerChange, canConnect, connecting, onConnect, t }: {
  channel: "WHATSAPP" | "EMAIL";
  accounts: Array<{ id: string; businessDeveloperId?: string | null; status: string; displayName?: string | null; phoneNumber?: string | null; emailAddress?: string | null }>;
  ownerOptions: Array<{ value: string; label: string }>;
  onOwnerChange: (channel: "WHATSAPP" | "EMAIL", accountId: string, ownerId: string) => void;
  canConnect: boolean;
  connecting: boolean;
  onConnect: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const label = channel === "WHATSAPP" ? "WhatsApp" : "Outlook";
  const healthyCount = accounts.filter((account) => account.status.toLowerCase() === "connected").length;
  return <section className={`affiliate-bd-channel-card is-${channel.toLowerCase()}`}>
    <header className="affiliate-bd-channel-card-head">
      <div className="affiliate-bd-channel-brand">
        <span aria-hidden="true">{channel === "WHATSAPP" ? "W" : "O"}</span>
        <div>
          <strong>{label}</strong>
          <small>{channel === "WHATSAPP" ? t("ecommerce.affiliateTeam.whatsappAccounts") : t("ecommerce.affiliateTeam.emailAccounts")}</small>
        </div>
      </div>
      <span className={`affiliate-bd-channel-signal ${healthyCount === accounts.length && accounts.length > 0 ? "is-healthy" : ""}`}>
        {healthyCount}/{accounts.length}
      </span>
    </header>
    <div className="affiliate-bd-channel-card-body">
      {accounts.length > 0
        ? <ChannelAccountRows channel={channel} accounts={accounts} ownerOptions={ownerOptions} onOwnerChange={onOwnerChange} t={t} />
        : <div className="affiliate-bd-channel-card-empty">{t("ecommerce.affiliateTeam.noChannels")}</div>}
    </div>
    {canConnect && <footer>
      <button className={`btn btn-sm ${connecting ? "btn-primary" : "btn-secondary"}`} type="button" onClick={onConnect} aria-expanded={connecting}>
        {t("ecommerce.affiliateTeam.connectChannel")} · {label}
      </button>
    </footer>}
  </section>;
}

function normalizeSpreadsheetRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase().replace(/[\s-]+/g, "_"), value]));
}

function cleanCell(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}
