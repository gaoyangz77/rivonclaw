import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { CheckIcon, ChannelsIcon, CloseIcon, DownloadIcon, InfoIcon, RefreshIcon, UserIcon, UserPlusIcon } from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { formatShopRegionLabel } from "../../lib/ecommerce-labels.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
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
import { AffiliateWhatsAppAccountPanel } from "./components/AffiliateWhatsAppAccountPanel.js";

const AI_TEAM_ID = "__AI_TEAM__";
const UNASSIGNED_ID = "__UNASSIGNED__";
const SHOP_REGIONS = Object.values(GQL.ShopRegion);

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
  const [selectedOwnerId, setSelectedOwnerId] = useState(AI_TEAM_ID);
  const [editing, setEditing] = useState(false);
  const [editingDeveloperId, setEditingDeveloperId] = useState<string | null>(null);
  const [form, setForm] = useState<DeveloperForm>(EMPTY_DEVELOPER);
  const [showConnectors, setShowConnectors] = useState(false);
  const [protectionRows, setProtectionRows] = useState<ProtectionPreviewRow[]>([]);
  const [manualCreator, setManualCreator] = useState("");
  const [manualDeveloperId, setManualDeveloperId] = useState(UNASSIGNED_ID);
  const [manualNote, setManualNote] = useState("");
  const [confirmedProtectionBoundary, setConfirmedProtectionBoundary] = useState(false);
  const [showProtectionManager, setShowProtectionManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const developersQuery = useQuery<{ affiliateBusinessDevelopers: GQL.AffiliateBusinessDeveloper[] }>(
    AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
    { variables: { includeArchived: true }, fetchPolicy: "cache-and-network" },
  );
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
  const selectedDeveloper = selectedOwnerId === AI_TEAM_ID
    ? null
    : workspace.getBusinessDeveloper(selectedOwnerId);
  const editingDeveloper = editingDeveloperId
    ? workspace.getBusinessDeveloper(editingDeveloperId)
    : null;
  const selectedWhatsapp = workspace.whatsappAccountsForBusinessDeveloper(selectedDeveloper?.id ?? null);
  const selectedEmail = workspace.emailAccountsForBusinessDeveloper(selectedDeveloper?.id ?? null);
  const ownerOptions = useMemo(() => [
    { value: UNASSIGNED_ID, label: t("ecommerce.affiliateTeam.aiTeam") },
    ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
  ], [activeDevelopers, t]);
  const protectionOwnerOptions = useMemo(() => [
    { value: UNASSIGNED_ID, label: t("ecommerce.affiliateTeam.protectionUnassigned") },
    ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
  ], [activeDevelopers, t]);
  const loading = developersQuery.loading || settingsQuery.loading || whatsappQuery.loading || emailQuery.loading;
  const onboardingComplete = Boolean(workspace.operationalSettings?.onboardingCompletedAt);
  const totalChannelCount = workspace.whatsappAccounts.length + workspace.emailAccounts.length;
  const unassignedChannelCount = workspace.whatsappAccounts.filter((account) => !account.businessDeveloperId).length
    + workspace.emailAccounts.filter((account) => !account.businessDeveloperId).length;
  const protectedCreatorCount = workspace.creatorProtectionIntents.length;
  const appliedProtectionCount = workspace.creatorProtectionIntents.filter((intent) => intent.appliedAt).length;
  const protectionManagerOpen = !onboardingComplete || showProtectionManager;

  function beginCreateDeveloper() {
    setEditingDeveloperId(null);
    setForm(EMPTY_DEVELOPER);
    setEditing(true);
  }

  function beginEditDeveloper(developer: typeof selectedDeveloper) {
    if (!developer) return;
    setEditingDeveloperId(developer.id);
    setForm({
      displayName: developer.displayName,
      regions: [...developer.regions] as GQL.ShopRegion[],
      acceptingCreators: developer.acceptingCreators,
      agentAssistanceMode: developer.agentAssistanceMode as GQL.AffiliateAgentAssistanceMode,
      businessPrompt: developer.businessPrompt ?? "",
    });
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
      setSelectedOwnerId(developer.id);
      setEditing(false);
      setEditingDeveloperId(null);
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
    if (!selectedDeveloper) return;
    if (!window.confirm(t("ecommerce.affiliateTeam.archiveConfirm", { name: selectedDeveloper.displayName }))) return;
    try {
      const result = await archiveDeveloper({ variables: { id: selectedDeveloper.id } });
      if (result.data?.archiveAffiliateBusinessDeveloper) {
        workspace.upsertAffiliateBusinessDeveloper(result.data.archiveAffiliateBusinessDeveloper);
      }
      setSelectedOwnerId(AI_TEAM_ID);
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
        const refreshed = await whatsappQuery.refetch();
        workspace.replaceAffiliateWhatsAppAccounts(refreshed.data?.whatsAppAccountBindings ?? []);
      } else {
        if (nextOwner === UNASSIGNED_ID) await unassignEmail({ variables: { accountBindingId: accountId } });
        else await assignEmail({ variables: { accountBindingId: accountId, businessDeveloperId: nextOwner } });
        const refreshed = await emailQuery.refetch();
        workspace.replaceAffiliateEmailAccounts(refreshed.data?.emailAccountBindings ?? []);
      }
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
            developersQuery.refetch(), settingsQuery.refetch(), whatsappQuery.refetch(), emailQuery.refetch(),
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
            <p>{t("ecommerce.affiliateTeam.responsibilityHint")}</p>
          </div>
          <span className="affiliate-team-owner-count">{t("ecommerce.affiliateTeam.ownerCount", { count: activeDevelopers.length + 1 })}</span>
        </div>
        <div className="affiliate-team-workspace">
        <aside className="affiliate-team-roster">
          <div className="affiliate-team-section-head">
            <strong>{t("ecommerce.affiliateTeam.roster")}</strong>
            <span>{activeDevelopers.length + 1}</span>
          </div>
          <button className={`affiliate-team-roster-item ${selectedOwnerId === AI_TEAM_ID ? "active" : ""}`} type="button" onClick={() => { setSelectedOwnerId(AI_TEAM_ID); setShowConnectors(false); }}>
            <span className="affiliate-team-avatar"><ChannelsIcon /></span>
            <span><strong>{t("ecommerce.affiliateTeam.aiTeam")}</strong><small>{t("ecommerce.affiliateTeam.aiTeamHint")}</small></span>
            <span className="affiliate-team-roster-count">{unassignedChannelCount}</span>
          </button>
          {activeDevelopers.map((developer) => (
            <button className={`affiliate-team-roster-item ${selectedOwnerId === developer.id ? "active" : ""}`} type="button" key={developer.id} onClick={() => { setSelectedOwnerId(developer.id); setShowConnectors(false); }}>
              <span className="affiliate-team-avatar"><UserIcon /></span>
              <span><strong>{developer.displayName}</strong><small>{developer.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? t("ecommerce.affiliateTeam.humanOnly") : t("ecommerce.affiliateTeam.aiAssisted")}</small></span>
              <span className="affiliate-team-roster-count">{workspace.whatsappAccountsForBusinessDeveloper(developer.id).length + workspace.emailAccountsForBusinessDeveloper(developer.id).length}</span>
            </button>
          ))}
        </aside>

        <div className="affiliate-team-detail">
          <div className="affiliate-team-detail-head">
            <div>
              <span>{selectedDeveloper ? t("ecommerce.affiliateTeam.businessDeveloper") : t("ecommerce.affiliateTeam.virtualOwner")}</span>
              <h2>{selectedDeveloper?.displayName ?? t("ecommerce.affiliateTeam.aiTeam")}</h2>
              <p>{selectedDeveloper ? t("ecommerce.affiliateTeam.developerHint") : t("ecommerce.affiliateTeam.aiTeamDescription")}</p>
            </div>
            {selectedDeveloper && <div className="affiliate-team-detail-actions">
              <button className="btn btn-secondary" type="button" onClick={() => beginEditDeveloper(selectedDeveloper)}>{t("common.edit")}</button>
              <button className="btn btn-danger" type="button" onClick={handleArchiveDeveloper} disabled={archiveState.loading}>{t("ecommerce.affiliateTeam.archive")}</button>
            </div>}
          </div>
          <div className="affiliate-team-facts">
            <div><span>{t("ecommerce.affiliateTeam.workMode")}</span><strong>{selectedDeveloper ? (selectedDeveloper.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? t("ecommerce.affiliateTeam.humanOnly") : t("ecommerce.affiliateTeam.aiAssisted")) : t("ecommerce.affiliateTeam.aiManaged")}</strong></div>
            <div><span>{t("ecommerce.affiliateTeam.whatsappAccounts")}</span><strong>{selectedWhatsapp.length}</strong></div>
            <div><span>{t("ecommerce.affiliateTeam.emailAccounts")}</span><strong>{selectedEmail.length}</strong></div>
            <div><span>{t("ecommerce.affiliateTeam.acceptingCreators")}</span><strong>{selectedDeveloper ? t(selectedDeveloper.acceptingCreators ? "common.yes" : "common.no") : t("common.yes")}</strong></div>
          </div>
          {selectedDeveloper?.businessPrompt && <div className="affiliate-team-instructions"><span>{t("ecommerce.affiliateTeam.workingStyle")}</span><p>{selectedDeveloper.businessPrompt}</p></div>}

          <section className="affiliate-channel-section">
            <div className="affiliate-team-section-head"><strong>{t("ecommerce.affiliateTeam.channels")}</strong><button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowConnectors((value) => !value)}>{showConnectors ? t("common.close") : t("ecommerce.affiliateTeam.connectChannel")}</button></div>
            <ChannelAccountRows channel="WHATSAPP" accounts={selectedWhatsapp} ownerOptions={ownerOptions} onOwnerChange={changeAccountOwner} t={t} />
            <ChannelAccountRows channel="EMAIL" accounts={selectedEmail} ownerOptions={ownerOptions} onOwnerChange={changeAccountOwner} t={t} />
            {selectedWhatsapp.length + selectedEmail.length === 0 && <div className="affiliate-channel-empty">{t("ecommerce.affiliateTeam.noChannels")}</div>}
          </section>
          {showConnectors && <div className="affiliate-channel-connectors">
            <AffiliateWhatsAppAccountPanel businessDeveloperId={selectedDeveloper?.id ?? null} />
            <AffiliateEmailAccountPanel businessDeveloperId={selectedDeveloper?.id ?? null} />
          </div>}
        </div>
      </div>
      </section>
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

function DeveloperEditor({ form, setForm, onCancel, onSave, saving, t }: {
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

function ChannelAccountRows({ channel, accounts, ownerOptions, onOwnerChange, t }: {
  channel: "WHATSAPP" | "EMAIL";
  accounts: Array<{ id: string; businessDeveloperId?: string | null; status: string; displayName?: string | null; phoneNumber?: string | null; emailAddress?: string | null }>;
  ownerOptions: Array<{ value: string; label: string }>;
  onOwnerChange: (channel: "WHATSAPP" | "EMAIL", accountId: string, ownerId: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return <>{accounts.map((account) => <div className="affiliate-channel-row" key={account.id}>
    <span className="affiliate-channel-kind">{channel === "WHATSAPP" ? "WhatsApp" : "Outlook"}</span>
    <div><strong>{account.displayName || account.phoneNumber || account.emailAddress || t("ecommerce.affiliateTeam.unnamedAccount")}</strong><small>{account.phoneNumber || account.emailAddress || account.status}</small></div>
    <span className={`affiliate-channel-health ${account.status.toLowerCase()}`}>{account.status}</span>
    <Select value={account.businessDeveloperId ?? UNASSIGNED_ID} onChange={(value) => onOwnerChange(channel, account.id, value)} options={ownerOptions} />
  </div>)}</>;
}

function normalizeSpreadsheetRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase().replace(/[\s-]+/g, "_"), value]));
}

function cleanCell(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}
