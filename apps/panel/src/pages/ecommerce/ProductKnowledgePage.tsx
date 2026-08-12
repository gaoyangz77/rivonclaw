import { useEffect, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  CheckIcon,
  CopyIcon,
  EcommerceIcon,
  RefreshIcon,
  ShopIcon,
} from "../../components/icons.js";
import { MarkdownMessage } from "../../components/markdown/MarkdownMessage.js";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { BEFORE_NAVIGATE_EVENT } from "../../lib/navigation-guard.js";
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

const MARKDOWN_MAX_LENGTH = 50_000;
const PAGE_SIZE = 25;

type KnowledgeSummary = Omit<GQL.ProductKnowledge, "bindings">;
type KnowledgeDraft = {
  name: string;
  usageInstructionsMarkdown: string;
  qaMarkdown: string;
  creativeCasesMarkdown: string;
};
type ContentTab = "usage" | "qa" | "cases";
type EditorMode = "edit" | "preview";
type Confirmation =
  | { kind: "archive"; id: string; name: string; revision: number }
  | { kind: "unlink"; bindingId: string; productTitle: string }
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
  return draft.name !== knowledge.name ||
    draft.usageInstructionsMarkdown !== knowledge.usageInstructionsMarkdown ||
    draft.qaMarkdown !== knowledge.qaMarkdown ||
    draft.creativeCasesMarkdown !== knowledge.creativeCasesMarkdown;
}

