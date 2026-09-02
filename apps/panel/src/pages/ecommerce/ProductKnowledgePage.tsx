import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { CheckIcon, EcommerceIcon, RefreshIcon, ShopIcon } from "../../components/icons.js";
import { ProductCard } from "../../components/ecommerce/ProductCard.js";
import { TkConfirmDialog as ConfirmDialog } from "../../components/design-system/index.js";
import { TkModal as Modal } from "../../components/design-system/index.js";
import { useToast } from "../../components/Toast.js";
import {
  TkInteractiveTableRow,
  TkPanel,
  TkTableFrame,
} from "../../components/design-system/index.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { BEFORE_NAVIGATE_EVENT, type BeforeNavigateDetail } from "../../lib/navigation-guard.js";
import { formatLocalizedDateTime } from "../../lib/format-datetime.js";
import {
  ARCHIVE_PRODUCT_KNOWLEDGE_MUTATION,
  CREATE_PRODUCT_KNOWLEDGE_MUTATION,
  DISCOVER_PRODUCTS_BY_SELLER_SKU_QUERY,
  LINK_PRODUCTS_TO_KNOWLEDGE_MUTATION,
  PRODUCT_KNOWLEDGE_QUERY,
  PRODUCT_KNOWLEDGES_QUERY,
  RESTORE_PRODUCT_KNOWLEDGE_MUTATION,
  UNLINK_PRODUCT_KNOWLEDGE_BINDING_MUTATION,
  UPDATE_PRODUCT_KNOWLEDGE_MUTATION,
} from "../../api/product-knowledge-queries.js";
import { AffiliatePageFrame, AffiliatePageHeader } from "./components/AffiliateUi.js";
import "./components/AffiliateUi.css";

const ProductKnowledgeMarkdownEditor = lazy(async () => {
  const module = await import("./components/ProductKnowledgeMarkdownEditor.js");
  return { default: module.ProductKnowledgeMarkdownEditor };
});

const MARKDOWN_MAX_LENGTH = 10_000;
const PAGE_SIZE = 25;

type KnowledgeSummary = Omit<GQL.ProductKnowledge, "bindings">;
type KnowledgeDraft = {
  name: string;
  usageInstructionsMarkdown: string;
  qaMarkdown: string;
  creativeCasesMarkdown: string;
};
type ContentTab = "usage" | "qa" | "cases";
type Confirmation =
  | { kind: "archive"; id: string; name: string; revision: number }
  | { kind: "unlink"; bindingId: string; productTitle: string }
  | { kind: "discard"; action: "select"; selectedId: string }
  | { kind: "discard"; action: "close" | "create" | "navigate" }
  | null;

function draftFromKnowledge(knowledge: GQL.ProductKnowledge): KnowledgeDraft {
  return {
    name: knowledge.name,
    usageInstructionsMarkdown: knowledge.usageInstructionsMarkdown,
    qaMarkdown: knowledge.qaMarkdown,
    creativeCasesMarkdown: knowledge.creativeCasesMarkdown,
  };
}

function draftIsDirty(draft: KnowledgeDraft | null, knowledge?: GQL.ProductKnowledge): boolean {
  if (!draft || !knowledge) return false;
  return (
    draft.name !== knowledge.name ||
    draft.usageInstructionsMarkdown !== knowledge.usageInstructionsMarkdown ||
    draft.qaMarkdown !== knowledge.qaMarkdown ||
    draft.creativeCasesMarkdown !== knowledge.creativeCasesMarkdown
  );
}

