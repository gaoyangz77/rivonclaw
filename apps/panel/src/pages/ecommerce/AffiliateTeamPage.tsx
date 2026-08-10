import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { ChannelsIcon, CheckIcon, ChevronRightIcon, CloseIcon, DownloadIcon, GlobeIcon, InfoIcon, RefreshIcon, UserIcon, UserPlusIcon } from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { formatShopRegionLabel } from "../../lib/ecommerce-labels.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
  AFFILIATE_BUSINESS_DEVELOPER_PAGE_QUERY,
  AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY,
  AFFILIATE_CREATOR_PROTECTIONS_QUERY,
  AFFILIATE_OPERATIONAL_SETTINGS_QUERY,
  ARCHIVE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
  ASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION,
  ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION,
  COMPLETE_AFFILIATE_OPERATIONAL_ONBOARDING_MUTATION,
  EMAIL_ACCOUNT_BINDINGS_QUERY,
  ENSURE_AFFILIATE_BUSINESS_DEVELOPERS_MUTATION,
  IMPORT_AFFILIATE_CREATOR_PROTECTIONS_MUTATION,
  REMOVE_AFFILIATE_CREATOR_PROTECTION_MUTATION,
  SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION,
  UNASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION,
  UNASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION,
  WHATSAPP_ACCOUNT_BINDINGS_QUERY,
  WRITE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
} from "../../api/shops-queries.js";
import { AffiliateEmailAccountPanel } from "./components/AffiliateEmailAccountPanel.js";
import { AffiliateApprovalPolicyPanel } from "./components/AffiliateApprovalPolicyPanel.js";
import { AffiliateWhatsAppAccountPanel } from "./components/AffiliateWhatsAppAccountPanel.js";
import {
  buildAffiliateDeveloperProvisionBatches,
  buildAffiliateProtectionDeveloperResolutionSeeds,
  buildAffiliateProtectionImportBatches,
  classifyAffiliateProtectionPreviewRow,
  normalizeAffiliateBusinessDeveloperName,
  summarizeAffiliateProtectionAssignments,
} from "./affiliate-protection-import.js";

const UNASSIGNED_ID = "__UNASSIGNED__";
const DEVELOPER_PAGE_SIZE = 25;
const PROTECTION_PAGE_SIZE = 25;
const PROTECTION_PREVIEW_PAGE_SIZE = 50;
const PROTECTION_IMPORT_BATCH_TIMEOUT_MS = 90_000;
export const SHOP_REGIONS = Object.values(GQL.ShopRegion);
export const PROTECTED_CREATOR_TEMPLATE_HEADERS = [
  "creator_username",
  "bd_name",
] as const;

type DeveloperSummary = GQL.AffiliateBusinessDeveloperSummary;
type ConnectChannel = "WHATSAPP" | "EMAIL" | null;
type DeveloperDetailTab = "CHANNELS" | "SETTINGS";
type TeamPageTab = "TEAM" | "ASSIGNMENTS" | "SAFETY";
type ProtectionImportView = "ADD" | "RESOLVE" | "PREVIEW";
type ProtectionComposerMode = "FILE" | "MANUAL";
type ChannelAccount = {
  id: string;
  businessDeveloperId?: string | null;
  status: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  lastError?: string | null;
};
type PendingAccountTransfer = {
  channel: "WHATSAPP" | "EMAIL";
  account: ChannelAccount;
};

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
  excluded?: boolean;
};

type ProtectionImportProgress = {
  completed: number;
  total: number;
  batch: number;
  totalBatches: number;
};

type ProtectionImportPhase =
  | "IDLE"
  | "PARSING"
  | "AWAITING_CONFIRMATION"
  | "PROVISIONING_BDS"
  | "IMPORTING_PROTECTIONS"
  | "COMPLETED"
  | "PARTIAL_FAILED";

type BusinessDeveloperResolution = "CREATE" | "RESTORE" | "MAP" | "UNASSIGNED" | "EXCLUDE" | "";

type BusinessDeveloperResolutionGroup = {
  clientKey: string;
  sourceName: string;
  normalizedSourceName: string;
  proposedName: string;
  rowNumbers: number[];
  archivedDeveloperId: string | null;
  resolution: BusinessDeveloperResolution;
  mappedDeveloperId: string;
  mapSearch: string;
  error: string | null;
};

const EMPTY_DEVELOPER: DeveloperForm = {
  displayName: "",
  regions: [],
  acceptingCreators: true,
  agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
  businessPrompt: "",
};

function readTeamPageTab(): TeamPageTab {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "assignments") return "ASSIGNMENTS";
  if (view === "safety") return "SAFETY";
  return "TEAM";
}