function candidateKey(candidate: Pick<GQL.SellerSkuProductCandidate, "shopId" | "productId">): string {
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
  const [status, setStatus] = useState<GQL.ProductKnowledgeStatus>(GQL.ProductKnowledgeStatus.Active);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<ContentTab>("usage");
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
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
  const discoveryPayload = discoveryKnowledgeId === selectedId
    ? discovery.data?.discoverProductsBySellerSku
    : undefined;
  const candidates = discoveryPayload?.candidates ?? [];
  const selectableCandidates = candidates.filter((candidate) =>
    !candidate.existingProductKnowledgeId || candidate.existingProductKnowledgeId === selectedId,
  );

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId("");
      setDraft(null);
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

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
      if (!window.confirm(t("ecommerce.productKnowledge.unsavedConfirm"))) {
        event.preventDefault();
      }
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
    if (!allowDiscardDraft()) return;
    resetSelection();
    setSelectedId(id);
  }

  function allowDiscardDraft(): boolean {
    return !dirty || window.confirm(t("ecommerce.productKnowledge.unsavedConfirm"));
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
    if (!allowDiscardDraft()) return;
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
      await listQuery.refetch({ input: {
        status: GQL.ProductKnowledgeStatus.Active,
        search: null,
        offset: 0,
        limit: PAGE_SIZE,
      } });
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
      if (errorCode(error) === "PRODUCT_KNOWLEDGE_REVISION_STALE" ||
        errorMessage(error).includes("PRODUCT_KNOWLEDGE_REVISION_STALE") ||
        errorMessage(error).includes("revision is stale")) {
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
      await archiveKnowledge({ variables: {
        id: confirmation.id,
        expectedRevision: confirmation.revision,
      } });
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
      await restoreKnowledge({ variables: {
        id: knowledge.id,
        expectedRevision: knowledge.revision,
      } });
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
    const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => selectedCandidates.has(key));
    setSelectedCandidates(allSelected ? new Set() : new Set(selectableKeys));
  }

  async function handleLinkProducts() {
    if (!knowledge || selectedCandidates.size === 0) return;
    const products = candidates
      .filter((candidate) => selectedCandidates.has(candidateKey(candidate)))
      .map((candidate) => ({ shopId: candidate.shopId, productId: candidate.productId }));
    try {
      const result = await linkProducts({ variables: {
        input: { productKnowledgeId: knowledge.id, products },
      } });
      const payload = result.data?.linkProductsToKnowledge;
      if (!payload) throw new Error(t("ecommerce.productKnowledge.linkFailed"));
      setSelectedCandidates(new Set());
      setLinkFailures(payload.failures);
      await Promise.all([detailQuery.refetch(), listQuery.refetch(), runDiscovery(false)]);
      if (payload.failures.length > 0) {
        showToast(t("ecommerce.productKnowledge.linkPartial", {
          linked: payload.linked.length,
          failed: payload.failures.length,
        }), "warning");
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

  if (authChecking) {
    return <div className="page-enter"><div className="section-card"><p>{t("common.loading")}</p></div></div>;
  }
  if (!user) {
    return (
      <div className="page-enter"><div className="section-card">
        <h2>{t("auth.loginRequired")}</h2><p>{t("auth.loginFromSidebar")}</p>
      </div></div>
    );
  }

  const tabConfig: Array<{ id: ContentTab; label: string; field: keyof KnowledgeDraft }> = [
    { id: "usage", label: t("ecommerce.productKnowledge.usageInstructions"), field: "usageInstructionsMarkdown" },
    { id: "qa", label: t("ecommerce.productKnowledge.qa"), field: "qaMarkdown" },
    { id: "cases", label: t("ecommerce.productKnowledge.creativeCases"), field: "creativeCasesMarkdown" },
  ];
  const activeTabConfig = tabConfig.find((tab) => tab.id === activeTab)!;
  const activeMarkdown = draft?.[activeTabConfig.field] ?? "";
  const groupedCandidates = candidates.reduce<Record<string, GQL.SellerSkuProductCandidate[]>>((groups, candidate) => {
    (groups[candidate.shopId] ??= []).push(candidate);
    return groups;
  }, {});

  return (
    <div className="page-enter product-knowledge-page">
      <header className="ecommerce-page-header" data-tutorial-id="product-knowledge-header">
        <div className="product-knowledge-title-block">
          <span className="product-knowledge-kicker"><EcommerceIcon size={14} />{t("ecommerce.productKnowledge.kicker")}</span>
          <h1>{t("ecommerce.productKnowledge.pageTitle")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.productKnowledge.pageSubtitle")}</p>
        </div>
        <button className="btn btn-primary" data-tutorial-id="product-knowledge-create" onClick={() => setCreateOpen(true)}>
          + {t("ecommerce.productKnowledge.create")}
        </button>
      </header>

      <div className="product-knowledge-workbench" data-tutorial-id="product-knowledge-library">
        <aside className="product-knowledge-library">
          <div className="product-knowledge-library-tools">
            <form onSubmit={(event) => {
              event.preventDefault();
              const nextSearch = searchDraft.trim();
              if (nextSearch === search || !allowDiscardDraft()) return;
              resetSelection();
              setOffset(0);
              setSearch(nextSearch);
            }}>
              <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("ecommerce.productKnowledge.searchPlaceholder")} />
            </form>
            <div className="product-knowledge-status-switch">
              <button className={status === GQL.ProductKnowledgeStatus.Active ? "active" : ""} onClick={() => { if (status !== GQL.ProductKnowledgeStatus.Active && allowDiscardDraft()) { resetSelection(); setStatus(GQL.ProductKnowledgeStatus.Active); setOffset(0); } }}>{t("ecommerce.productKnowledge.active")}</button>
              <button className={status === GQL.ProductKnowledgeStatus.Archived ? "active" : ""} onClick={() => { if (status !== GQL.ProductKnowledgeStatus.Archived && allowDiscardDraft()) { resetSelection(); setStatus(GQL.ProductKnowledgeStatus.Archived); setOffset(0); } }}>{t("ecommerce.productKnowledge.archivedStatus")}</button>
            </div>
          </div>

          <div className="product-knowledge-list">
            {listQuery.loading && items.length === 0 ? <p className="td-meta">{t("common.loading")}</p> : null}
            {!listQuery.loading && items.length === 0 ? (
              <div className="product-knowledge-empty-mini">
                <EcommerceIcon size={22} />
                <strong>{t("ecommerce.productKnowledge.emptyTitle")}</strong>
                <span>{t("ecommerce.productKnowledge.emptyBody")}</span>
              </div>
            ) : null}
            {items.map((item) => {
              const completion = [item.usageInstructionsMarkdown, item.qaMarkdown, item.creativeCasesMarkdown].filter((value) => value.trim()).length;
              return (
                <button key={item.id} className={`product-knowledge-list-item${selectedId === item.id ? " active" : ""}`} onClick={() => selectKnowledge(item.id)}>
                  <span className="product-knowledge-list-item-top"><strong>{item.name}</strong><span>{completion}/3</span></span>
                  <span className="product-knowledge-list-item-meta">
                    <span><ShopIcon size={13} />{t("ecommerce.productKnowledge.productCount", { count: item.bindingCount })}</span>
                    <time>{new Date(item.updatedAt).toLocaleDateString(i18n.language)}</time>
                  </span>
                </button>
              );
            })}
          </div>

          {totalCount > PAGE_SIZE ? (
            <div className="product-knowledge-pagination">
              <button className="btn btn-secondary" disabled={offset === 0} onClick={() => { if (allowDiscardDraft()) { resetSelection(); setOffset(Math.max(0, offset - PAGE_SIZE)); } }}>{t("ecommerce.productKnowledge.previous")}</button>
              <span>{Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(totalCount / PAGE_SIZE)}</span>
              <button className="btn btn-secondary" disabled={offset + PAGE_SIZE >= totalCount} onClick={() => { if (allowDiscardDraft()) { resetSelection(); setOffset(offset + PAGE_SIZE); } }}>{t("ecommerce.productKnowledge.next")}</button>
            </div>
          ) : null}
        </aside>

        <main className="product-knowledge-detail" data-tutorial-id="product-knowledge-editor">
          {!selectedId ? (
            <div className="product-knowledge-detail-empty">
              <EcommerceIcon size={30} />
              <h2>{t("ecommerce.productKnowledge.selectTitle")}</h2>
              <p>{t("ecommerce.productKnowledge.selectBody")}</p>
            </div>
          ) : detailQuery.loading && !knowledge ? (
            <div className="product-knowledge-detail-empty"><p>{t("common.loading")}</p></div>
          ) : knowledge && draft ? (
            <>
              <div className="product-knowledge-detail-header">
                <div className="product-knowledge-name-field">
                  <label htmlFor="product-knowledge-name">{t("ecommerce.productKnowledge.name")}</label>
                  <input id="product-knowledge-name" value={draft.name} maxLength={120} readOnly={isArchived} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </div>
                <div className="product-knowledge-detail-actions">
                  {dirty ? <span className="badge badge-warning">{t("ecommerce.productKnowledge.unsaved")}</span> : <span className="badge badge-muted">v{knowledge.revision}</span>}
                  {isArchived ? (
                    <button className="btn btn-primary" disabled={restoreState.loading} onClick={handleRestore}>{t("ecommerce.productKnowledge.restore")}</button>
                  ) : (
                    <>
                      <button className="btn btn-secondary" disabled={archiveState.loading || dirty} onClick={() => setConfirmation({ kind: "archive", id: knowledge.id, name: knowledge.name, revision: knowledge.revision })}>{t("ecommerce.productKnowledge.archive")}</button>
                      <button className="btn btn-primary" disabled={!dirty || updateState.loading || !draft.name.trim()} onClick={handleSave}>{updateState.loading ? t("common.saving") : t("common.save")}</button>
                    </>
                  )}
                </div>
              </div>

              {staleConflict ? (
                <div className="product-knowledge-conflict-banner">
                  <div><strong>{t("ecommerce.productKnowledge.staleTitle")}</strong><span>{t("ecommerce.productKnowledge.staleBody")}</span></div>
                  <div>
                    <button className="btn btn-secondary" onClick={() => { if (knowledge) { setDraft(draftFromKnowledge(knowledge)); setDraftRevision(knowledge.revision); setStaleConflict(false); } }}>{t("ecommerce.productKnowledge.useServerVersion")}</button>
                    <button className="btn btn-outline" onClick={() => { if (knowledge) { setDraftRevision(knowledge.revision); setStaleConflict(false); } }}>{t("ecommerce.productKnowledge.keepDraft")}</button>
                  </div>
                </div>
              ) : null}

              <section className="product-knowledge-editor-card">
                <div className="product-knowledge-editor-toolbar">
                  <div className="product-knowledge-tabs">
                    {tabConfig.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
                  </div>
                  <div className="product-knowledge-mode-switch">
                    <button className={editorMode === "edit" ? "active" : ""} onClick={() => setEditorMode("edit")}>{t("common.edit")}</button>
                    <button className={editorMode === "preview" ? "active" : ""} onClick={() => setEditorMode("preview")}>{t("ecommerce.productKnowledge.preview")}</button>
                  </div>
                </div>
                {editorMode === "edit" ? (
                  <div className="product-knowledge-editor-body">
                    <textarea
                      value={activeMarkdown}
                      readOnly={isArchived}
                      maxLength={MARKDOWN_MAX_LENGTH}
                      placeholder={t(`ecommerce.productKnowledge.${activeTab}Placeholder`)}
                      onChange={(event) => setDraft({ ...draft, [activeTabConfig.field]: event.target.value })}
                    />
                    <span className={activeMarkdown.length >= MARKDOWN_MAX_LENGTH ? "limit" : ""}>{activeMarkdown.length.toLocaleString()} / {MARKDOWN_MAX_LENGTH.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="product-knowledge-markdown-preview">
                    {activeMarkdown.trim() ? <MarkdownMessage text={activeMarkdown} /> : <p>{t("ecommerce.productKnowledge.previewEmpty")}</p>}
                  </div>
                )}
              </section>

              <section className="product-knowledge-bindings" data-tutorial-id="product-knowledge-bindings">
                <div className="product-knowledge-section-heading">
                  <div><span className="product-knowledge-section-index">02</span><div><h2>{t("ecommerce.productKnowledge.bindingsTitle")}</h2><p>{t("ecommerce.productKnowledge.bindingsSubtitle")}</p></div></div>
                  <span className="badge badge-info">{t("ecommerce.productKnowledge.productCount", { count: knowledge.bindingCount })}</span>
                </div>

                {knowledge.bindings.length > 0 ? (
                  <div className="product-knowledge-bound-grid">
                    {knowledge.bindings.map((binding) => (
                      <article className="product-knowledge-bound-card" key={binding.id}>
                        {binding.productCoverImageSnapshot ? <img src={binding.productCoverImageSnapshot} alt="" /> : <div className="product-knowledge-image-placeholder"><ShopIcon /></div>}
                        <div><strong>{binding.productTitleSnapshot}</strong><span>{binding.shopNameSnapshot}{binding.shopRegionSnapshot ? ` · ${binding.shopRegionSnapshot}` : ""}</span><code>{binding.productId}</code><small>{binding.sellerSkusSnapshot.join(" · ") || t("ecommerce.productKnowledge.noSellerSku")}{binding.productStatusSnapshot ? ` · ${binding.productStatusSnapshot}` : ""}</small></div>
                        <button className="btn btn-secondary" onClick={() => setConfirmation({ kind: "unlink", bindingId: binding.id, productTitle: binding.productTitleSnapshot })}>{t("ecommerce.productKnowledge.unlink")}</button>
                      </article>
                    ))}
                  </div>
                ) : <p className="product-knowledge-no-bindings">{t("ecommerce.productKnowledge.noBindings")}</p>}

                {!isArchived ? (
                  <div className="product-knowledge-discovery">
                    <div className="product-knowledge-discovery-form">
                      <div><label htmlFor="seller-sku-search">{t("ecommerce.productKnowledge.sellerSku")}</label><span>{t("ecommerce.productKnowledge.sellerSkuHint")}</span></div>
                      <form onSubmit={(event) => { event.preventDefault(); void runDiscovery(); }}>
                        <input id="seller-sku-search" value={sellerSku} onChange={(event) => {
                          setSellerSku(event.target.value);
                          setDiscoveryKnowledgeId("");
                          setSelectedCandidates(new Set());
                          setLinkFailures([]);
                        }} placeholder={t("ecommerce.productKnowledge.sellerSkuPlaceholder")} />
                        <button className="btn btn-primary" disabled={!sellerSku.trim() || discovery.loading} type="submit">{discovery.loading ? t("ecommerce.productKnowledge.searching") : t("ecommerce.productKnowledge.discover")}</button>
                      </form>
                    </div>

                    {discoveryPayload ? (
                      <div className="product-knowledge-discovery-results">
                        <div className="product-knowledge-results-summary">
                          <span>{t("ecommerce.productKnowledge.searchSummary", { found: candidates.length, successful: discoveryPayload.successfulShopCount, total: discoveryPayload.searchedShopCount })}</span>
                          {selectableCandidates.some((candidate) => !candidate.existingProductKnowledgeId) ? <button className="btn btn-secondary" onClick={toggleAllCandidates}>{t("ecommerce.productKnowledge.selectAll")}</button> : null}
                        </div>
                        {discoveryPayload.shopFailures.length > 0 ? (
                          <div className="product-knowledge-shop-failures">
                            <strong>{t("ecommerce.productKnowledge.partialFailure")}</strong>
                            {discoveryPayload.shopFailures.map((failure) => <span key={failure.shopId}>{failure.shopName}: {failure.message}</span>)}
                            <button className="btn btn-secondary" onClick={() => void runDiscovery()}><RefreshIcon />{t("common.refresh")}</button>
                          </div>
                        ) : null}
                        {linkFailures.length > 0 ? (
                          <div className="product-knowledge-link-failures">
                            <strong>{t("ecommerce.productKnowledge.linkFailureTitle")}</strong>
                            {linkFailures.map((failure) => (
                              <span key={`${failure.shopId}:${failure.productId}`}>
                                <code>{failure.productId}</code> · {failure.existingProductKnowledgeName
                                  ? t("ecommerce.productKnowledge.boundElsewhere", { name: failure.existingProductKnowledgeName })
                                  : failure.message}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {Object.entries(groupedCandidates).map(([shopId, shopCandidates]) => (
                          <div className="product-knowledge-shop-group" key={shopId}>
                            <h3><ShopIcon size={15} />{shopCandidates[0].shopName}<span>{shopCandidates[0].shopRegion}</span></h3>
                            {shopCandidates.map((candidate) => {
                              const key = candidateKey(candidate);
                              const boundElsewhere = Boolean(candidate.existingProductKnowledgeId && candidate.existingProductKnowledgeId !== selectedId);
                              const boundHere = candidate.existingProductKnowledgeId === selectedId;
                              return (
                                <label className={`product-knowledge-candidate${boundElsewhere ? " disabled" : ""}`} key={key}>
                                  <input type="checkbox" disabled={boundElsewhere || boundHere} checked={boundHere || selectedCandidates.has(key)} onChange={() => toggleCandidate(key)} />
                                  {candidate.productCoverImage ? <img src={candidate.productCoverImage} alt="" /> : <span className="product-knowledge-image-placeholder"><ShopIcon /></span>}
                                  <span className="product-knowledge-candidate-copy"><strong>{candidate.productTitle}</strong><span>{candidate.sellerSkus.join(" · ")}{candidate.productStatus ? ` · ${candidate.productStatus}` : ""}</span><code>{candidate.productId}</code></span>
                                  <button type="button" className="product-knowledge-copy-id" title={t("common.copy")} onClick={(event) => { event.preventDefault(); void navigator.clipboard.writeText(candidate.productId); showToast(t("common.copied")); }}><CopyIcon /></button>
                                  {boundHere ? <span className="badge badge-success"><CheckIcon />{t("ecommerce.productKnowledge.linkedHere")}</span> : null}
                                  {boundElsewhere ? <span className="badge badge-warning">{t("ecommerce.productKnowledge.boundElsewhere", { name: candidate.existingProductKnowledgeName })}</span> : null}
                                </label>
                              );
                            })}
                          </div>
                        ))}
                        {candidates.length === 0 && discoveryPayload.shopFailures.length === 0 ? <p className="product-knowledge-no-results">{t("ecommerce.productKnowledge.noResults", { sku: discoveryPayload.sellerSku })}</p> : null}
                        {selectedCandidates.size > 0 ? <div className="product-knowledge-link-bar"><span>{t("ecommerce.productKnowledge.selectedCount", { count: selectedCandidates.size })}</span><button className="btn btn-primary" disabled={linkState.loading} onClick={handleLinkProducts}>{t("ecommerce.productKnowledge.linkSelected")}</button></div> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </main>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t("ecommerce.productKnowledge.createTitle")} maxWidth={480} portal>
        <label className="form-label-block"><span>{t("ecommerce.productKnowledge.name")}</span><input autoFocus value={createName} maxLength={120} onChange={(event) => setCreateName(event.target.value)} placeholder={t("ecommerce.productKnowledge.namePlaceholder")} /></label>
        <p className="form-hint">{t("ecommerce.productKnowledge.createHint")}</p>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</button><button className="btn btn-primary" disabled={!createName.trim() || createState.loading} onClick={handleCreate}>{createState.loading ? t("common.saving") : t("ecommerce.productKnowledge.create")}</button></div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmation)}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => confirmation?.kind === "archive" ? void handleArchive() : void handleUnlink()}
        title={confirmation?.kind === "archive" ? t("ecommerce.productKnowledge.archiveTitle") : t("ecommerce.productKnowledge.unlinkTitle")}
        message={confirmation?.kind === "archive" ? t("ecommerce.productKnowledge.archiveConfirm", { name: confirmation.name }) : t("ecommerce.productKnowledge.unlinkConfirm", { name: confirmation?.productTitle })}
        confirmLabel={confirmation?.kind === "archive" ? t("ecommerce.productKnowledge.archive") : t("ecommerce.productKnowledge.unlink")}
        confirmVariant="danger"
      />
    </div>
  );
});