function candidateKey(
  candidate: Pick<GQL.SellerSkuProductCandidate, "shopId" | "productId">,
): string {
  return `${candidate.shopId}:${candidate.productId}`;
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as {
    graphQLErrors?: Array<{ extensions?: { code?: unknown } }>;
    errors?: Array<{ extensions?: { code?: unknown } }>;
  };
  const code = value.graphQLErrors?.[0]?.extensions?.code ?? value.errors?.[0]?.extensions?.code;
  return typeof code === "string" ? code : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const ProductKnowledgePage = observer(function ProductKnowledgePage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const [status, setStatus] = useState<GQL.ProductKnowledgeStatus>(
    GQL.ProductKnowledgeStatus.Active,
  );
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<ContentTab>("usage");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const [sellerSku, setSellerSku] = useState("");
  const [discoveryKnowledgeId, setDiscoveryKnowledgeId] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [linkFailures, setLinkFailures] = useState<GQL.ProductKnowledgeLinkFailure[]>([]);
  const [staleConflict, setStaleConflict] = useState(false);

  const listQuery = useQuery<{ productKnowledges: GQL.ProductKnowledgePage }>(
    PRODUCT_KNOWLEDGES_QUERY,
    {
      variables: { input: { status, search: search || null, offset, limit: PAGE_SIZE } },
      skip: !user,
      fetchPolicy: "cache-and-network",
    },
  );
  const detailQuery = useQuery<{ productKnowledge: GQL.ProductKnowledge }>(
    PRODUCT_KNOWLEDGE_QUERY,
    {
      variables: { id: selectedId },
      skip: !user || !selectedId,
      fetchPolicy: "cache-and-network",
    },
  );
  const [discoverProducts, discovery] = useLazyQuery<{
    discoverProductsBySellerSku: GQL.SellerSkuProductDiscoveryPayload;
  }>(DISCOVER_PRODUCTS_BY_SELLER_SKU_QUERY, { fetchPolicy: "network-only" });
  const [createKnowledge, createState] = useMutation<{
    createProductKnowledge: KnowledgeSummary;
  }>(CREATE_PRODUCT_KNOWLEDGE_MUTATION);
  const [updateKnowledge, updateState] = useMutation<{
    updateProductKnowledge: GQL.ProductKnowledge;
  }>(UPDATE_PRODUCT_KNOWLEDGE_MUTATION);
  const [archiveKnowledge, archiveState] = useMutation<{
    archiveProductKnowledge: KnowledgeSummary;
  }>(ARCHIVE_PRODUCT_KNOWLEDGE_MUTATION);
  const [restoreKnowledge, restoreState] = useMutation<{
    restoreProductKnowledge: KnowledgeSummary;
  }>(RESTORE_PRODUCT_KNOWLEDGE_MUTATION);
  const [linkProducts, linkState] = useMutation<{
    linkProductsToKnowledge: GQL.LinkProductsToKnowledgePayload;
  }>(LINK_PRODUCTS_TO_KNOWLEDGE_MUTATION);
  const [unlinkBinding] = useMutation<{
    unlinkProductKnowledgeBinding: boolean;
  }>(UNLINK_PRODUCT_KNOWLEDGE_BINDING_MUTATION);

  const items = listQuery.data?.productKnowledges.items ?? [];
  const totalCount = listQuery.data?.productKnowledges.totalCount ?? 0;
  const knowledge = detailQuery.data?.productKnowledge;
  const dirty = draftIsDirty(draft, knowledge);
  const isArchived = knowledge?.status === GQL.ProductKnowledgeStatus.Archived;
  const discoveryPayload =
    discoveryKnowledgeId === selectedId ? discovery.data?.discoverProductsBySellerSku : undefined;
  const candidates = discoveryPayload?.candidates ?? [];
  const selectableCandidates = candidates.filter(
    (candidate) =>
      !candidate.existingProductKnowledgeId || candidate.existingProductKnowledgeId === selectedId,
  );

  useEffect(() => {
    if (!knowledge) return;
    if (!draft || draftRevision === 0 || (!dirty && draftRevision !== knowledge.revision)) {
      setDraft(draftFromKnowledge(knowledge));
      setDraftRevision(knowledge.revision);
      setStaleConflict(false);
    }
  }, [knowledge?.id, knowledge?.revision]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const handleBeforeNavigate = (event: Event) => {
      const navigationEvent = event as CustomEvent<BeforeNavigateDetail>;
      event.preventDefault();
      pendingNavigationRef.current = navigationEvent.detail.proceed ?? null;
      setConfirmation({ kind: "discard", action: "navigate" });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener(BEFORE_NAVIGATE_EVENT, handleBeforeNavigate);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(BEFORE_NAVIGATE_EVENT, handleBeforeNavigate);
    };
  }, [dirty, t]);

  function selectKnowledge(id: string) {
    if (id === selectedId) return;
    if (dirty) {
      setConfirmation({ kind: "discard", action: "select", selectedId: id });
      return;
    }
    resetSelection();
    setSelectedId(id);
  }

  function closeDetail() {
    if (dirty) {
      setConfirmation({ kind: "discard", action: "close" });
      return;
    }
    resetSelection();
  }

  function resetSelection() {
    setSelectedId("");
    setDraft(null);
    setDraftRevision(0);
    setSellerSku("");
    setDiscoveryKnowledgeId("");
    setSelectedCandidates(new Set());
    setLinkFailures([]);
    setStaleConflict(false);
  }

  async function handleCreate() {
    if (!createName.trim()) return;
    if (dirty) {
      setConfirmation({ kind: "discard", action: "create" });
      return;
    }
    await createKnowledgeNow();
  }

  async function createKnowledgeNow() {
    try {
      const result = await createKnowledge({ variables: { input: { name: createName } } });
      const created = result.data?.createProductKnowledge;
      if (!created) throw new Error(t("ecommerce.productKnowledge.createFailed"));
      setStatus(GQL.ProductKnowledgeStatus.Active);
      setSearchDraft("");
      setSearch("");
      setOffset(0);
      setCreateOpen(false);
      setCreateName("");
      await listQuery.refetch({
        input: {
          status: GQL.ProductKnowledgeStatus.Active,
          search: null,
          offset: 0,
          limit: PAGE_SIZE,
        },
      });
      resetSelection();
      setSelectedId(created.id);
      showToast(t("ecommerce.productKnowledge.created"));
    } catch (error) {
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  async function handleSave() {
    if (!knowledge || !draft || isArchived) return;
    try {
      const result = await updateKnowledge({
        variables: {
          input: {
            id: knowledge.id,
            expectedRevision: draftRevision,
            ...draft,
          },
        },
      });
      const updated = result.data?.updateProductKnowledge;
      if (!updated) throw new Error(t("ecommerce.productKnowledge.saveFailed"));
      setDraft(draftFromKnowledge(updated));
      setDraftRevision(updated.revision);
      setStaleConflict(false);
      await Promise.all([detailQuery.refetch(), listQuery.refetch()]);
      showToast(t("common.saved"));
    } catch (error) {
      if (
        errorCode(error) === "PRODUCT_KNOWLEDGE_REVISION_STALE" ||
        errorMessage(error).includes("PRODUCT_KNOWLEDGE_REVISION_STALE") ||
        errorMessage(error).includes("revision is stale")
      ) {
        setStaleConflict(true);
        await detailQuery.refetch();
        showToast(t("ecommerce.productKnowledge.staleConflict"), "warning");
        return;
      }
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  async function handleArchive() {
    if (!confirmation || confirmation.kind !== "archive") return;
    try {
      await archiveKnowledge({
        variables: {
          id: confirmation.id,
          expectedRevision: confirmation.revision,
        },
      });
      setConfirmation(null);
      setSelectedId("");
      setDraft(null);
      await listQuery.refetch();
      showToast(t("ecommerce.productKnowledge.archived"));
    } catch (error) {
      setConfirmation(null);
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  async function handleRestore() {
    if (!knowledge) return;
    try {
      await restoreKnowledge({
        variables: {
          id: knowledge.id,
          expectedRevision: knowledge.revision,
        },
      });
      setSelectedId("");
      setDraft(null);
      await listQuery.refetch();
      showToast(t("ecommerce.productKnowledge.restored"));
    } catch (error) {
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  async function runDiscovery(clearLinkFailures = true) {
    const value = sellerSku.trim();
    if (!value || isArchived) return;
    const knowledgeId = selectedId;
    setDiscoveryKnowledgeId("");
    setSelectedCandidates(new Set());
    if (clearLinkFailures) setLinkFailures([]);
    try {
      await discoverProducts({ variables: { sellerSku: value } });
      setDiscoveryKnowledgeId(knowledgeId);
    } catch (error) {
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  function toggleCandidate(key: string) {
    setSelectedCandidates((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllCandidates() {
    const selectableKeys = selectableCandidates
      .filter((candidate) => candidate.existingProductKnowledgeId !== selectedId)
      .map(candidateKey);
    const allSelected =
      selectableKeys.length > 0 && selectableKeys.every((key) => selectedCandidates.has(key));
    setSelectedCandidates(allSelected ? new Set() : new Set(selectableKeys));
  }

  async function handleLinkProducts() {
    if (!knowledge || selectedCandidates.size === 0) return;
    const products = candidates
      .filter((candidate) => selectedCandidates.has(candidateKey(candidate)))
      .map((candidate) => ({ shopId: candidate.shopId, productId: candidate.productId }));
    try {
      const result = await linkProducts({
        variables: {
          input: { productKnowledgeId: knowledge.id, products },
        },
      });
      const payload = result.data?.linkProductsToKnowledge;
      if (!payload) throw new Error(t("ecommerce.productKnowledge.linkFailed"));
      setSelectedCandidates(new Set());
      setLinkFailures(payload.failures);
      await Promise.all([detailQuery.refetch(), listQuery.refetch(), runDiscovery(false)]);
      if (payload.failures.length > 0) {
        showToast(
          t("ecommerce.productKnowledge.linkPartial", {
            linked: payload.linked.length,
            failed: payload.failures.length,
          }),
          "warning",
        );
      } else {
        showToast(t("ecommerce.productKnowledge.linked", { count: payload.linked.length }));
      }
    } catch (error) {
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  async function handleUnlink() {
    if (!confirmation || confirmation.kind !== "unlink") return;
    try {
      await unlinkBinding({ variables: { bindingId: confirmation.bindingId } });
      setConfirmation(null);
      await Promise.all([detailQuery.refetch(), listQuery.refetch()]);
      showToast(t("ecommerce.productKnowledge.unlinked"));
    } catch (error) {
      setConfirmation(null);
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
    }
  }

  function cancelConfirmation() {
    if (confirmation?.kind === "discard" && confirmation.action === "navigate") {
      pendingNavigationRef.current = null;
    }
    setConfirmation(null);
  }

  function confirmDialogAction() {
    if (!confirmation) return;
    if (confirmation.kind === "archive") {
      void handleArchive();
      return;
    }
    if (confirmation.kind === "unlink") {
      void handleUnlink();
      return;
    }
    const action = confirmation;
    const pendingNavigation = action.action === "navigate" ? pendingNavigationRef.current : null;
    pendingNavigationRef.current = null;
    setConfirmation(null);
    resetSelection();
    if (action.action === "select") {
      setSelectedId(action.selectedId);
      return;
    }
    if (action.action === "create") {
      void createKnowledgeNow();
      return;
    }
    pendingNavigation?.();
  }

  if (authChecking) {
    return (
      <AffiliatePageFrame>
        <TkPanel className="section-card">
          <p>{t("common.loading")}</p>
        </TkPanel>
      </AffiliatePageFrame>
    );
  }
  if (!user) {
    return (
      <AffiliatePageFrame>
        <TkPanel className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </TkPanel>
      </AffiliatePageFrame>
    );
  }

  const tabConfig: Array<{
    id: ContentTab;
    label: string;
    description: string;
    field: keyof KnowledgeDraft;
  }> = [
    {
      id: "usage",
      label: t("ecommerce.productKnowledge.usageInstructions"),
      description: t("ecommerce.productKnowledge.usageDescription"),
      field: "usageInstructionsMarkdown",
    },
    {
      id: "qa",
      label: t("ecommerce.productKnowledge.qa"),
      description: t("ecommerce.productKnowledge.qaDescription"),
      field: "qaMarkdown",
    },
    {
      id: "cases",
      label: t("ecommerce.productKnowledge.creativeCases"),
      description: t("ecommerce.productKnowledge.casesDescription"),
      field: "creativeCasesMarkdown",
    },
  ];
  const activeTabConfig = tabConfig.find((tab) => tab.id === activeTab)!;
  const activeMarkdown = draft?.[activeTabConfig.field] ?? "";
  const contentOverLimit = Boolean(
    draft &&
    [draft.usageInstructionsMarkdown, draft.qaMarkdown, draft.creativeCasesMarkdown].some(
      (value) => value.length > MARKDOWN_MAX_LENGTH,
    ),
  );
  const shopById = new Map(entityStore.shops.map((shop) => [shop.id, shop]));
  const productCardLabels = {
    alias: t("ecommerce.productKnowledge.shopAlias"),
    sellerSku: t("ecommerce.productKnowledge.sellerSkuLabel"),
  };

  return (
    <AffiliatePageFrame className="product-knowledge-page">
      <AffiliatePageHeader
        className="product-knowledge-header"
        data-tutorial-id="product-knowledge-header"
        eyebrow={
          <>
            <EcommerceIcon size={14} />
            {t("ecommerce.productKnowledge.kicker")}
          </>
        }
        title={t("ecommerce.productKnowledge.pageTitle")}
        subtitle={t("ecommerce.productKnowledge.pageSubtitle")}
        actions={
          <button
            className="btn btn-primary"
            data-tutorial-id="product-knowledge-create"
            onClick={() => setCreateOpen(true)}
          >
            + {t("ecommerce.productKnowledge.create")}
          </button>
        }
      />

      <TkPanel
        as="section"
        padding="none"
        clip
        className="product-knowledge-catalog"
        data-tutorial-id="product-knowledge-library"
      >
        <div className="product-knowledge-catalog-toolbar">
          <form
            className="product-knowledge-catalog-search"
            onSubmit={(event) => {
              event.preventDefault();
              const nextSearch = searchDraft.trim();
              if (nextSearch === search) return;
              setOffset(0);
              setSearch(nextSearch);
            }}
          >
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t("ecommerce.productKnowledge.searchPlaceholder")}
            />
            <button type="submit">{t("ecommerce.productKnowledge.search")}</button>
          </form>
          <div className="product-knowledge-catalog-controls">
            <span className="product-knowledge-catalog-count">
              {t("ecommerce.productKnowledge.libraryCount", { count: totalCount })}
            </span>
            <div className="product-knowledge-status-switch">
              <button
                className={status === GQL.ProductKnowledgeStatus.Active ? "active" : ""}
                onClick={() => {
                  if (status !== GQL.ProductKnowledgeStatus.Active) {
                    setStatus(GQL.ProductKnowledgeStatus.Active);
                    setOffset(0);
                  }
                }}
              >
                {t("ecommerce.productKnowledge.active")}
              </button>
              <button
                className={status === GQL.ProductKnowledgeStatus.Archived ? "active" : ""}
                onClick={() => {
                  if (status !== GQL.ProductKnowledgeStatus.Archived) {
                    setStatus(GQL.ProductKnowledgeStatus.Archived);
                    setOffset(0);
                  }
                }}
              >
                {t("ecommerce.productKnowledge.archivedStatus")}
              </button>
            </div>
          </div>
        </div>

        {listQuery.loading && items.length === 0 ? (
          <div className="product-knowledge-table-state">
            <p>{t("common.loading")}</p>
          </div>
        ) : !listQuery.loading && items.length === 0 ? (
          <div className="product-knowledge-table-state">
            <EcommerceIcon size={28} />
            <strong>{t("ecommerce.productKnowledge.emptyTitle")}</strong>
            <span>{t("ecommerce.productKnowledge.emptyBody")}</span>
          </div>
        ) : (
          <TkTableFrame variant="embedded" className="product-knowledge-table-shell">
            <table className="product-knowledge-table">
              <thead>
                <tr>
                  <th>{t("ecommerce.productKnowledge.tableKnowledge")}</th>
                  <th>{t("ecommerce.productKnowledge.tableStatus")}</th>
                  <th>{t("ecommerce.productKnowledge.tableCoverage")}</th>
                  <th>{t("ecommerce.productKnowledge.tableProducts")}</th>
                  <th>{t("ecommerce.productKnowledge.tableUpdated")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const sections = [
                    item.usageInstructionsMarkdown,
                    item.qaMarkdown,
                    item.creativeCasesMarkdown,
                  ];
                  const completion = sections.filter((value) => value.trim()).length;
                  const characters = sections.reduce((total, value) => total + value.length, 0);
                  return (
                    <TkInteractiveTableRow
                      key={item.id}
                      onActivate={() => selectKnowledge(item.id)}
                    >
                      <td>
                        <span className="product-knowledge-table-name">{item.name}</span>
                        <span className="product-knowledge-table-meta">
                          {t("ecommerce.productKnowledge.characters", { count: characters })}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`product-knowledge-status product-knowledge-status-${item.status.toLowerCase()}`}
                        >
                          {item.status === GQL.ProductKnowledgeStatus.Active
                            ? t("ecommerce.productKnowledge.active")
                            : t("ecommerce.productKnowledge.archivedStatus")}
                        </span>
                      </td>
                      <td>
                        <div className="product-knowledge-coverage">
                          <span className="product-knowledge-coverage-meter" aria-hidden="true">
                            {sections.map((value, index) => (
                              <i className={value.trim() ? "filled" : ""} key={index} />
                            ))}
                          </span>
                          <span>
                            {t("ecommerce.productKnowledge.coverageCount", { count: completion })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="product-knowledge-product-count">
                          <ShopIcon size={14} />
                          {item.bindingCount}
                        </span>
                      </td>
                      <td>
                        <time dateTime={item.updatedAt}>
                          {formatLocalizedDateTime(item.updatedAt, i18n.language)}
                        </time>
                      </td>
                    </TkInteractiveTableRow>
                  );
                })}
              </tbody>
            </table>
          </TkTableFrame>
        )}

        {totalCount > PAGE_SIZE ? (
          <div className="product-knowledge-pagination">
            <button
              className="btn btn-secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("ecommerce.productKnowledge.previous")}
            </button>
            <span>
              {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
            </span>
            <button
              className="btn btn-secondary"
              disabled={offset + PAGE_SIZE >= totalCount}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t("ecommerce.productKnowledge.next")}
            </button>
          </div>
        ) : null}
      </TkPanel>

      <Modal
        isOpen={Boolean(selectedId)}
        onClose={closeDetail}
        onBackdropClose={closeDetail}
        title={t("ecommerce.productKnowledge.manageTitle")}
        headerContent={
          knowledge && draft ? (
            <div className="product-knowledge-modal-toolbar">
              <div className="product-knowledge-name-field">
                <label className="sr-only" htmlFor="product-knowledge-name">
                  {t("ecommerce.productKnowledge.name")}
                </label>
                <input
                  id="product-knowledge-name"
                  value={draft.name}
                  maxLength={120}
                  readOnly={isArchived}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="product-knowledge-detail-actions">
                {dirty ? (
                  <span className="badge badge-warning">
                    {t("ecommerce.productKnowledge.unsaved")}
                  </span>
                ) : (
                  <span className="badge badge-muted">v{knowledge.revision}</span>
                )}
                {isArchived ? (
                  <button
                    className="btn btn-primary"
                    disabled={restoreState.loading}
                    onClick={handleRestore}
                  >
                    {t("ecommerce.productKnowledge.restore")}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-secondary"
                      disabled={archiveState.loading || dirty}
                      onClick={() =>
                        setConfirmation({
                          kind: "archive",
                          id: knowledge.id,
                          name: knowledge.name,
                          revision: knowledge.revision,
                        })
                      }
                    >
                      {t("ecommerce.productKnowledge.archive")}
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={
                        !dirty || updateState.loading || !draft.name.trim() || contentOverLimit
                      }
                      onClick={handleSave}
                    >
                      {updateState.loading ? t("common.saving") : t("common.save")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null
        }
        className="product-knowledge-management-modal"
        closeLabel={t("common.close")}
        maxWidth={1320}
        padding="none"
        portal
      >
        <div className="product-knowledge-detail" data-tutorial-id="product-knowledge-editor">
          {detailQuery.loading && !knowledge ? (
            <div className="product-knowledge-detail-empty">
              <p>{t("common.loading")}</p>
            </div>
          ) : knowledge && draft ? (
            <>
              {staleConflict ? (
                <div className="product-knowledge-conflict-banner">
                  <div>
                    <strong>{t("ecommerce.productKnowledge.staleTitle")}</strong>
                    <span>{t("ecommerce.productKnowledge.staleBody")}</span>
                  </div>
                  <div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (knowledge) {
                          setDraft(draftFromKnowledge(knowledge));
                          setDraftRevision(knowledge.revision);
                          setStaleConflict(false);
                        }
                      }}
                    >
                      {t("ecommerce.productKnowledge.useServerVersion")}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        if (knowledge) {
                          setDraftRevision(knowledge.revision);
                          setStaleConflict(false);
                        }
                      }}
                    >
                      {t("ecommerce.productKnowledge.keepDraft")}
                    </button>
                  </div>
                </div>
              ) : null}

              <section className="product-knowledge-content-studio">
                <div className="product-knowledge-content-sections">
                  <div className="product-knowledge-content-heading">
                    <div className="product-knowledge-content-heading-title">
                      <span className="product-knowledge-section-index">01</span>
                      <div>
                        <h2>{t("ecommerce.productKnowledge.contentTitle")}</h2>
                        <p>{t("ecommerce.productKnowledge.contentSubtitle")}</p>
                      </div>
                    </div>
                    <p className="product-knowledge-markdown-note">
                      {t("ecommerce.productKnowledge.markdownNativeHint")}
                    </p>
                  </div>
                  <nav aria-label={t("ecommerce.productKnowledge.contentTitle")}>
                    {tabConfig.map((tab, index) => {
                      const markdown = draft[tab.field];
                      return (
                        <button
                          type="button"
                          key={tab.id}
                          className={activeTab === tab.id ? "active" : ""}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <span className="product-knowledge-content-number">0{index + 1}</span>
                          <span className="product-knowledge-content-copy">
                            <strong>{tab.label}</strong>
                            <small>{tab.description}</small>
                          </span>
                          <span
                            className={`product-knowledge-content-state${activeTab === tab.id ? " active" : ""}`}
                          >
                            {activeTab === tab.id
                              ? t("ecommerce.productKnowledge.editingSection")
                              : t("ecommerce.productKnowledge.characters", {
                                  count: markdown.length,
                                })}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                <div className="product-knowledge-editor-panel">
                  <div className="product-knowledge-editor-panel-heading">
                    <div>
                      <h3>{activeTabConfig.label}</h3>
                      <p>{activeTabConfig.description}</p>
                    </div>
                    <span className={activeMarkdown.length > MARKDOWN_MAX_LENGTH ? "limit" : ""}>
                      {activeMarkdown.length.toLocaleString(i18n.language)} /{" "}
                      {MARKDOWN_MAX_LENGTH.toLocaleString(i18n.language)}
                    </span>
                  </div>
                  <Suspense
                    fallback={
                      <div className="product-knowledge-editor-loading">{t("common.loading")}</div>
                    }
                  >
                    <ProductKnowledgeMarkdownEditor
                      key={`${knowledge.id}:${activeTab}`}
                      value={activeMarkdown}
                      readOnly={isArchived}
                      placeholder={t(`ecommerce.productKnowledge.${activeTab}Placeholder`)}
                      onChange={(markdown) =>
                        setDraft({ ...draft, [activeTabConfig.field]: markdown })
                      }
                    />
                  </Suspense>
                  {activeMarkdown.length > MARKDOWN_MAX_LENGTH ? (
                    <p className="product-knowledge-editor-limit-message">
                      {t("ecommerce.productKnowledge.overLimit")}
                    </p>
                  ) : null}
                </div>
              </section>

              <section
                className="product-knowledge-bindings"
                data-tutorial-id="product-knowledge-bindings"
              >
                <div className="product-knowledge-section-heading">
                  <div>
                    <span className="product-knowledge-section-index">02</span>
                    <div>
                      <h2>{t("ecommerce.productKnowledge.bindingsTitle")}</h2>
                      <p>{t("ecommerce.productKnowledge.bindingsSubtitle")}</p>
                    </div>
                  </div>
                  <span className="badge badge-info">
                    {t("ecommerce.productKnowledge.productCount", {
                      count: knowledge.bindingCount,
                    })}
                  </span>
                </div>

                {knowledge.bindings.length > 0 ? (
                  <div className="product-knowledge-bound-grid">
                    {knowledge.bindings.map((binding) => {
                      const shop = shopById.get(binding.shopId);
                      return (
                        <ProductCard
                          key={binding.id}
                          title={binding.productTitleSnapshot}
                          imageUrl={binding.productCoverImageSnapshot}
                          shopAlias={shop?.alias}
                          shopName={binding.shopNameSnapshot}
                          sellerSkus={binding.sellerSkusSnapshot}
                          aliasLabel={productCardLabels.alias}
                          sellerSkuLabel={productCardLabels.sellerSku}
                          actions={
                            <button
                              className="commerce-product-card-action"
                              onClick={() =>
                                setConfirmation({
                                  kind: "unlink",
                                  bindingId: binding.id,
                                  productTitle: binding.productTitleSnapshot,
                                })
                              }
                            >
                              {t("ecommerce.productKnowledge.unlink")}
                            </button>
                          }
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="product-knowledge-no-bindings">
                    {t("ecommerce.productKnowledge.noBindings")}
                  </p>
                )}

                {!isArchived ? (
                  <div className="product-knowledge-discovery">
                    <div className="product-knowledge-discovery-form">
                      <div>
                        <label htmlFor="seller-sku-search">
                          {t("ecommerce.productKnowledge.sellerSku")}
                        </label>
                        <span>{t("ecommerce.productKnowledge.sellerSkuHint")}</span>
                      </div>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void runDiscovery();
                        }}
                      >
                        <input
                          id="seller-sku-search"
                          value={sellerSku}
                          onChange={(event) => {
                            setSellerSku(event.target.value);
                            setDiscoveryKnowledgeId("");
                            setSelectedCandidates(new Set());
                            setLinkFailures([]);
                          }}
                          placeholder={t("ecommerce.productKnowledge.sellerSkuPlaceholder")}
                        />
                        <button
                          className="btn btn-primary"
                          disabled={!sellerSku.trim() || discovery.loading}
                          type="submit"
                        >
                          {discovery.loading
                            ? t("ecommerce.productKnowledge.searching")
                            : t("ecommerce.productKnowledge.discover")}
                        </button>
                      </form>
                    </div>

                    {discoveryPayload ? (
                      <div className="product-knowledge-discovery-results">
                        <div className="product-knowledge-results-summary">
                          <span>
                            {t("ecommerce.productKnowledge.searchSummary", {
                              found: candidates.length,
                              successful: discoveryPayload.successfulShopCount,
                              total: discoveryPayload.searchedShopCount,
                            })}
                          </span>
                          {selectableCandidates.some(
                            (candidate) => !candidate.existingProductKnowledgeId,
                          ) ? (
                            <button className="btn btn-secondary" onClick={toggleAllCandidates}>
                              {t("ecommerce.productKnowledge.selectAll")}
                            </button>
                          ) : null}
                        </div>
                        {discoveryPayload.shopFailures.length > 0 ? (
                          <div className="product-knowledge-shop-failures">
                            <strong>{t("ecommerce.productKnowledge.partialFailure")}</strong>
                            {discoveryPayload.shopFailures.map((failure) => (
                              <span key={failure.shopId}>
                                {failure.shopName}: {failure.message}
                              </span>
                            ))}
                            <button
                              className="btn btn-secondary"
                              onClick={() => void runDiscovery()}
                            >
                              <RefreshIcon />
                              {t("common.refresh")}
                            </button>
                          </div>
                        ) : null}
                        {linkFailures.length > 0 ? (
                          <div className="product-knowledge-link-failures">
                            <strong>{t("ecommerce.productKnowledge.linkFailureTitle")}</strong>
                            {linkFailures.map((failure) => (
                              <span key={`${failure.shopId}:${failure.productId}`}>
                                <code>{failure.productId}</code> ·{" "}
                                {failure.existingProductKnowledgeName
                                  ? t("ecommerce.productKnowledge.boundElsewhere", {
                                      name: failure.existingProductKnowledgeName,
                                    })
                                  : failure.message}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="product-knowledge-candidate-grid">
                          {candidates.map((candidate) => {
                            const key = candidateKey(candidate);
                            const boundElsewhere = Boolean(
                              candidate.existingProductKnowledgeId &&
                              candidate.existingProductKnowledgeId !== selectedId,
                            );
                            const boundHere = candidate.existingProductKnowledgeId === selectedId;
                            const shop = shopById.get(candidate.shopId);
                            return (
                              <ProductCard
                                key={key}
                                title={candidate.productTitle}
                                imageUrl={candidate.productCoverImage}
                                shopAlias={shop?.alias}
                                shopName={candidate.shopName}
                                sellerSkus={
                                  candidate.matchedSellerSkus.length > 0
                                    ? candidate.matchedSellerSkus
                                    : candidate.sellerSkus
                                }
                                aliasLabel={productCardLabels.alias}
                                sellerSkuLabel={productCardLabels.sellerSku}
                                selection={{
                                  checked: boundHere || selectedCandidates.has(key),
                                  disabled: boundElsewhere || boundHere,
                                  label: candidate.productTitle,
                                  onChange: () => toggleCandidate(key),
                                }}
                                status={
                                  boundHere ? (
                                    <span className="badge badge-success">
                                      <CheckIcon />
                                      {t("ecommerce.productKnowledge.linkedHere")}
                                    </span>
                                  ) : boundElsewhere ? (
                                    <span
                                      className="badge badge-warning"
                                      title={t("ecommerce.productKnowledge.boundElsewhere", {
                                        name: candidate.existingProductKnowledgeName,
                                      })}
                                    >
                                      {t("ecommerce.productKnowledge.linkedElsewhereShort")}
                                    </span>
                                  ) : null
                                }
                              />
                            );
                          })}
                        </div>
                        {candidates.length === 0 && discoveryPayload.shopFailures.length === 0 ? (
                          <p className="product-knowledge-no-results">
                            {t("ecommerce.productKnowledge.noResults", {
                              sku: discoveryPayload.sellerSku,
                            })}
                          </p>
                        ) : null}
                        {selectedCandidates.size > 0 ? (
                          <div className="product-knowledge-link-bar">
                            <span>
                              {t("ecommerce.productKnowledge.selectedCount", {
                                count: selectedCandidates.size,
                              })}
                            </span>
                            <button
                              className="btn btn-primary"
                              disabled={linkState.loading}
                              onClick={handleLinkProducts}
                            >
                              {t("ecommerce.productKnowledge.linkSelected")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("ecommerce.productKnowledge.createTitle")}
        maxWidth={480}
        portal
      >
        <label className="form-label-block">
          <span>{t("ecommerce.productKnowledge.name")}</span>
          <input
            autoFocus
            value={createName}
            maxLength={120}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder={t("ecommerce.productKnowledge.namePlaceholder")}
          />
        </label>
        <p className="form-hint">{t("ecommerce.productKnowledge.createHint")}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!createName.trim() || createState.loading}
            onClick={handleCreate}
          >
            {createState.loading ? t("common.saving") : t("ecommerce.productKnowledge.create")}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmation)}
        onCancel={cancelConfirmation}
        onConfirm={confirmDialogAction}
        title={
          confirmation?.kind === "archive"
            ? t("ecommerce.productKnowledge.archiveTitle")
            : confirmation?.kind === "unlink"
              ? t("ecommerce.productKnowledge.unlinkTitle")
              : t("ecommerce.productKnowledge.unsaved")
        }
        message={
          confirmation?.kind === "archive"
            ? t("ecommerce.productKnowledge.archiveConfirm", { name: confirmation.name })
            : confirmation?.kind === "unlink"
              ? t("ecommerce.productKnowledge.unlinkConfirm", { name: confirmation.productTitle })
              : t("ecommerce.productKnowledge.unsavedConfirm")
        }
        confirmLabel={
          confirmation?.kind === "archive"
            ? t("ecommerce.productKnowledge.archive")
            : confirmation?.kind === "unlink"
              ? t("ecommerce.productKnowledge.unlink")
              : t("ecommerce.productKnowledge.discardChanges")
        }
        confirmVariant="danger"
      />
    </AffiliatePageFrame>
  );
});