export const AffiliateTeamPage = observer(function AffiliateTeamPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const workspace = entityStore.affiliateWorkspace;
  const [pageTab, setPageTab] = useState<TeamPageTab>(readTeamPageTab);
  const [developerPage, setDeveloperPage] = useState(0);
  const [developerSearch, setDeveloperSearch] = useState("");
  const [showArchivedDevelopers, setShowArchivedDevelopers] = useState(false);
  const [detailSummary, setDetailSummary] = useState<DeveloperSummary | null>(null);
  const [detailTab, setDetailTab] = useState<DeveloperDetailTab>("CHANNELS");
  const [connectChannel, setConnectChannel] = useState<ConnectChannel>(null);
  const [reconnectWhatsAppAccountId, setReconnectWhatsAppAccountId] = useState<string | null>(null);
  const [pendingAccountTransfer, setPendingAccountTransfer] = useState<PendingAccountTransfer | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [showUnassignedAccounts, setShowUnassignedAccounts] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingDeveloperId, setEditingDeveloperId] = useState<string | null>(null);
  const [form, setForm] = useState<DeveloperForm>(EMPTY_DEVELOPER);
  const [protectionRows, setProtectionRows] = useState<ProtectionPreviewRow[]>([]);
  const [protectionImportProgress, setProtectionImportProgress] = useState<ProtectionImportProgress | null>(null);
  const [protectionImportPhase, setProtectionImportPhase] = useState<ProtectionImportPhase>("IDLE");
  const [protectionImportOperationId, setProtectionImportOperationId] = useState<string | null>(null);
  const [developerProvisionRevision, setDeveloperProvisionRevision] = useState(0);
  const [developerResolutionGroups, setDeveloperResolutionGroups] = useState<BusinessDeveloperResolutionGroup[]>([]);
  const [protectionImportOpen, setProtectionImportOpen] = useState(false);
  const [protectionImportView, setProtectionImportView] = useState<ProtectionImportView>("ADD");
  const [protectionComposerMode, setProtectionComposerMode] = useState<ProtectionComposerMode>("FILE");
  const [protectionImportFileName, setProtectionImportFileName] = useState("");
  const [protectionDragActive, setProtectionDragActive] = useState(false);
  const [protectionPreviewPage, setProtectionPreviewPage] = useState(0);
  const [manualCreator, setManualCreator] = useState("");
  const [manualDeveloperId, setManualDeveloperId] = useState(UNASSIGNED_ID);
  const [manualNote, setManualNote] = useState("");
  const [confirmedProtectionBoundary, setConfirmedProtectionBoundary] = useState(false);
  const [protectionPage, setProtectionPage] = useState(0);
  const [protectionSearch, setProtectionSearch] = useState("");
  const [protectionDeveloperId, setProtectionDeveloperId] = useState("");
  const [protectionResolution, setProtectionResolution] = useState<"" | GQL.AffiliateCreatorProtectionResolution>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deferredDeveloperSearch = useDeferredValue(developerSearch.trim());
  const deferredProtectionSearch = useDeferredValue(protectionSearch.trim());

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
  const protectionQuery = useQuery<
    { affiliateCreatorProtections: GQL.AffiliateCreatorProtectionPage },
    { input: GQL.AffiliateCreatorProtectionPageInput }
  >(AFFILIATE_CREATOR_PROTECTIONS_QUERY, {
    variables: {
      input: {
        offset: protectionPage * PROTECTION_PAGE_SIZE,
        limit: PROTECTION_PAGE_SIZE,
        search: deferredProtectionSearch || null,
        businessDeveloperId: protectionDeveloperId || null,
        resolution: protectionResolution || null,
      },
    },
    fetchPolicy: "cache-and-network",
  });
  const whatsappQuery = useQuery<{ whatsAppAccountBindings: GQL.WhatsAppAccountBinding[] }>(
    WHATSAPP_ACCOUNT_BINDINGS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const emailQuery = useQuery<{ emailAccountBindings: GQL.EmailAccountBinding[] }>(
    EMAIL_ACCOUNT_BINDINGS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const channelContactsQuery = useQuery<
    { affiliateCreatorChannelContacts: GQL.AffiliateCreatorChannelContactPage },
    { input: GQL.AffiliateCreatorChannelContactPageInput }
  >(AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY, {
    variables: {
      input: {
        businessDeveloperId: detailSummary?.developer.id ?? null,
        includeHistorical: false,
        offset: 0,
        limit: 100,
      },
    },
    skip: !detailSummary?.developer.id,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (developersQuery.data) workspace.replaceAffiliateBusinessDevelopers(developersQuery.data.affiliateBusinessDevelopers);
  }, [developersQuery.data, workspace]);
  useEffect(() => {
    if (settingsQuery.data) workspace.setAffiliateOperationalSettings(settingsQuery.data.affiliateOperationalSettings);
  }, [settingsQuery.data, workspace]);
  useEffect(() => setProtectionPage(0), [deferredProtectionSearch, protectionDeveloperId, protectionResolution]);
  useEffect(() => {
    if (whatsappQuery.data) workspace.replaceAffiliateWhatsAppAccounts(whatsappQuery.data.whatsAppAccountBindings);
  }, [whatsappQuery.data, workspace]);
  useEffect(() => {
    if (emailQuery.data) workspace.replaceAffiliateEmailAccounts(emailQuery.data.emailAccountBindings);
  }, [emailQuery.data, workspace]);
  useEffect(() => {
    setDeveloperPage(0);
  }, [deferredDeveloperSearch, showArchivedDevelopers]);
  useEffect(() => {
    const syncTabFromUrl = () => setPageTab(readTeamPageTab());
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  const [writeDeveloper, writeState] = useMutation<
    { writeAffiliateBusinessDeveloper: GQL.AffiliateBusinessDeveloper },
    { input: GQL.WriteAffiliateBusinessDeveloperInput }
  >(WRITE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [ensureDevelopers, ensureDevelopersState] = useMutation<
    { ensureAffiliateBusinessDevelopers: GQL.EnsureAffiliateBusinessDevelopersPayload },
    { input: GQL.EnsureAffiliateBusinessDevelopersInput }
  >(ENSURE_AFFILIATE_BUSINESS_DEVELOPERS_MUTATION);
  const [archiveDeveloper, archiveState] = useMutation<
    { archiveAffiliateBusinessDeveloper: GQL.AffiliateBusinessDeveloper },
    { id: string }
  >(ARCHIVE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [assignWhatsapp] = useMutation(ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION);
  const [unassignWhatsapp] = useMutation(UNASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION);
  const [assignEmail] = useMutation(ASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION);
  const [unassignEmail] = useMutation(UNASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION);
  const [setPreferredAccount, preferredAccountState] = useMutation<
    { setAffiliateBusinessDeveloperPreferredAccount: GQL.AffiliateBusinessDeveloper },
    { input: GQL.SetAffiliateBusinessDeveloperPreferredAccountInput }
  >(SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION);
  const [importProtections, importState] = useMutation<
    { importAffiliateCreatorProtections: GQL.ImportAffiliateCreatorProtectionsPayload },
    { input: GQL.ImportAffiliateCreatorProtectionsInput }
  >(IMPORT_AFFILIATE_CREATOR_PROTECTIONS_MUTATION);
  const [removeProtection, removeProtectionState] = useMutation<
    { removeAffiliateCreatorProtection: GQL.AffiliateCreatorProtectionRemovalPayload },
    { id: string }
  >(REMOVE_AFFILIATE_CREATOR_PROTECTION_MUTATION);
  const [completeOnboarding, onboardingState] = useMutation<{
    completeAffiliateOperationalOnboarding: GQL.AffiliateOperationalSettings;
  }>(COMPLETE_AFFILIATE_OPERATIONAL_ONBOARDING_MUTATION);
  const protectionImportBusy = (
    importState.loading ||
    ensureDevelopersState.loading ||
    protectionImportProgress !== null
  );

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
  const detailChannelCount = detailWhatsapp.length + detailEmail.length;
  const detailHealthyChannelCount = [...detailWhatsapp, ...detailEmail]
    .filter((account) => account.status.toLowerCase() === "connected").length;
  const detailChannelContacts = channelContactsQuery.data?.affiliateCreatorChannelContacts.items ?? [];
  const detailRegionLabel = detailDeveloper
    ? detailDeveloper.regions.length > 0
      ? detailDeveloper.regions.map((region) => formatShopRegionLabel(region, t)).join(", ")
      : t("ecommerce.affiliateTeam.allRegions", { defaultValue: "All regions" })
    : "";
  const unassignedWhatsapp = activeWhatsappAccounts.filter((account) => !account.businessDeveloperId);
  const unassignedEmail = activeEmailAccounts.filter((account) => !account.businessDeveloperId);
  const totalChannelCount = activeWhatsappAccounts.length + activeEmailAccounts.length;
  const unassignedChannelCount = unassignedWhatsapp.length + unassignedEmail.length;
  const ownerOptions = useMemo(() => [
    { value: UNASSIGNED_ID, label: t("ecommerce.affiliateTeam.unassignedOwner") },
    ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
  ], [activeDevelopers, t]);
  const transferOwnerOptions = useMemo(
    () => ownerOptions.filter((option) => option.value !== detailDeveloper?.id),
    [detailDeveloper?.id, ownerOptions],
  );
  const protectionOwnerOptions = useMemo(() => [
    { value: UNASSIGNED_ID, label: t("ecommerce.affiliateTeam.protectionUnassigned") },
    ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
  ], [activeDevelopers, t]);
  const loading = developersQuery.loading || developerPageQuery.loading || settingsQuery.loading || whatsappQuery.loading || emailQuery.loading;
  const onboardingComplete = Boolean(workspace.operationalSettings?.onboardingCompletedAt);
  const protectionData = protectionQuery.data?.affiliateCreatorProtections;
  const protectedCreatorCount = (protectionData?.resolvedCount ?? 0) + (protectionData?.unresolvedCount ?? 0);
  const appliedProtectionCount = protectionData?.resolvedCount ?? 0;
  const protectionTotalPages = Math.max(1, Math.ceil((protectionData?.totalCount ?? 0) / PROTECTION_PAGE_SIZE));
  const protectionPreviewTotalPages = Math.max(
    1,
    Math.ceil(protectionRows.length / PROTECTION_PREVIEW_PAGE_SIZE),
  );
  const visibleProtectionRows = protectionRows.slice(
    protectionPreviewPage * PROTECTION_PREVIEW_PAGE_SIZE,
    (protectionPreviewPage + 1) * PROTECTION_PREVIEW_PAGE_SIZE,
  );
  const protectionPreviewCounts = protectionRows.reduce((counts, row) => {
    const disposition = classifyAffiliateProtectionPreviewRow(row);
    counts[disposition] += 1;
    return counts;
  }, {
    ERROR: 0,
    EXCLUDED: 0,
    NEEDS_DEVELOPER_DECISION: 0,
    ASSIGNED: 0,
    PROTECTION_ONLY: 0,
  });
  const protectionAssignmentSummary = useMemo(
    () => summarizeAffiliateProtectionAssignments(protectionRows),
    [protectionRows],
  );
  const archiveBlocked = Boolean(detailSummary && (
    detailSummary.creatorRelationshipCount
    + detailSummary.whatsappAccountCount
    + detailSummary.emailAccountCount > 0
  ));
  const detailFormDirty = Boolean(detailDeveloper && (
    form.displayName.trim() !== detailDeveloper.displayName
    || form.agentAssistanceMode !== detailDeveloper.agentAssistanceMode
    || form.acceptingCreators !== detailDeveloper.acceptingCreators
    || [...form.regions].sort().join("|") !== [...detailDeveloper.regions].sort().join("|")
    || form.businessPrompt.trim() !== (detailDeveloper.businessPrompt?.trim() ?? "")
  ));
  const detailNeedsProfileConfirmation = (
    detailDeveloper?.profileStatus === GQL.AffiliateBusinessDeveloperProfileStatus.NeedsConfiguration
  );

  useEffect(() => {
    if (developerPage > 0 && developerPage >= developerTotalPages) {
      setDeveloperPage(developerTotalPages - 1);
    }
  }, [developerPage, developerTotalPages]);

  useEffect(() => {
    if (protectionPreviewPage > 0 && protectionPreviewPage >= protectionPreviewTotalPages) {
      setProtectionPreviewPage(protectionPreviewTotalPages - 1);
    }
  }, [protectionPreviewPage, protectionPreviewTotalPages]);

  const refreshChannelData = useCallback(async () => {
    const [whatsappResult, emailResult, pageResult] = await Promise.all([
      whatsappQuery.refetch(),
      emailQuery.refetch(),
      developerPageQuery.refetch(),
    ]);
    if (detailSummary?.developer.id) await channelContactsQuery.refetch();
    workspace.replaceAffiliateWhatsAppAccounts(whatsappResult.data?.whatsAppAccountBindings ?? []);
    workspace.replaceAffiliateEmailAccounts(emailResult.data?.emailAccountBindings ?? []);
    setDetailSummary((current) => {
      if (!current) return current;
      return pageResult.data?.affiliateBusinessDeveloperPage.items.find(
        (item) => item.developer.id === current.developer.id,
      ) ?? current;
    });
  }, [channelContactsQuery, detailSummary?.developer.id, developerPageQuery, emailQuery, whatsappQuery, workspace]);

  async function handleSetPreferredAccount(channel: "WHATSAPP" | "EMAIL", accountId: string) {
    if (!detailDeveloper) return;
    try {
      const result = await setPreferredAccount({
        variables: {
          input: {
            businessDeveloperId: detailDeveloper.id,
            channel: channel === "WHATSAPP"
              ? GQL.AffiliateMessageChannel.Whatsapp
              : GQL.AffiliateMessageChannel.Email,
            accountBindingId: accountId,
          },
        },
      });
      const developer = result.data?.setAffiliateBusinessDeveloperPreferredAccount;
      if (developer) {
        workspace.upsertAffiliateBusinessDeveloper(developer);
        setDetailSummary((current) => current ? { ...current, developer } : current);
      }
      showToast(t("ecommerce.affiliateTeam.preferredAccountSaved", { defaultValue: "Preferred sender updated." }), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function openDeveloperDetail(summary: DeveloperSummary) {
    const developer = workspace.getBusinessDeveloper(summary.developer.id) ?? summary.developer;
    setDetailSummary(summary);
    setEditingDeveloperId(developer.id);
    setForm({
      displayName: developer.displayName,
      regions: Array.from(developer.regions) as GQL.ShopRegion[],
      acceptingCreators: developer.acceptingCreators,
      agentAssistanceMode: developer.agentAssistanceMode as GQL.AffiliateAgentAssistanceMode,
      businessPrompt: developer.businessPrompt ?? "",
    });
    setConnectChannel(null);
    setReconnectWhatsAppAccountId(null);
    setPendingAccountTransfer(null);
    setTransferTargetId("");
    setDetailTab("CHANNELS");
  }

  function closeDeveloperDetail() {
    if (writeState.loading) return;
    if (detailFormDirty && !window.confirm(t("ecommerce.affiliateTeam.unsavedChangesConfirm"))) return;
    setDetailSummary(null);
    setEditingDeveloperId(null);
    setConnectChannel(null);
    setReconnectWhatsAppAccountId(null);
    setPendingAccountTransfer(null);
    setTransferTargetId("");
    setDetailTab("CHANNELS");
  }

  function beginCreateDeveloper() {
    setEditingDeveloperId(null);
    setForm(EMPTY_DEVELOPER);
    setEditing(true);
  }

  async function saveDeveloper() {
    const displayName = form.displayName.trim();
    if (!displayName) {
      showToast(t("ecommerce.affiliateTeam.nameRequired"), "error");
      return;
    }
    const savingDetail = Boolean(detailSummary && editingDeveloper);
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
      if (savingDetail) {
        setEditingDeveloperId(developer.id);
        setForm({
          displayName: developer.displayName,
          regions: Array.from(developer.regions) as GQL.ShopRegion[],
          acceptingCreators: developer.acceptingCreators,
          agentAssistanceMode: developer.agentAssistanceMode,
          businessPrompt: developer.businessPrompt ?? "",
        });
        setDetailSummary((current) => current ? { ...current, developer } : current);
      } else {
        setEditingDeveloperId(null);
      }
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

  async function changeAccountOwner(channel: "WHATSAPP" | "EMAIL", accountId: string, nextOwner: string, confirmed = false): Promise<boolean> {
    if (!confirmed && !window.confirm(t("ecommerce.affiliateTeam.transferConfirm"))) return false;
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
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
      return false;
    }
  }

  function beginAccountTransfer(channel: "WHATSAPP" | "EMAIL", account: ChannelAccount) {
    setPendingAccountTransfer({ channel, account });
    setTransferTargetId("");
  }

  async function confirmAccountTransfer() {
    if (!pendingAccountTransfer || !transferTargetId) return;
    setTransferBusy(true);
    const moved = await changeAccountOwner(
      pendingAccountTransfer.channel,
      pendingAccountTransfer.account.id,
      transferTargetId,
      true,
    );
    setTransferBusy(false);
    if (moved) {
      setPendingAccountTransfer(null);
      setTransferTargetId("");
    }
  }

  function resetProtectionImportDraft() {
    setProtectionRows([]);
    setProtectionImportProgress(null);
    setProtectionImportPhase("IDLE");
    setProtectionImportOperationId(null);
    setDeveloperProvisionRevision(0);
    setDeveloperResolutionGroups([]);
    setProtectionImportFileName("");
    setProtectionPreviewPage(0);
    setManualCreator("");
    setManualDeveloperId(UNASSIGNED_ID);
    setManualNote("");
  }

  function openProtectionImport() {
    resetProtectionImportDraft();
    setProtectionComposerMode("FILE");
    setProtectionImportView("ADD");
    setProtectionImportOpen(true);
  }

  function closeProtectionImport() {
    if (protectionImportBusy) return;
    setProtectionImportOpen(false);
    setProtectionDragActive(false);
    resetProtectionImportDraft();
  }

  async function processProtectionFile(file: File) {
    setProtectionImportPhase("PARSING");
    setProtectionImportFileName(file.name);
    try {
      const developerResult = await developersQuery.refetch({ includeArchived: true });
      const authoritativeDevelopers = developerResult.data?.affiliateBusinessDevelopers ?? [];
      workspace.replaceAffiliateBusinessDevelopers(authoritativeDevelopers);
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!sheet) throw new Error(t("ecommerce.affiliateTeam.emptySpreadsheet"));
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const activeDevelopersByName = new Map(
        authoritativeDevelopers
          .filter((developer) => !developer.archivedAt)
          .map((developer) => [developer.normalizedDisplayName, developer]),
      );
      const seen = new Set<string>();
      const parsed = rawRows.map((raw, index): ProtectionPreviewRow => {
        const row = normalizeSpreadsheetRow(raw);
        const creatorOpenId = null;
        const username = cleanCell(row.creator_username ?? row.username);
        const developerName = cleanCell(
          row.bd_name ?? row.business_developer_name ?? row.business_developer ?? row.bd,
        );
        const normalizedDeveloperName = developerName
          ? normalizeAffiliateBusinessDeveloperName(developerName)
          : "";
        const developer = normalizedDeveloperName
          ? activeDevelopersByName.get(normalizedDeveloperName)
          : null;
        const key = username ? `username:${username.toLowerCase()}` : "";
        let error: string | null = null;
        if (!key) error = t("ecommerce.affiliateTeam.missingCreatorIdentity");
        else if (seen.has(key)) error = t("ecommerce.affiliateTeam.duplicateCreator");
        if (key) seen.add(key);
        return {
          rowNumber: index + 2,
          platform: GQL.ShopPlatform.TiktokShop,
          creatorOpenId,
          username,
          businessDeveloperId: developer?.id ?? null,
          businessDeveloperName: developerName,
          note: null,
          error,
        };
      });
      const groups: BusinessDeveloperResolutionGroup[] =
        buildAffiliateProtectionDeveloperResolutionSeeds(parsed, authoritativeDevelopers)
        .map((seed) => ({
          ...seed,
          resolution: seed.defaultResolution,
          mappedDeveloperId: "",
          mapSearch: "",
          error: null,
        }));
      const operationId = globalThis.crypto?.randomUUID?.() ?? `import-${Date.now()}`;
      setProtectionRows(parsed);
      setProtectionImportOperationId(operationId);
      setDeveloperProvisionRevision(0);
      setDeveloperResolutionGroups(groups);
      setProtectionPreviewPage(0);
      setProtectionImportView("RESOLVE");
      setProtectionImportPhase("AWAITING_CONFIRMATION");
    } catch (error) {
      setProtectionImportPhase("IDLE");
      setProtectionImportFileName("");
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function handleProtectionFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void processProtectionFile(file);
  }

  function handleProtectionDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setProtectionDragActive(false);
    if (protectionImportBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void processProtectionFile(file);
  }

  function addManualProtection() {
    const identity = manualCreator.trim().replace(/^@/, "");
    if (!identity) {
      showToast(t("ecommerce.affiliateTeam.missingCreatorIdentity"), "error");
      return;
    }
    const duplicate = protectionRows.some((row) => (
      row.username?.toLowerCase() === identity.toLowerCase()
    ));
    if (duplicate) {
      showToast(t("ecommerce.affiliateTeam.duplicateCreator"), "error");
      return;
    }
    const developer = manualDeveloperId === UNASSIGNED_ID ? null : workspace.getBusinessDeveloper(manualDeveloperId);
    setProtectionRows((rows) => [...rows, {
      rowNumber: rows.reduce((highest, row) => Math.max(highest, row.rowNumber), 1) + 1,
      platform: GQL.ShopPlatform.TiktokShop,
      creatorOpenId: null,
      username: identity,
      businessDeveloperId: developer?.id ?? null,
      businessDeveloperName: developer?.displayName ?? null,
      note: manualNote.trim() || null,
      error: null,
    }]);
    setManualCreator("");
    setManualNote("");
    setProtectionImportFileName("");
    setProtectionImportView("PREVIEW");
    setProtectionPreviewPage(0);
  }

  function updateDeveloperResolutionGroup(
    clientKey: string,
    patch: Partial<BusinessDeveloperResolutionGroup>,
  ) {
    setDeveloperResolutionGroups((groups) => groups.map((group) => (
      group.clientKey === clientKey
        ? { ...group, ...patch, error: patch.error ?? null }
        : group
    )));
  }

  async function confirmDeveloperResolutions() {
    const unresolved = developerResolutionGroups.some((group) => (
      !group.resolution ||
      (group.resolution === "MAP" && !group.mappedDeveloperId)
    ));
    if (unresolved || !protectionImportOperationId) return;
    if (developerResolutionGroups.length === 0) {
      setProtectionImportView("PREVIEW");
      setProtectionPreviewPage(0);
      setProtectionImportPhase("IDLE");
      return;
    }

    const provisionTargets = new Map<string, {
      clientKey: string;
      displayName: string;
      action: GQL.AffiliateBusinessDeveloperProvisionAction;
      groupKeys: string[];
    }>();
    const targetKeyByGroup = new Map<string, string>();
    for (const group of developerResolutionGroups) {
      if (group.resolution !== "CREATE" && group.resolution !== "RESTORE") continue;
      const normalizedTargetName = normalizeAffiliateBusinessDeveloperName(group.proposedName);
      const existing = provisionTargets.get(normalizedTargetName);
      const action = group.resolution === "RESTORE"
        ? GQL.AffiliateBusinessDeveloperProvisionAction.RestoreArchived
        : GQL.AffiliateBusinessDeveloperProvisionAction.CreateIfMissing;
      if (existing && existing.action !== action) {
        updateDeveloperResolutionGroup(group.clientKey, {
          error: t("ecommerce.affiliateTeam.conflictingDeveloperResolution"),
        });
        return;
      }
      const target = existing ?? {
        clientKey: group.clientKey,
        displayName: group.proposedName,
        action,
        groupKeys: [],
      };
      target.groupKeys.push(group.clientKey);
      provisionTargets.set(normalizedTargetName, target);
      targetKeyByGroup.set(group.clientKey, target.clientKey);
    }

    setProtectionImportPhase("PROVISIONING_BDS");
    try {
      const targets = [...provisionTargets.values()];
      const provisionResults: GQL.AffiliateBusinessDeveloperProvisionResult[] = [];
      const operationBaseKey = developerProvisionRevision === 0
        ? `${protectionImportOperationId}:business-developers`
        : `${protectionImportOperationId}:business-developers:revision-${developerProvisionRevision}`;
      const targetBatches = buildAffiliateDeveloperProvisionBatches(targets);
      for (const [batchIndex, batch] of targetBatches.entries()) {
        const result = await ensureDevelopers({
          variables: {
            input: {
              idempotencyKey: targetBatches.length === 1
                ? operationBaseKey
                : `${operationBaseKey}:batch-${batchIndex + 1}`,
              entries: batch.map((target) => ({
                clientKey: target.clientKey,
                displayName: target.displayName,
                action: target.action,
              })),
            },
          },
        });
        const payload = result.data?.ensureAffiliateBusinessDevelopers;
        if (!payload?.completed) throw new Error(t("ecommerce.updateFailed"));
        provisionResults.push(...payload.results);
      }
      const provisionResultByKey = new Map(
        provisionResults.map((item) => [item.clientKey, item]),
      );
      const rejectedGroups = new Map<string, { message: string; errorCode: string | null }>();
      for (const target of targets) {
        const provisioned = provisionResultByKey.get(target.clientKey);
        if (!provisioned?.developer || provisioned.disposition === GQL.AffiliateBusinessDeveloperProvisionDisposition.Rejected) {
          const reason = provisioned?.errorMessage ?? t("ecommerce.updateFailed");
          target.groupKeys.forEach((groupKey) => rejectedGroups.set(groupKey, {
            message: reason,
            errorCode: provisioned?.errorCode ?? null,
          }));
        } else {
          workspace.upsertAffiliateBusinessDeveloper(provisioned.developer);
        }
      }
      if (rejectedGroups.size > 0) {
        setDeveloperResolutionGroups((groups) => groups.map((group) => {
          const rejection = rejectedGroups.get(group.clientKey);
          if (!rejection) return group;
          return {
            ...group,
            archivedDeveloperId: rejection.errorCode === "ARCHIVED_CONFLICT"
              ? group.archivedDeveloperId ?? "archived-conflict"
              : group.archivedDeveloperId,
            resolution: rejection.errorCode === "ARCHIVED_CONFLICT" ? "" : group.resolution,
            error: rejection.message,
          };
        }));
        setDeveloperProvisionRevision((revision) => revision + 1);
        setProtectionImportPhase("AWAITING_CONFIRMATION");
        return;
      }

      const groupBySourceName = new Map(
        developerResolutionGroups.map((group) => [group.normalizedSourceName, group]),
      );
      const resolvedRows = protectionRows.map((row): ProtectionPreviewRow => {
        if (!row.businessDeveloperName || row.businessDeveloperId || row.error) return row;
        const group = groupBySourceName.get(
          normalizeAffiliateBusinessDeveloperName(row.businessDeveloperName),
        );
        if (!group) return row;
        if (group.resolution === "EXCLUDE") {
          return { ...row, excluded: true, businessDeveloperId: null };
        }
        if (group.resolution === "UNASSIGNED") {
          return {
            ...row,
            businessDeveloperId: null,
            businessDeveloperName: null,
          };
        }
        if (group.resolution === "MAP") {
          const mapped = activeDevelopers.find((developer) => developer.id === group.mappedDeveloperId);
          return {
            ...row,
            businessDeveloperId: group.mappedDeveloperId,
            businessDeveloperName: mapped?.displayName ?? row.businessDeveloperName,
          };
        }
        const targetKey = targetKeyByGroup.get(group.clientKey);
        const provisioned = targetKey ? provisionResultByKey.get(targetKey) : null;
        return {
          ...row,
          businessDeveloperId: provisioned?.developer?.id ?? null,
          businessDeveloperName: provisioned?.developer?.displayName ?? row.businessDeveloperName,
        };
      });
      setProtectionRows(resolvedRows);
      setProtectionImportView("PREVIEW");
      setProtectionPreviewPage(0);
      setProtectionImportPhase("IDLE");
      await Promise.all([developersQuery.refetch(), developerPageQuery.refetch()]);
    } catch (error) {
      setProtectionImportPhase("AWAITING_CONFIRMATION");
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function submitProtectionRows() {
    const operationId = protectionImportOperationId
      ?? globalThis.crypto?.randomUUID?.()
      ?? `import-${Date.now()}`;
    if (!protectionImportOperationId) setProtectionImportOperationId(operationId);
    await submitResolvedProtectionRows(protectionRows, operationId);
  }

  async function submitResolvedProtectionRows(rows: ProtectionPreviewRow[], importBatchId: string) {
    const validRows = rows.filter((row) => !row.error && !row.excluded);
    if (!validRows.length) return;
    const entries: GQL.ImportAffiliateCreatorProtectionEntryInput[] = validRows.map((row) => ({
      platform: row.platform,
      creatorOpenId: row.creatorOpenId,
      username: row.username,
      businessDeveloperId: row.businessDeveloperId,
      note: row.note,
    }));
    let batches: ReturnType<typeof buildAffiliateProtectionImportBatches>;
    try {
      batches = buildAffiliateProtectionImportBatches(entries, importBatchId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
      return;
    }
    const attemptedRowNumbers = new Set(validRows.map((row) => row.rowNumber));
    const completedRowNumbers = new Set<number>();
    const rejectedRows = new Map<number, string>();
    const invalidRowCount = rows.length - validRows.length;
    let importedCount = 0;
    let completedCount = 0;
    setProtectionImportPhase("IMPORTING_PROTECTIONS");
    setProtectionImportProgress({
      completed: 0,
      total: validRows.length,
      batch: 1,
      totalBatches: batches.length,
    });
    try {
      for (const [batchIndex, batch] of batches.entries()) {
        const controller = new AbortController();
        const timeout = window.setTimeout(
          () => controller.abort(),
          PROTECTION_IMPORT_BATCH_TIMEOUT_MS,
        );
        let result: Awaited<ReturnType<typeof importProtections>>;
        try {
          result = await importProtections({
            variables: {
              input: {
                importBatchId,
                entries: batch.entries,
              },
            },
            context: {
              fetchOptions: {
                signal: controller.signal,
              },
            },
          });
        } catch (error) {
          if (controller.signal.aborted) {
            throw new Error(t("ecommerce.affiliateTeam.protectionImportBatchTimeout", {
              batch: batchIndex + 1,
              total: batches.length,
            }));
          }
          throw error;
        } finally {
          window.clearTimeout(timeout);
        }
        const payload = result.data?.importAffiliateCreatorProtections;
        if (!payload) throw new Error(t("ecommerce.updateFailed"));
        importedCount += payload.createdCount + payload.updatedCount;
        for (const rejected of payload.rejectedRows) {
          const sourceRow = validRows[batch.startIndex + rejected.index];
          if (sourceRow) rejectedRows.set(sourceRow.rowNumber, rejected.reason);
        }
        for (let index = 0; index < batch.entries.length; index += 1) {
          const sourceRow = validRows[batch.startIndex + index];
          if (sourceRow && !rejectedRows.has(sourceRow.rowNumber)) {
            completedRowNumbers.add(sourceRow.rowNumber);
          }
        }
        completedCount += batch.entries.length;
        setProtectionImportProgress({
          completed: completedCount,
          total: validRows.length,
          batch: Math.min(batchIndex + 2, batches.length),
          totalBatches: batches.length,
        });
      }
      setProtectionRows((currentRows) => currentRows.flatMap((row) => {
        if (!attemptedRowNumbers.has(row.rowNumber)) return [row];
        const rejection = rejectedRows.get(row.rowNumber);
        return rejection ? [{ ...row, error: rejection }] : [];
      }));
      await protectionQuery.refetch();
      showToast(
        t("ecommerce.affiliateTeam.protectionsImported", { count: importedCount }),
        rejectedRows.size > 0 || invalidRowCount > 0 ? "warning" : "success",
      );
      setProtectionImportPhase("COMPLETED");
      if (rejectedRows.size === 0 && invalidRowCount === 0) {
        setProtectionImportOpen(false);
        resetProtectionImportDraft();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : t("ecommerce.updateFailed");
      setProtectionRows((currentRows) => currentRows.flatMap((row) => {
        if (completedRowNumbers.has(row.rowNumber)) return [];
        const rejection = rejectedRows.get(row.rowNumber);
        return rejection ? [{ ...row, error: rejection }] : [row];
      }));
      showToast(
        completedCount > 0
          ? t("ecommerce.affiliateTeam.protectionImportPartialFailure", {
            completed: completedCount,
            total: validRows.length,
            reason,
          })
          : reason,
        "error",
      );
      setProtectionImportPhase("PARTIAL_FAILED");
    } finally {
      setProtectionImportProgress(null);
    }
  }

  async function removePersistedProtection(protection: GQL.AffiliateCreatorProtection) {
    const creator = protection.username ? `@${protection.username}` : protection.creatorOpenId ?? protection.id;
    if (!window.confirm(t("ecommerce.affiliateTeam.removeProtectionConfirm", {
      creator,
      defaultValue: `Remove protection for ${creator}? Existing work may become eligible for AI immediately.`,
    }))) return;
    try {
      await removeProtection({ variables: { id: protection.id } });
      await protectionQuery.refetch();
      showToast(t("ecommerce.affiliateTeam.protectionRemoved", { defaultValue: "Protection removed" }), "success");
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
      showToast(t("ecommerce.affiliateTeam.onboardingCompleted"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([[...PROTECTED_CREATOR_TEMPLATE_HEADERS]]);
    worksheet["!cols"] = [
      { wch: 28 },
      { wch: 32 },
    ];
    worksheet["!autofilter"] = { ref: "A1:B1" };
    const instructions = XLSX.utils.aoa_to_sheet([
      [
        t("ecommerce.affiliateTeam.templateField"),
        t("ecommerce.affiliateTeam.templateRequirement"),
        t("ecommerce.affiliateTeam.templateInstructions"),
      ],
      ["creator_username", t("ecommerce.affiliateTeam.templateRequired"), t("ecommerce.affiliateTeam.templateIdentityHint")],
      ["bd_name", t("ecommerce.affiliateTeam.templateOptional"), t("ecommerce.affiliateTeam.templateDeveloperHint")],
    ]);
    instructions["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 76 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Protected creators");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
    XLSX.writeFile(workbook, "affiliate-protected-creators.xlsx");
  }

  function removeProtectionRow(rowNumber: number) {
    setProtectionRows((rows) => rows.filter((row) => row.rowNumber !== rowNumber));
    const remainingGroups = developerResolutionGroups
      .map((group) => ({
        ...group,
        rowNumbers: group.rowNumbers.filter((candidate) => candidate !== rowNumber),
      }))
      .filter((group) => group.rowNumbers.length > 0);
    setDeveloperResolutionGroups(remainingGroups);
    if (protectionImportPhase === "AWAITING_CONFIRMATION" && remainingGroups.length === 0) {
      setProtectionImportPhase("IDLE");
      setProtectionImportView("PREVIEW");
    }
  }

  function selectPageTab(nextTab: TeamPageTab, focusTab = false) {
    if (nextTab !== pageTab) {
      const params = new URLSearchParams(window.location.search);
      params.set("view", nextTab === "ASSIGNMENTS" ? "assignments" : nextTab === "SAFETY" ? "safety" : "team");
      const search = params.toString();
      window.history.pushState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
      setPageTab(nextTab);
    }
    if (focusTab) {
      window.requestAnimationFrame(() => {
        document.getElementById(`affiliate-team-tab-${nextTab.toLowerCase()}`)?.focus();
      });
    }
  }

  const pageTabs: Array<{
    id: TeamPageTab;
    label: string;
    summary: string;
    icon: ReactNode;
    iconClassName?: string;
  }> = [
    {
      id: "TEAM",
      label: t("ecommerce.affiliateTeam.teamOperationsTab"),
      summary: `${t("ecommerce.affiliateTeam.ownerCount", { count: activeDevelopers.length })} · ${t("ecommerce.affiliateTeam.ownerChannelCount", { count: totalChannelCount })}`,
      icon: <UserIcon />,
    },
    {
      id: "ASSIGNMENTS",
      label: t("ecommerce.affiliateTeam.creatorAssignmentsTab"),
      summary: `${t("ecommerce.affiliateTeam.protectedCreators")} ${protectedCreatorCount} · ${t("ecommerce.affiliateTeam.appliedProtections", { count: appliedProtectionCount })}`,
      icon: <UserPlusIcon />,
    },
    {
      id: "SAFETY",
      label: t("ecommerce.affiliateTeam.safetyAndApprovalTab"),
      summary: t(onboardingComplete ? "ecommerce.affiliateTeam.setupReady" : "ecommerce.affiliateTeam.setupRequired"),
      icon: onboardingComplete ? <CheckIcon /> : <InfoIcon />,
      iconClassName: onboardingComplete ? "is-ready" : "needs-setup",
    },
  ];

  return (
    <div className="page-enter affiliate-team-page">
      <header className="affiliate-team-header" data-tutorial-id="affiliate-team-header">
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
          {pageTab === "TEAM" && <button className="btn btn-primary" type="button" onClick={beginCreateDeveloper}>
            <UserPlusIcon /> {t("ecommerce.affiliateTeam.addDeveloper")}
          </button>}
        </div>
      </header>

      <div
        className="affiliate-team-page-tabs"
        role="tablist"
        aria-label={t("ecommerce.affiliateTeam.pageTabsLabel")}
        data-tutorial-id="affiliate-team-tabs"
      >
        {pageTabs.map((tab, index) => (
          <button
            id={`affiliate-team-tab-${tab.id.toLowerCase()}`}
            data-tutorial-id={`affiliate-team-tab-${tab.id.toLowerCase()}`}
            className={`affiliate-team-page-tab ${pageTab === tab.id ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={pageTab === tab.id}
            aria-controls={`affiliate-team-panel-${tab.id.toLowerCase()}`}
            tabIndex={pageTab === tab.id ? 0 : -1}
            onClick={() => selectPageTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const direction = event.key === "ArrowRight" ? 1 : -1;
                const nextIndex = (index + direction + pageTabs.length) % pageTabs.length;
                selectPageTab(pageTabs[nextIndex]!.id, true);
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                selectPageTab(pageTabs[event.key === "Home" ? 0 : pageTabs.length - 1]!.id, true);
              }
            }}
          >
            <span className={`affiliate-team-page-tab-icon ${tab.iconClassName ?? ""}`}>{tab.icon}</span>
            <span className="affiliate-team-page-tab-copy">
              <strong>{tab.label}</strong>
              <small>{tab.summary}</small>
            </span>
          </button>
        ))}
      </div>

      <div
        id="affiliate-team-panel-team"
        className="affiliate-team-page-tab-panel"
        role="tabpanel"
        aria-labelledby="affiliate-team-tab-team"
        hidden={pageTab !== "TEAM"}
      >
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

      <section className="affiliate-team-responsibility" data-tutorial-id="affiliate-team-responsibilities">
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
                                <strong>
                                  {developer.displayName}
                                  {developer.profileStatus === GQL.AffiliateBusinessDeveloperProfileStatus.NeedsConfiguration && (
                                    <span className="affiliate-bd-profile-status">
                                      {t("ecommerce.affiliateTeam.profileNeedsConfiguration")}
                                    </span>
                                  )}
                                </strong>
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

      </div>

      <div
        id="affiliate-team-panel-assignments"
        className="affiliate-team-page-tab-panel is-assignments"
        role="tabpanel"
        aria-labelledby="affiliate-team-tab-assignments"
        hidden={pageTab !== "ASSIGNMENTS"}
      >
      <section className="affiliate-protection-boundary">
        <div className="affiliate-protection-boundary-head" data-tutorial-id="affiliate-team-assignments">
          <div className="affiliate-protection-boundary-title">
            <span className="affiliate-protection-boundary-icon"><InfoIcon /></span>
            <div>
              <span>{t("ecommerce.affiliateTeam.protectionBoundary")}</span>
              <h2>{t("ecommerce.affiliateTeam.onboardingTitle")}</h2>
              <p>{t(onboardingComplete ? "ecommerce.affiliateTeam.protectionBoundaryReady" : "ecommerce.affiliateTeam.onboardingHint")}</p>
            </div>
          </div>
          <div className="affiliate-protection-boundary-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={openProtectionImport} disabled={protectionImportBusy}>
              <UserPlusIcon /> {t("ecommerce.affiliateTeam.importProtected")}
            </button>
          </div>
        </div>

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
        <div className="affiliate-protection-directory">
          <div className="affiliate-protection-directory-head">
            <div>
              <strong>{t("ecommerce.affiliateTeam.protectedCreators")}</strong>
              <span>{t("ecommerce.affiliateTeam.protectionDirectorySummary", {
                resolved: protectionData?.resolvedCount ?? 0,
                unresolved: protectionData?.unresolvedCount ?? 0,
                defaultValue: `${protectionData?.resolvedCount ?? 0} matched · ${protectionData?.unresolvedCount ?? 0} waiting for identity`,
              })}</span>
            </div>
            <div className="affiliate-protection-directory-filters">
              <input
                value={protectionSearch}
                onChange={(event) => setProtectionSearch(event.target.value)}
                placeholder={t("ecommerce.affiliateTeam.searchProtectedCreators", { defaultValue: "Search username or OpenID" })}
              />
              <Select
                value={protectionDeveloperId}
                onChange={setProtectionDeveloperId}
                options={[
                  { value: "", label: t("ecommerce.affiliateTeam.allDevelopers", { defaultValue: "All BD" }) },
                  ...activeDevelopers.map((developer) => ({ value: developer.id, label: developer.displayName })),
                ]}
              />
              <Select
                value={protectionResolution}
                onChange={(value) => setProtectionResolution(value as "" | GQL.AffiliateCreatorProtectionResolution)}
                options={[
                  { value: "", label: t("common.all", { defaultValue: "All" }) },
                  { value: GQL.AffiliateCreatorProtectionResolution.Resolved, label: t("ecommerce.affiliateTeam.protectionResolved", { defaultValue: "Matched Creator" }) },
                  { value: GQL.AffiliateCreatorProtectionResolution.Unresolved, label: t("ecommerce.affiliateTeam.protectionUnresolved", { defaultValue: "Waiting for Creator identity" }) },
                ]}
              />
            </div>
          </div>
          <div className="affiliate-protection-directory-counts">
            {(protectionData?.businessDeveloperCounts ?? []).map((entry) => (
              <span key={entry.businessDeveloperId ?? UNASSIGNED_ID}>
                {entry.businessDeveloperId
                  ? workspace.getBusinessDeveloper(entry.businessDeveloperId)?.displayName ?? entry.businessDeveloperId
                  : t("ecommerce.affiliateTeam.protectedOnly")}: {entry.count}
              </span>
            ))}
          </div>
          <div className="affiliate-protection-directory-table">
            <div className="affiliate-protection-directory-table-head" aria-hidden="true">
              <span>{t("ecommerce.affiliateTeam.creatorIdentity")}</span>
              <span>{t("ecommerce.affiliateTeam.businessDeveloper")}</span>
              <span>{t("ecommerce.affiliateTeam.note")}</span>
              <span>{t("ecommerce.affiliateTeam.protectionUpdatedAt", { defaultValue: "Updated" })}</span>
              <span className="sr-only">{t("common.actions", { defaultValue: "Actions" })}</span>
            </div>
            <div className="affiliate-protection-directory-list">
              {(protectionData?.items ?? []).map((protection) => {
                const developer = protection.businessDeveloperId
                  ? workspace.getBusinessDeveloper(protection.businessDeveloperId)
                  : null;
                return (
                  <div className="affiliate-protection-directory-row" key={protection.id}>
                    <div className="affiliate-protection-directory-creator">
                      <strong>{protection.username ? `@${protection.username}` : protection.creatorOpenId ?? protection.id}</strong>
                      <span className={`affiliate-protection-directory-status ${protection.creatorId ? "is-resolved" : "is-unresolved"}`}>
                        {protection.creatorId
                          ? t("ecommerce.affiliateTeam.protectionResolved", { defaultValue: "Matched Creator" })
                          : t("ecommerce.affiliateTeam.protectionUnresolved", { defaultValue: "Waiting for Creator identity" })}
                      </span>
                    </div>
                    <div className="affiliate-protection-directory-owner">
                      <strong>{developer?.displayName ?? t("ecommerce.affiliateTeam.protectedOnly")}</strong>
                      <span>{protection.source}</span>
                    </div>
                    <span className="affiliate-protection-directory-note">{protection.note || "—"}</span>
                    <span className="affiliate-protection-directory-date">{new Date(protection.updatedAt).toLocaleDateString()}</span>
                    <button
                      className="btn btn-secondary btn-sm affiliate-protection-directory-action"
                      type="button"
                      disabled={removeProtectionState.loading}
                      onClick={() => void removePersistedProtection(protection)}
                    >
                      {t("ecommerce.affiliateTeam.removeProtection", { defaultValue: "Remove protection" })}
                    </button>
                  </div>
                );
              })}
              {!protectionQuery.loading && (protectionData?.items.length ?? 0) === 0 && (
                <div className="affiliate-empty-state compact">
                  <p>{t("ecommerce.affiliateTeam.noProtectedCreators", { defaultValue: "No protected Creators match this search." })}</p>
                </div>
              )}
            </div>
          </div>
          {protectionTotalPages > 1 && (
            <div className="affiliate-pagination">
              <button className="btn btn-secondary btn-sm" type="button" disabled={protectionPage === 0} onClick={() => setProtectionPage((page) => Math.max(0, page - 1))}>‹</button>
              <span>{protectionPage + 1} / {protectionTotalPages}</span>
              <button className="btn btn-secondary btn-sm" type="button" disabled={protectionPage + 1 >= protectionTotalPages} onClick={() => setProtectionPage((page) => page + 1)}>›</button>
            </div>
          )}
        </div>
      </section>

      </div>

      <div
        id="affiliate-team-panel-safety"
        className="affiliate-team-page-tab-panel is-safety"
        role="tabpanel"
        aria-labelledby="affiliate-team-tab-safety"
        hidden={pageTab !== "SAFETY"}
      >
      <section className="affiliate-team-policy-section is-open">
        <div className="affiliate-team-policy-heading" data-tutorial-id="affiliate-team-safety">
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
          <div className="affiliate-team-policy-heading-aside">
            <p>
              {t("ecommerce.affiliateTeam.globalApprovalPoliciesHint", {
                defaultValue:
                  "Applies to every Affiliate shop under this seller account. SEND_MESSAGE rules review the exact draft before provider delivery.",
              })}
            </p>
          </div>
        </div>
        <div className="affiliate-team-policy-content"><AffiliateApprovalPolicyPanel /></div>
      </section>
      </div>

      <Modal
        isOpen={protectionImportOpen}
        onClose={closeProtectionImport}
        title={t("ecommerce.affiliateTeam.protectionImportModalTitle")}
        maxWidth={1080}
        className="affiliate-protection-import-modal"
        closeLabel={t("common.close")}
        preventBackdropClose={protectionImportBusy}
        portal
      >
        <div className="affiliate-protection-import-steps" aria-label={t("ecommerce.affiliateTeam.protectionImportSteps")}>
          {([
            ["ADD", t("ecommerce.affiliateTeam.protectionImportStepAdd")],
            ["RESOLVE", t("ecommerce.affiliateTeam.protectionImportStepResolve")],
            ["PREVIEW", t("ecommerce.affiliateTeam.protectionImportStepReview")],
          ] as const).map(([view, label], index) => {
            const currentIndex = protectionImportView === "ADD" ? 0 : protectionImportView === "RESOLVE" ? 1 : 2;
            const completed = index < currentIndex;
            return (
              <div
                className={`affiliate-protection-import-step ${view === protectionImportView ? "is-active" : ""} ${completed ? "is-complete" : ""}`}
                key={view}
              >
                <span>{completed ? <CheckIcon /> : index + 1}</span>
                <strong>{label}</strong>
              </div>
            );
          })}
        </div>

        {protectionImportView === "ADD" && (
          <div className="affiliate-protection-import-body is-add">
            <div className="affiliate-protection-import-mode" role="tablist" aria-label={t("ecommerce.affiliateTeam.protectionImportMethod")}>
              <button
                type="button"
                role="tab"
                aria-selected={protectionComposerMode === "FILE"}
                className={protectionComposerMode === "FILE" ? "is-active" : ""}
                onClick={() => setProtectionComposerMode("FILE")}
              >
                <DownloadIcon />
                {t("ecommerce.affiliateTeam.protectionImportExcelTab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={protectionComposerMode === "MANUAL"}
                className={protectionComposerMode === "MANUAL" ? "is-active" : ""}
                onClick={() => setProtectionComposerMode("MANUAL")}
              >
                <UserPlusIcon />
                {t("ecommerce.affiliateTeam.protectionImportManualTab")}
              </button>
            </div>

            {protectionComposerMode === "FILE" ? (
              <>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleProtectionFile} />
                <div className="affiliate-protection-template-card">
                  <span className="affiliate-protection-template-card-icon"><DownloadIcon /></span>
                  <div>
                    <strong>{t("ecommerce.affiliateTeam.protectionTemplateTitle")}</strong>
                    <p>{t("ecommerce.affiliateTeam.protectionTemplateHint")}</p>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => void downloadTemplate()} disabled={protectionImportBusy}>
                    <DownloadIcon /> {t("ecommerce.affiliateTeam.downloadTemplate")}
                  </button>
                </div>
                <div
                  className={`affiliate-protection-dropzone ${protectionDragActive ? "is-dragging" : ""} ${protectionImportPhase === "PARSING" ? "is-busy" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!protectionImportBusy) setProtectionDragActive(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setProtectionDragActive(false);
                    }
                  }}
                  onDrop={handleProtectionDrop}
                >
                  <span className="affiliate-protection-dropzone-icon"><DownloadIcon /></span>
                  <div>
                    <h3>{protectionImportPhase === "PARSING"
                      ? t("ecommerce.affiliateTeam.protectionImportParsing")
                      : t("ecommerce.affiliateTeam.protectionImportDropTitle")}</h3>
                    <p>{t("ecommerce.affiliateTeam.protectionImportDropHint")}</p>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={protectionImportBusy}>
                    {t("ecommerce.affiliateTeam.protectionImportChooseFile")}
                  </button>
                  <small>.xlsx · .xls · .csv</small>
                </div>
              </>
            ) : (
              <div className="affiliate-protection-manual-card">
                <div>
                  <h3>{t("ecommerce.affiliateTeam.addProtectionEntries")}</h3>
                  <p>{t("ecommerce.affiliateTeam.protectionEntryHint")}</p>
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
                </div>
                <div className="affiliate-protection-manual-actions">
                  <button className="btn btn-primary" type="button" onClick={addManualProtection}>
                    <UserPlusIcon /> {t("ecommerce.affiliateTeam.addProtectedCreator")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {protectionImportView === "RESOLVE" && (
          <div className="affiliate-protection-import-body is-resolve">
            <div className="affiliate-protection-developer-intro">
              <span className="affiliate-protection-developer-intro-icon"><UserPlusIcon /></span>
              <div>
                <strong>{developerResolutionGroups.length > 0
                  ? t("ecommerce.affiliateTeam.resolveDeveloperSummary", {
                    count: developerResolutionGroups.length,
                  })
                  : t("ecommerce.affiliateTeam.confirmMatchedDevelopersTitle")}</strong>
                <p>{developerResolutionGroups.length > 0
                  ? t("ecommerce.affiliateTeam.resolveDeveloperHint")
                  : t("ecommerce.affiliateTeam.confirmMatchedDevelopersHint")}</p>
              </div>
            </div>

            <div className="affiliate-protection-confirmation-summary">
              <div>
                <span>{t("ecommerce.affiliateTeam.protectionPreviewAssigned")}</span>
                <strong>{protectionAssignmentSummary.assignedRowCount}</strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateTeam.protectionPreviewOnly")}</span>
                <strong>{protectionAssignmentSummary.protectionOnlyRowCount}</strong>
              </div>
              <div className={protectionAssignmentSummary.attentionRowCount > 0 ? "has-attention" : ""}>
                <span>{t("ecommerce.affiliateTeam.protectionPreviewAttention")}</span>
                <strong>{protectionAssignmentSummary.attentionRowCount}</strong>
              </div>
            </div>

            {protectionAssignmentSummary.assigned.length > 0 && (
              <section className="affiliate-protection-matched-developers">
                <div className="affiliate-protection-matched-developers-head">
                  <div>
                    <strong>{t("ecommerce.affiliateTeam.matchedDevelopers")}</strong>
                    <span>{t("ecommerce.affiliateTeam.matchedDevelopersHint")}</span>
                  </div>
                  <span>{t("ecommerce.affiliateTeam.matchedDeveloperCount", {
                    count: protectionAssignmentSummary.assigned.length,
                  })}</span>
                </div>
                <div className="affiliate-protection-matched-developer-list">
                  {protectionAssignmentSummary.assigned.map((assignment) => (
                    <div key={assignment.businessDeveloperId}>
                      <span className="affiliate-protection-matched-avatar">
                        {assignment.businessDeveloperName.slice(0, 1).toLocaleUpperCase()}
                      </span>
                      <strong>{assignment.businessDeveloperName}</strong>
                      <span>{t("ecommerce.affiliateTeam.affectedCreatorRows", {
                        count: assignment.rowCount,
                      })}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {developerResolutionGroups.length > 0 && <div className="affiliate-protection-developer-list">
              {developerResolutionGroups.map((group) => {
                const mappingOptions = activeDevelopers.filter((developer) => (
                  !group.mapSearch ||
                  developer.displayName.toLocaleLowerCase().includes(group.mapSearch.toLocaleLowerCase())
                ));
                return (
                  <section
                    className={`affiliate-protection-developer-card ${group.error ? "has-error" : ""}`}
                    key={group.clientKey}
                  >
                    <div className="affiliate-protection-developer-card-head">
                      <div>
                        <span>{group.archivedDeveloperId
                          ? t("ecommerce.affiliateTeam.archivedDeveloperFound")
                          : t("ecommerce.affiliateTeam.missingDeveloperFound")}</span>
                        <strong>{group.sourceName}</strong>
                      </div>
                      <span>{t("ecommerce.affiliateTeam.affectedCreatorRows", {
                        count: group.rowNumbers.length,
                      })}</span>
                    </div>

                    <label className="affiliate-protection-developer-action">
                      <span>{t("ecommerce.affiliateTeam.importDecision")}</span>
                      <select
                        value={group.resolution}
                        onChange={(event) => updateDeveloperResolutionGroup(group.clientKey, {
                          resolution: event.target.value as BusinessDeveloperResolution,
                          mappedDeveloperId: "",
                          mapSearch: "",
                        })}
                        disabled={ensureDevelopersState.loading}
                      >
                        <option value="">{t("ecommerce.affiliateTeam.chooseImportDecision")}</option>
                        {!group.archivedDeveloperId && (
                          <option value="CREATE">{t("ecommerce.affiliateTeam.createDeveloper")}</option>
                        )}
                        {group.archivedDeveloperId && (
                          <option value="RESTORE">{t("ecommerce.affiliateTeam.restoreDeveloper")}</option>
                        )}
                        <option value="MAP">{t("ecommerce.affiliateTeam.mapDeveloper")}</option>
                        <option value="UNASSIGNED">{t("ecommerce.affiliateTeam.importProtectionOnly")}</option>
                        <option value="EXCLUDE">{t("ecommerce.affiliateTeam.excludeAffectedRows")}</option>
                      </select>
                    </label>

                    {group.resolution === "CREATE" && (
                      <label className="affiliate-protection-developer-name">
                        <span>{t("ecommerce.affiliateTeam.newDeveloperName")}</span>
                        <input
                          value={group.proposedName}
                          onChange={(event) => updateDeveloperResolutionGroup(group.clientKey, {
                            proposedName: event.target.value,
                          })}
                          disabled={ensureDevelopersState.loading}
                        />
                        <small>{t("ecommerce.affiliateTeam.safeDeveloperDefaults")}</small>
                      </label>
                    )}

                    {group.resolution === "RESTORE" && (
                      <div className="affiliate-protection-developer-safety-note">
                        <InfoIcon />
                        <span>{t("ecommerce.affiliateTeam.restoreDeveloperSafety")}</span>
                      </div>
                    )}

                    {group.resolution === "MAP" && (
                      <div className="affiliate-protection-developer-map">
                        <label>
                          <span>{t("ecommerce.affiliateTeam.searchExistingDeveloper")}</span>
                          <input
                            type="search"
                            value={group.mapSearch}
                            onChange={(event) => updateDeveloperResolutionGroup(group.clientKey, {
                              mapSearch: event.target.value,
                            })}
                            placeholder={t("ecommerce.affiliateTeam.ownerSearchPlaceholder")}
                            disabled={ensureDevelopersState.loading}
                          />
                        </label>
                        <select
                          value={group.mappedDeveloperId}
                          onChange={(event) => updateDeveloperResolutionGroup(group.clientKey, {
                            mappedDeveloperId: event.target.value,
                          })}
                          disabled={ensureDevelopersState.loading}
                        >
                          <option value="">{t("ecommerce.affiliateTeam.selectExistingDeveloper")}</option>
                          {mappingOptions.map((developer) => (
                            <option value={developer.id} key={developer.id}>{developer.displayName}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {group.error && <p className="affiliate-protection-developer-error">{group.error}</p>}
                  </section>
                );
              })}
            </div>}

            <div className="affiliate-protection-developer-footer">
              <div>
                <strong>{developerResolutionGroups.length > 0
                  ? t("ecommerce.affiliateTeam.importDecisionSummary", {
                    create: developerResolutionGroups.filter((group) => group.resolution === "CREATE").length,
                    restore: developerResolutionGroups.filter((group) => group.resolution === "RESTORE").length,
                    unassigned: developerResolutionGroups.filter((group) => group.resolution === "UNASSIGNED").length,
                  })
                  : t("ecommerce.affiliateTeam.confirmedAssignmentSummary", {
                    assigned: protectionAssignmentSummary.assignedRowCount,
                    unassigned: protectionAssignmentSummary.protectionOnlyRowCount,
                  })}</strong>
                <span>{developerResolutionGroups.length > 0
                  ? t("ecommerce.affiliateTeam.noSilentSkip")
                  : t("ecommerce.affiliateTeam.confirmationRequiredBeforeImport")}</span>
              </div>
              <div>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setProtectionImportView("ADD")}
                  disabled={ensureDevelopersState.loading}
                >
                  {t("common.back", { defaultValue: "Back" })}
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => void confirmDeveloperResolutions()}
                  disabled={
                    ensureDevelopersState.loading ||
                    developerResolutionGroups.some((group) => (
                      !group.resolution ||
                      (group.resolution === "MAP" && !group.mappedDeveloperId) ||
                      (group.resolution === "CREATE" && !group.proposedName.trim())
                    ))
                  }
                >
                  {ensureDevelopersState.loading
                    ? t("ecommerce.affiliateTeam.provisioningDevelopers")
                    : developerResolutionGroups.length > 0
                      ? t("ecommerce.affiliateTeam.resolveAndReview")
                      : t("ecommerce.affiliateTeam.confirmAssignmentsAndReview")}
                </button>
              </div>
            </div>
          </div>
        )}

        {protectionImportView === "PREVIEW" && (
          <div className="affiliate-protection-import-body is-preview">
            <div className="affiliate-protection-preview-toolbar">
              <div>
                <strong>{t("ecommerce.affiliateTeam.importPreview")}</strong>
                <span>{protectionImportFileName || t("ecommerce.affiliateTeam.protectionImportManualSource")}</span>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => {
                setProtectionComposerMode(protectionImportFileName ? "FILE" : "MANUAL");
                setProtectionImportView("ADD");
              }} disabled={protectionImportBusy}>
                {t("ecommerce.affiliateTeam.protectionImportContinueAdding")}
              </button>
            </div>

            <div className="affiliate-protection-preview-summary">
              <div><span>{t("ecommerce.affiliateTeam.protectionPreviewTotal")}</span><strong>{protectionRows.length}</strong></div>
              <div><span>{t("ecommerce.affiliateTeam.protectionPreviewAssigned")}</span><strong>{protectionPreviewCounts.ASSIGNED}</strong></div>
              <div><span>{t("ecommerce.affiliateTeam.protectionPreviewOnly")}</span><strong>{protectionPreviewCounts.PROTECTION_ONLY}</strong></div>
              <div className={protectionPreviewCounts.ERROR + protectionPreviewCounts.EXCLUDED + protectionPreviewCounts.NEEDS_DEVELOPER_DECISION > 0 ? "has-attention" : ""}>
                <span>{t("ecommerce.affiliateTeam.protectionPreviewAttention")}</span>
                <strong>{protectionPreviewCounts.ERROR + protectionPreviewCounts.EXCLUDED + protectionPreviewCounts.NEEDS_DEVELOPER_DECISION}</strong>
              </div>
            </div>

            <div className="affiliate-protection-preview-table">
              <div className="affiliate-protection-preview-table-head">
                <span>{t("ecommerce.affiliateTeam.protectionPreviewRow")}</span>
                <span>{t("ecommerce.affiliateTeam.creatorIdentity")}</span>
                <span>{t("ecommerce.affiliateTeam.assignDeveloper")}</span>
                <span>{t("ecommerce.affiliateTeam.protectionPreviewOutcome")}</span>
                <span />
              </div>
              <div className="affiliate-protection-preview-table-body">
                {visibleProtectionRows.map((row) => {
                  const disposition = classifyAffiliateProtectionPreviewRow(row);
                  const statusLabel = disposition === "ERROR"
                    ? row.error
                    : disposition === "EXCLUDED"
                      ? t("ecommerce.affiliateTeam.excludedFromImport")
                      : disposition === "NEEDS_DEVELOPER_DECISION"
                        ? t("ecommerce.affiliateTeam.protectionImportNeedsDecision")
                        : disposition === "ASSIGNED"
                          ? t("ecommerce.affiliateTeam.protectionImportAssigned", {
                            name: row.businessDeveloperName,
                          })
                          : t("ecommerce.affiliateTeam.protectionImportUnassigned");
                  return (
                    <div className="affiliate-protection-preview-table-row" key={row.rowNumber}>
                      <span>#{row.rowNumber}</span>
                      <strong>{row.username ? `@${row.username}` : row.creatorOpenId}</strong>
                      <span>{row.businessDeveloperName || "—"}</span>
                      <em className={`is-${disposition.toLowerCase().replaceAll("_", "-")}`}>{statusLabel}</em>
                      <button className="affiliate-protection-remove" type="button" onClick={() => removeProtectionRow(row.rowNumber)} title={t("ecommerce.affiliateTeam.removePreviewRow")} aria-label={t("ecommerce.affiliateTeam.removePreviewRow")} disabled={protectionImportBusy}><CloseIcon /></button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="affiliate-protection-preview-footer">
              <span>{t("ecommerce.affiliateTeam.protectionPreviewRange", {
                from: protectionRows.length === 0 ? 0 : protectionPreviewPage * PROTECTION_PREVIEW_PAGE_SIZE + 1,
                to: Math.min((protectionPreviewPage + 1) * PROTECTION_PREVIEW_PAGE_SIZE, protectionRows.length),
                total: protectionRows.length,
              })}</span>
              <div className="affiliate-pagination">
                <button className="btn btn-secondary btn-sm" type="button" disabled={protectionPreviewPage === 0} onClick={() => setProtectionPreviewPage((page) => Math.max(0, page - 1))}>‹</button>
                <span>{protectionPreviewPage + 1} / {protectionPreviewTotalPages}</span>
                <button className="btn btn-secondary btn-sm" type="button" disabled={protectionPreviewPage + 1 >= protectionPreviewTotalPages} onClick={() => setProtectionPreviewPage((page) => page + 1)}>›</button>
              </div>
            </div>

            {protectionImportProgress && (
              <div className="affiliate-protection-import-live-progress" aria-live="polite">
                <div>
                  <strong>{t("ecommerce.affiliateTeam.protectionImportBatchProgress", protectionImportProgress)}</strong>
                  <span>{Math.round(
                    (protectionImportProgress.completed / protectionImportProgress.total) * 100,
                  )}%</span>
                </div>
                <span>
                  <i style={{
                    width: `${Math.max(
                      2,
                      (protectionImportProgress.completed / protectionImportProgress.total) * 100,
                    )}%`,
                  }} />
                </span>
              </div>
            )}

            <div className="affiliate-protection-import-footer">
              <button className="btn btn-secondary" type="button" onClick={closeProtectionImport} disabled={protectionImportBusy}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={protectionImportPhase === "AWAITING_CONFIRMATION"
                  ? () => setProtectionImportView("RESOLVE")
                  : submitProtectionRows}
                disabled={
                  protectionImportBusy ||
                  protectionRows.every((row) => row.error || row.excluded)
                }
              >
                {protectionImportProgress
                  ? t("ecommerce.affiliateTeam.protectionImportBatchProgress", protectionImportProgress)
                  : protectionImportPhase === "AWAITING_CONFIRMATION"
                    ? t("ecommerce.affiliateTeam.resolveDevelopers")
                    : t("ecommerce.affiliateTeam.importValid", {
                      count: protectionRows.filter((row) => !row.error && !row.excluded).length,
                    })}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(detailDeveloper && detailSummary)}
        onClose={closeDeveloperDetail}
        title={detailDeveloper?.displayName ?? t("ecommerce.affiliateTeam.businessDeveloper")}
        maxWidth={1180}
        className="affiliate-bd-detail-modal"
        closeLabel={t("common.close")}
        preventBackdropClose={writeState.loading}
        portal
      >
        {detailDeveloper && detailSummary && <>
          <div className="affiliate-bd-command-header">
            <div className="affiliate-bd-command-identity">
              <span className="affiliate-bd-command-avatar"><UserIcon /><i aria-hidden="true" /></span>
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
                <p><GlobeIcon />{detailRegionLabel}</p>
              </div>
            </div>
            <div className="affiliate-bd-command-metrics">
              <div className="affiliate-bd-command-metric">
                <span>{t("ecommerce.affiliateTeam.managedCreators", { defaultValue: "Managed creators" })}</span>
                <strong>{detailSummary.creatorRelationshipCount}</strong>
              </div>
              <div className="affiliate-bd-command-metric">
                <span>{t("ecommerce.affiliateTeam.connectedChannels")}</span>
                <strong>{detailHealthyChannelCount}<small>/{detailChannelCount}</small></strong>
              </div>
            </div>
          </div>

          {detailDeveloper.profileStatus === GQL.AffiliateBusinessDeveloperProfileStatus.NeedsConfiguration && (
            <div className="affiliate-bd-profile-review-banner">
              <InfoIcon />
              <div>
                <strong>{t("ecommerce.affiliateTeam.profileNeedsConfiguration")}</strong>
                <span>{t("ecommerce.affiliateTeam.profileNeedsConfigurationHint")}</span>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setDetailTab("SETTINGS")}>
                {t("ecommerce.affiliateTeam.reviewDeveloperProfile")}
              </button>
            </div>
          )}

          <div className="affiliate-bd-detail-tabs" role="tablist" aria-label={t("ecommerce.affiliateTeam.detailTabsLabel")}>
            <button
              id="affiliate-bd-tab-channels"
              type="button"
              role="tab"
              aria-selected={detailTab === "CHANNELS"}
              aria-controls="affiliate-bd-panel-channels"
              className={`affiliate-bd-detail-tab ${detailTab === "CHANNELS" ? "is-active" : ""}`}
              onClick={() => setDetailTab("CHANNELS")}
            >
              <ChannelsIcon />
              <span>{t("ecommerce.affiliateTeam.channelsTab")}</span>
              <small>{detailChannelCount}</small>
            </button>
            <button
              id="affiliate-bd-tab-settings"
              type="button"
              role="tab"
              aria-selected={detailTab === "SETTINGS"}
              aria-controls="affiliate-bd-panel-settings"
              className={`affiliate-bd-detail-tab ${detailTab === "SETTINGS" ? "is-active" : ""}`}
              onClick={() => setDetailTab("SETTINGS")}
            >
              <UserIcon />
              <span>{t("ecommerce.affiliateTeam.settingsTab")}</span>
              {detailFormDirty && <i title={t("ecommerce.affiliateTeam.unsavedChanges")} aria-label={t("ecommerce.affiliateTeam.unsavedChanges")} />}
            </button>
          </div>

          <div className={`affiliate-bd-detail-scroll is-${detailTab.toLowerCase()}`}>
            {detailTab === "CHANNELS" && <section
              id="affiliate-bd-panel-channels"
              className="affiliate-bd-channel-command"
              role="tabpanel"
              aria-labelledby="affiliate-bd-tab-channels"
            >
              <div className="affiliate-bd-command-section-head">
                <div className="affiliate-bd-section-title">
                  <span className="affiliate-bd-section-icon"><ChannelsIcon /></span>
                  <div>
                    <strong>{t("ecommerce.affiliateTeam.channels")}</strong>
                    <span>{t("ecommerce.affiliateTeam.channelTransferHint")}</span>
                  </div>
                </div>
                <span>{detailSummary.whatsappAccountCount + detailSummary.emailAccountCount}</span>
              </div>
              <div className="affiliate-bd-channel-grid">
                <ChannelWorkspaceCard
                  channel="WHATSAPP"
                  accounts={detailWhatsapp}
                  preferredAccountId={detailDeveloper.preferredWhatsAppAccountBindingId ?? null}
                  onSetPreferred={handleSetPreferredAccount}
                  preferredBusy={preferredAccountState.loading}
                  onTransfer={beginAccountTransfer}
                  canConnect={!detailDeveloper.archivedAt}
                  connecting={connectChannel === "WHATSAPP"}
                  onConnect={() => {
                    setReconnectWhatsAppAccountId(null);
                    setConnectChannel((value) => value === "WHATSAPP" ? null : "WHATSAPP");
                  }}
                  onReconnect={(accountId) => {
                    setReconnectWhatsAppAccountId(accountId);
                    setConnectChannel("WHATSAPP");
                  }}
                  t={t}
                />
                <ChannelWorkspaceCard
                  channel="EMAIL"
                  accounts={detailEmail}
                  preferredAccountId={detailDeveloper.preferredEmailAccountBindingId ?? null}
                  onSetPreferred={handleSetPreferredAccount}
                  preferredBusy={preferredAccountState.loading}
                  onTransfer={beginAccountTransfer}
                  canConnect={!detailDeveloper.archivedAt}
                  connecting={connectChannel === "EMAIL"}
                  onConnect={() => setConnectChannel((value) => value === "EMAIL" ? null : "EMAIL")}
                  t={t}
                />
              </div>
              <div className="affiliate-bd-contact-ledger">
                <div className="affiliate-bd-command-section-head">
                  <div className="affiliate-bd-section-title">
                    <span className="affiliate-bd-section-icon"><UserIcon /></span>
                    <div>
                      <strong>{t("ecommerce.affiliateTeam.creatorContacts", { defaultValue: "Creator contacts on these accounts" })}</strong>
                      <span>{t("ecommerce.affiliateTeam.creatorContactsHint", { defaultValue: "Each row is one concrete sender account → Creator contact route." })}</span>
                    </div>
                  </div>
                  <span>{detailChannelContacts.length}</span>
                </div>
                {channelContactsQuery.loading && !channelContactsQuery.data
                  ? <div className="affiliate-bd-channel-card-empty">{t("common.loading")}</div>
                  : detailChannelContacts.length > 0
                    ? <div className="affiliate-bd-contact-list">{detailChannelContacts.map((contact) => {
                        const account = contact.channel === GQL.AffiliateMessageChannel.Whatsapp
                          ? detailWhatsapp.find((item) => item.id === contact.accountBindingId)
                          : detailEmail.find((item) => item.id === contact.accountBindingId);
                        const accountAddress = contact.channel === GQL.AffiliateMessageChannel.Whatsapp
                          ? detailWhatsapp.find((item) => item.id === contact.accountBindingId)?.phoneNumber
                          : detailEmail.find((item) => item.id === contact.accountBindingId)?.emailAddress;
                        const address = contact.creatorPhone || contact.creatorEmail || t("ecommerce.affiliateTeam.unknownContact", { defaultValue: "Provider identity" });
                        return <div className="affiliate-bd-contact-row" key={contact.id}>
                          <span className={`affiliate-bd-contact-channel is-${contact.channel.toLowerCase()}`}>{contact.channel === GQL.AffiliateMessageChannel.Whatsapp ? "WhatsApp" : "Outlook"}</span>
                          <div>
                            <strong>{contact.effectiveAlias || address}</strong>
                            <small>{address}</small>
                          </div>
                          <span className="affiliate-bd-contact-bridge">←</span>
                          <div>
                            <strong>{account?.displayName || accountAddress || t("ecommerce.affiliateTeam.unknownAccount", { defaultValue: "Unknown sender" })}</strong>
                            <small>{accountAddress || t("ecommerce.affiliateTeam.unknownAccount", { defaultValue: "Unavailable sender" })}</small>
                          </div>
                          <span className={`affiliate-channel-health ${contact.status.toLowerCase()}`}>{contact.status}</span>
                        </div>;
                      })}</div>
                    : <div className="affiliate-bd-channel-card-empty">{t("ecommerce.affiliateTeam.noCreatorContacts", { defaultValue: "No Creator contact has been added on this BD's accounts yet." })}</div>}
              </div>
            </section>}

            {detailTab === "SETTINGS" && <section
              id="affiliate-bd-panel-settings"
              className="affiliate-bd-profile-section"
              role="tabpanel"
              aria-labelledby="affiliate-bd-tab-settings"
            >
              <div className="affiliate-bd-command-section-head">
                <div className="affiliate-bd-section-title">
                  <span className="affiliate-bd-section-icon"><UserIcon /></span>
                  <div>
                    <strong>{t("ecommerce.affiliateTeam.detailOverview", { defaultValue: "Overview" })}</strong>
                    <span>{t("ecommerce.affiliateTeam.workingStyle")}</span>
                  </div>
                </div>
              </div>
              <DeveloperProfileEditor form={form} setForm={setForm} t={t} />
            </section>}
          </div>

          {detailTab === "SETTINGS" && <div className="affiliate-bd-detail-footer">
            {archiveBlocked && <span className="affiliate-bd-archive-note"><InfoIcon />{t("ecommerce.affiliateTeam.archiveBlockedHint", { defaultValue: "Move all creators and outreach accounts before archiving this BD." })}</span>}
            <div>
              {!detailDeveloper.archivedAt && <button className="btn btn-danger" type="button" onClick={handleArchiveDeveloper} disabled={archiveState.loading || archiveBlocked}>{t("ecommerce.affiliateTeam.archive")}</button>}
              {!detailDeveloper.archivedAt && <button
                className="btn btn-primary"
                type="button"
                onClick={saveDeveloper}
                disabled={
                  writeState.loading ||
                  !form.displayName.trim() ||
                  (!detailFormDirty && !detailNeedsProfileConfirmation)
                }
              >{t("common.save")}</button>}
            </div>
          </div>}
        </>}
      </Modal>

      <Modal
        isOpen={Boolean(pendingAccountTransfer)}
        onClose={() => {
          if (transferBusy) return;
          setPendingAccountTransfer(null);
          setTransferTargetId("");
        }}
        title={pendingAccountTransfer
          ? `${t("ecommerce.affiliateTeam.transferAccount")} · ${pendingAccountTransfer.channel === "WHATSAPP" ? "WhatsApp" : "Outlook"}`
          : t("ecommerce.affiliateTeam.transferAccount")}
        maxWidth={520}
        className="affiliate-account-transfer-modal"
        closeLabel={t("common.close")}
        preventBackdropClose={transferBusy}
        portal
      >
        {pendingAccountTransfer && <>
          <div className="affiliate-account-transfer-content">
            <div className={`affiliate-account-transfer-summary is-${pendingAccountTransfer.channel.toLowerCase()}`}>
              <span className="affiliate-account-transfer-mark" aria-hidden="true">
                {pendingAccountTransfer.channel === "WHATSAPP" ? "W" : "O"}
              </span>
              <div>
                <small>{pendingAccountTransfer.channel === "WHATSAPP" ? "WhatsApp" : "Outlook"}</small>
                <strong>{pendingAccountTransfer.account.displayName || pendingAccountTransfer.account.phoneNumber || pendingAccountTransfer.account.emailAddress || t("ecommerce.affiliateTeam.unnamedAccount")}</strong>
                {(pendingAccountTransfer.account.phoneNumber || pendingAccountTransfer.account.emailAddress) && pendingAccountTransfer.account.displayName && (
                  <span>{pendingAccountTransfer.account.phoneNumber || pendingAccountTransfer.account.emailAddress}</span>
                )}
              </div>
            </div>
            <label className="affiliate-account-transfer-target">
              <span>{t("ecommerce.affiliateTeam.transferTarget")}</span>
              <Select
                value={transferTargetId}
                onChange={setTransferTargetId}
                options={transferOwnerOptions}
                placeholder={t("ecommerce.affiliateTeam.transferTargetPlaceholder")}
                ariaLabel={t("ecommerce.affiliateTeam.transferTarget")}
                searchable
                searchPlaceholder={t("ecommerce.affiliateTeam.ownerSearchPlaceholder")}
              />
            </label>
            <p className="affiliate-account-transfer-warning"><InfoIcon />{t("ecommerce.affiliateTeam.transferConfirm")}</p>
          </div>
          <div className="affiliate-account-transfer-footer">
            <button className="btn btn-secondary" type="button" onClick={() => {
              setPendingAccountTransfer(null);
              setTransferTargetId("");
            }} disabled={transferBusy}>{t("common.cancel")}</button>
            <button className="btn btn-primary" type="button" onClick={confirmAccountTransfer} disabled={transferBusy || !transferTargetId}>
              {t("ecommerce.affiliateTeam.confirmTransfer")}
            </button>
          </div>
        </>}
      </Modal>

      <Modal
        isOpen={Boolean(connectChannel && detailDeveloper)}
        onClose={() => {
          setConnectChannel(null);
          setReconnectWhatsAppAccountId(null);
        }}
        title={connectChannel === "WHATSAPP"
          ? `${t("ecommerce.affiliateTeam.connectChannel")} · WhatsApp`
          : `${t("ecommerce.affiliateTeam.connectChannel")} · Outlook`}
        maxWidth={connectChannel === "WHATSAPP" ? 760 : 680}
        className={`affiliate-channel-onboarding-modal ${connectChannel === "WHATSAPP" ? "is-whatsapp" : "is-email"}`}
        closeLabel={t("common.close")}
        portal
      >
        {detailDeveloper && connectChannel === "WHATSAPP" && <AffiliateWhatsAppAccountPanel
          businessDeveloperId={detailDeveloper.id}
          showAccountList={false}
          reconnectBindingId={reconnectWhatsAppAccountId}
          onReconnectComplete={() => {
            setReconnectWhatsAppAccountId(null);
            setConnectChannel(null);
          }}
          onAccountsChanged={refreshChannelData}
        />}
        {detailDeveloper && connectChannel === "EMAIL" && <AffiliateEmailAccountPanel
          businessDeveloperId={detailDeveloper.id}
          showAccountList={false}
          onAccountsChanged={refreshChannelData}
        />}
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
    <label><span>{t("ecommerce.affiliateTeam.workingStyle")}</span><textarea className="input" rows={7} value={form.businessPrompt} onChange={(event) => setForm({ ...form, businessPrompt: event.target.value })} placeholder={t("ecommerce.affiliateTeam.workingStylePlaceholder")} /><small className="affiliate-bd-prompt-hint"><InfoIcon />{t("ecommerce.affiliateTeam.workingStylePlaceholder")}</small></label>
    <div className="affiliate-developer-editor-actions"><button className="btn btn-secondary" type="button" onClick={onCancel}>{t("common.cancel")}</button><button className="btn btn-primary" type="button" onClick={onSave} disabled={saving || !form.displayName.trim()}>{t("common.save")}</button></div>
  </div>;
}

function DeveloperProfileEditor({ form, setForm, t }: {
  form: DeveloperForm;
  setForm: (form: DeveloperForm) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return <div className="affiliate-bd-inline-editor">
    <label className="affiliate-bd-inline-name"><span>{t("ecommerce.affiliateTeam.name")}</span><input className="input" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
    <label><span>{t("ecommerce.affiliateTeam.workMode")}</span><Select value={form.agentAssistanceMode} onChange={(value) => setForm({ ...form, agentAssistanceMode: value as GQL.AffiliateAgentAssistanceMode })} options={[
      { value: GQL.AffiliateAgentAssistanceMode.AiAssisted, label: t("ecommerce.affiliateTeam.aiAssisted") },
      { value: GQL.AffiliateAgentAssistanceMode.HumanOnly, label: t("ecommerce.affiliateTeam.humanOnly") },
    ]} /></label>
    <label className="affiliate-bd-inline-toggle"><input type="checkbox" checked={form.acceptingCreators} onChange={(event) => setForm({ ...form, acceptingCreators: event.target.checked })} /><span>{t("ecommerce.affiliateTeam.acceptingCreators")}</span></label>
    <fieldset><legend>{t("ecommerce.affiliateTeam.regions")}</legend><div className="affiliate-region-grid">{SHOP_REGIONS.map((region) => <label key={region}><input type="checkbox" checked={form.regions.includes(region)} onChange={(event) => setForm({ ...form, regions: event.target.checked ? [...form.regions, region] : form.regions.filter((item) => item !== region) })} /><span>{formatShopRegionLabel(region, t)}</span></label>)}</div></fieldset>
    <label className="affiliate-bd-inline-prompt"><span>{t("ecommerce.affiliateTeam.workingStyle")}</span><textarea className="input" rows={5} value={form.businessPrompt} onChange={(event) => setForm({ ...form, businessPrompt: event.target.value })} placeholder={t("ecommerce.affiliateTeam.workingStylePlaceholder")} /><small className="affiliate-bd-prompt-hint"><InfoIcon />{t("ecommerce.affiliateTeam.workingStylePlaceholder")}</small></label>
  </div>;
}

function ChannelCount({ total, unhealthy }: { total: number; unhealthy: number }) {
  return <span className={`affiliate-bd-channel-count ${unhealthy > 0 ? "has-warning" : ""}`}>
    <strong>{total}</strong>
    {unhealthy > 0 && <small>{unhealthy}</small>}
  </span>;
}

function ChannelAccountRows({ channel, accounts, ownerOptions, onOwnerChange, onTransfer, onReconnect, preferredAccountId, onSetPreferred, preferredBusy, t }: {
  channel: "WHATSAPP" | "EMAIL";
  accounts: ChannelAccount[];
  ownerOptions?: Array<{ value: string; label: string }>;
  onOwnerChange?: (channel: "WHATSAPP" | "EMAIL", accountId: string, ownerId: string) => void;
  onTransfer?: (channel: "WHATSAPP" | "EMAIL", account: ChannelAccount) => void;
  onReconnect?: (accountId: string) => void;
  preferredAccountId?: string | null;
  onSetPreferred?: (channel: "WHATSAPP" | "EMAIL", accountId: string) => void;
  preferredBusy?: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return <>{accounts.map((account) => {
    const address = account.phoneNumber || account.emailAddress;
    const statusLabel = channel === "WHATSAPP"
      ? t(`ecommerce.affiliateWorkspace.whatsapp.status.${account.status}`, { defaultValue: account.status })
      : t(`ecommerce.affiliateWorkspace.email.status.${account.status.toLowerCase()}`, { defaultValue: account.status });
    const preferred = preferredAccountId === account.id;
    return <div className="affiliate-channel-row" key={account.id}>
      <span className="affiliate-channel-kind">{channel === "WHATSAPP" ? "WhatsApp" : "Outlook"}</span>
      <div className="affiliate-channel-account-identity">
        <span className="affiliate-channel-account-avatar"><UserIcon /></span>
        <div>
          <strong>{account.displayName || address || t("ecommerce.affiliateTeam.unnamedAccount")}</strong>
          {address && account.displayName && <small>{address}</small>}
          {account.lastError && <small className="affiliate-channel-error-reason">{account.lastError}</small>}
        </div>
      </div>
      <span className={`affiliate-channel-health ${account.status.toLowerCase()}`}>{statusLabel}</span>
      {onSetPreferred && <button
        className={`affiliate-channel-preferred ${preferred ? "is-preferred" : ""}`}
        type="button"
        onClick={() => onSetPreferred(channel, account.id)}
        disabled={preferredBusy || preferred}
        aria-pressed={preferred}
      >
        <span aria-hidden="true">★</span>
        {preferred
          ? t("ecommerce.affiliateTeam.preferredAccount", { defaultValue: "Preferred" })
          : t("ecommerce.affiliateTeam.makePreferred", { defaultValue: "Make preferred" })}
      </button>}
      {(onTransfer || (channel === "WHATSAPP" && account.status !== GQL.WhatsAppAccountStatus.Connected && account.status !== GQL.WhatsAppAccountStatus.Revoked && onReconnect)) && (
        <div className="affiliate-channel-row-actions">
          {channel === "WHATSAPP" && account.status !== GQL.WhatsAppAccountStatus.Connected && account.status !== GQL.WhatsAppAccountStatus.Revoked && onReconnect && (
            <button className="btn btn-primary btn-sm affiliate-channel-reconnect" type="button" onClick={() => onReconnect(account.id)}>
              {t("ecommerce.affiliateTeam.reconnectChannel", { defaultValue: "Reconnect" })}
            </button>
          )}
          {onTransfer && <button className="affiliate-channel-transfer-button" type="button" onClick={() => onTransfer(channel, account)}>
            {t("ecommerce.affiliateTeam.transferAccount")}
          </button>}
        </div>
      )}
      {ownerOptions && onOwnerChange && <label className="affiliate-channel-owner-field">
          <span>{t("ecommerce.affiliateTeam.assignDeveloper")}</span>
          <Select value={account.businessDeveloperId ?? UNASSIGNED_ID} onChange={(value) => onOwnerChange(channel, account.id, value)} options={ownerOptions} />
        </label>}
    </div>;
  })}</>;
}

function ChannelWorkspaceCard({ channel, accounts, onTransfer, canConnect, connecting, onConnect, onReconnect, preferredAccountId, onSetPreferred, preferredBusy, t }: {
  channel: "WHATSAPP" | "EMAIL";
  accounts: ChannelAccount[];
  onTransfer: (channel: "WHATSAPP" | "EMAIL", account: ChannelAccount) => void;
  canConnect: boolean;
  connecting: boolean;
  onConnect: () => void;
  onReconnect?: (accountId: string) => void;
  preferredAccountId?: string | null;
  onSetPreferred?: (channel: "WHATSAPP" | "EMAIL", accountId: string) => void;
  preferredBusy?: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const label = channel === "WHATSAPP" ? "WhatsApp" : "Outlook";
  const healthyCount = accounts.filter((account) => account.status.toLowerCase() === "connected").length;
  return <section className={`affiliate-bd-channel-card is-${channel.toLowerCase()} ${connecting ? "is-expanded" : ""}`}>
    <header className="affiliate-bd-channel-card-head">
      <div className="affiliate-bd-channel-brand">
        <span aria-hidden="true">{channel === "WHATSAPP" ? "W" : "O"}</span>
        <div>
          <strong>{label}</strong>
          <small>{channel === "WHATSAPP" ? t("ecommerce.affiliateTeam.whatsappAccounts") : t("ecommerce.affiliateTeam.emailAccounts")}</small>
        </div>
      </div>
      <div className="affiliate-bd-channel-card-actions">
        <span className={`affiliate-bd-channel-signal ${healthyCount === accounts.length && accounts.length > 0 ? "is-healthy" : ""}`}>
          <i aria-hidden="true" />{healthyCount}/{accounts.length}
        </span>
        {canConnect && <button className={`btn btn-secondary btn-sm affiliate-channel-connect-button ${connecting ? "is-expanded" : ""}`} type="button" onClick={onConnect} aria-expanded={connecting}>
          {connecting ? t("common.close") : t("ecommerce.affiliateTeam.connectChannel")}
        </button>}
      </div>
    </header>
    <div className="affiliate-bd-channel-card-body">
      {accounts.length > 0
        ? <ChannelAccountRows channel={channel} accounts={accounts} onTransfer={onTransfer} onReconnect={onReconnect} preferredAccountId={preferredAccountId} onSetPreferred={onSetPreferred} preferredBusy={preferredBusy} t={t} />
        : <div className="affiliate-bd-channel-card-empty">{t("ecommerce.affiliateTeam.noChannels")}</div>}
    </div>
  </section>;
}

function normalizeSpreadsheetRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase().replace(/[\s-]+/g, "_"), value]));
}

function cleanCell(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}
