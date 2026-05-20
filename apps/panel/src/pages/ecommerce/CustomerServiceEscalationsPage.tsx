import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { CheckIcon, CopyIcon, InfoIcon } from "../../components/icons.js";
import { fetchJson } from "../../api/client.js";
import { CS_OPEN_ESCALATIONS_QUERY } from "../../api/shops-queries.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";

type Escalation = GQL.CsEscalation;
type StatusFilter = "open" | "pending" | "inProgress" | "resolved" | "closed" | "all";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

interface CsEscalationEventPayload {
  delivery?: {
    escalation?: Escalation;
  };
}

export const CustomerServiceEscalationsPage = observer(function CustomerServiceEscalationsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Escalation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guidance, setGuidance] = useState("");
  const [resolved, setResolved] = useState(true);
  const [responding, setResponding] = useState(false);
  const [copiedMeta, setCopiedMeta] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = useMemo(
    () => [
      { value: "", label: t("ecommerce.customerServiceWorkspace.allShops") },
      ...shops
        .filter((shop) => shop.services?.customerService?.enabled)
        .map((shop) => ({
          value: shop.id,
          label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
        })),
    ],
    [shops, t],
  );

  const { data, loading, refetch } = useQuery<
    { csOpenEscalationsPage: GQL.CsOpenEscalationPage },
    { filter: GQL.CsOpenEscalationFilterInput }
  >(CS_OPEN_ESCALATIONS_QUERY, {
    variables: {
      filter: {
        shopIds: selectedShopId ? [selectedShopId] : undefined,
        statuses: statusesForFilter(statusFilter),
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user,
  });

  useEffect(() => {
    const pageData = data?.csOpenEscalationsPage;
    if (!pageData) return;
    setItems(sortEscalations(pageData.items));
    setTotal(pageData.total);
  }, [data?.csOpenEscalationsPage]);

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [selectedShopId, statusFilter, search, pageSize]);

  useEffect(() => {
    return panelEventBus.subscribe("cs-escalation-event", (raw) => {
      const escalation = readEscalation(raw);
      if (!escalation) return;
      setItems((current) => {
        if (page !== 1) return current;
        const next = current.filter((item) => item.id !== escalation.id);
        if (matchesFilters(escalation, { selectedShopId, statusFilter, search })) {
          next.push(escalation);
        }
        return sortEscalations(next).slice(0, pageSize);
      });
      refetch().catch(() => {});
    });
  }, [page, pageSize, refetch, search, selectedShopId, statusFilter]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const selectedIndex = selected ? items.findIndex((item) => item.id === selected.id) : -1;
  const hasPreviousEscalation = selectedIndex > 0;
  const hasNextEscalation = selectedIndex >= 0 && selectedIndex < items.length - 1;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    if (!selected) {
      setSelectedId(null);
      return;
    }
    if (selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
    setGuidance(resultGuidance(selected.result));
    setResolved(selected.status !== GQL.CsEscalationStatus.InProgress);
  }, [selected?.id, selected?.version, selectedId]);

  async function respondToEscalation() {
    const guidanceText = guidance.trim();
    if (!selected || !guidanceText) return;
    setResponding(true);
    try {
      const result = await fetchJson<{
        ok: boolean;
        escalationId?: string | null;
        status?: GQL.CsEscalationStatus | null;
        version?: number | null;
        error?: string | null;
      }>(clientPath(API["csBridge.escalationResult"]), {
        method: "POST",
        body: JSON.stringify({
          escalationId: selected.id,
          decision: guidanceText,
          instructions: "",
          resolved,
        }),
      });
      if (!result.ok) throw new Error(result.error ?? t("ecommerce.updateFailed"));
      showToast(t("ecommerce.customerServiceWorkspace.respondSuccess"), "success");
      if (resolved) {
        const nextId = nextEscalationId(selected.id, items);
        setItems((current) => current.filter((item) => item.id !== selected.id));
        setTotal((current) => Math.max(0, current - 1));
        setSelectedId(nextId);
      }
      refetch().catch(() => {});
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    } finally {
      setResponding(false);
    }
  }

  function goToPreviousEscalation() {
    if (!hasPreviousEscalation) return;
    setSelectedId(items[selectedIndex - 1].id);
  }

  function goToNextEscalation() {
    if (!hasNextEscalation) return;
    setSelectedId(items[selectedIndex + 1].id);
  }

  async function copyMeta(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setCopiedMeta(`${label}:${value}`);
      window.setTimeout(() => setCopiedMeta(null), 1400);
    } catch {
      showToast(t("ecommerce.customerServiceWorkspace.copyFailed"), "error");
    }
  }

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(total, (page - 1) * pageSize + items.length);
  const statusOptions = [
    { value: "open", label: t("ecommerce.customerServiceWorkspace.statusOpen") },
    { value: "pending", label: t("ecommerce.customerServiceWorkspace.statusPending") },
    { value: "inProgress", label: t("ecommerce.customerServiceWorkspace.statusInProgress") },
    { value: "resolved", label: t("ecommerce.customerServiceWorkspace.statusResolved") },
    { value: "closed", label: t("ecommerce.customerServiceWorkspace.statusClosed") },
    { value: "all", label: t("ecommerce.customerServiceWorkspace.statusAll") },
  ];
  const pageSizeOptions = PAGE_SIZE_OPTIONS.map((value) => ({
    value: String(value),
    label: t("ecommerce.customerServiceWorkspace.pageSize", { count: value }),
  }));
  const activeSearch = Boolean(search);

  function applySearch() {
    setSearch(searchDraft.trim());
  }

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  function buyerLabel(escalation: Escalation): string {
    return escalation.buyerNickname?.trim() || escalation.buyerUserId;
  }

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
          <h1>{t("ecommerce.customerServiceWorkspace.title")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.customerServiceWorkspace.subtitle")}</p>
        </div>
      </div>

      <div className="cs-escalation-workspace">
        <div className="cs-escalation-toolbar">
          <div className="cs-escalation-kpis">
            <div className="cs-escalation-kpi-primary">
              <span>{t("ecommerce.customerServiceWorkspace.statusOpen")}</span>
              <strong>{total}</strong>
            </div>
            <div className="cs-escalation-kpi-note">{t("ecommerce.customerServiceWorkspace.queueHint")}</div>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => void refetch()} disabled={loading}>
            {loading ? t("common.loading") : t("ecommerce.customerServiceWorkspace.refresh")}
          </button>
        </div>

        <div className="cs-escalation-filter-bar">
          <div className="cs-escalation-filter-grid">
            <Select
              value={selectedShopId}
              onChange={setSelectedShopId}
              options={shopOptions}
              className="cs-escalation-shop-select"
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={statusOptions}
              className="cs-escalation-status-select"
            />
            <div className="cs-escalation-search">
              <input
                className="input-full"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
                placeholder={t("ecommerce.customerServiceWorkspace.searchPlaceholder")}
              />
              <button className="btn btn-secondary" type="button" onClick={applySearch}>
                {t("ecommerce.customerServiceWorkspace.search")}
              </button>
            </div>
            <Select
              value={String(pageSize)}
              onChange={(value) => setPageSize(Number(value))}
              options={pageSizeOptions}
              className="cs-escalation-page-size-select"
            />
          </div>
          {activeSearch && (
            <button
              className="cs-escalation-search-chip"
              type="button"
              onClick={() => {
                setSearch("");
                setSearchDraft("");
              }}
            >
              {search} x
            </button>
          )}
        </div>

        {loading && items.length === 0 ? (
          <div className="affiliate-proposal-empty">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="affiliate-proposal-empty">{t("ecommerce.customerServiceWorkspace.empty")}</div>
        ) : (
          <div className="cs-escalation-listing">
            <div className="cs-escalation-page-summary">
              <span>
                {t("ecommerce.customerServiceWorkspace.pageSummary", {
                  start: pageStart,
                  end: pageEnd,
                  total,
                  page,
                  pages: pageCount,
                })}
              </span>
            </div>
            <div className="cs-escalation-table" role="table">
              <div className="cs-escalation-table-head" role="row">
                <span>{t("ecommerce.customerServiceWorkspace.reason")}</span>
                <span>{t("ecommerce.customerServiceWorkspace.statusOpen")}</span>
                <span>{t("ecommerce.customerServiceWorkspace.updatedAt")}</span>
              </div>
              {items.map((item) => (
                <button
                  className="cs-escalation-row"
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="cs-escalation-row-main">
                    <strong>{item.id}</strong>
                    <span>{item.reason}</span>
                    <small>{shopLabel(item.shopId)} - {buyerLabel(item)}</small>
                  </span>
                  <span>
                    <span className={item.status === GQL.CsEscalationStatus.Pending ? "badge badge-warning" : "badge badge-info"}>
                      {statusLabel(item.status, t)}
                    </span>
                  </span>
                  <span>{formatCompactDateTime(item.updatedAt)}</span>
                </button>
              ))}
            </div>
            <div className="cs-escalation-pagination">
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
              >
                {t("ecommerce.customerServiceWorkspace.previous")}
              </button>
              <span>{t("ecommerce.customerServiceWorkspace.page", { page, pages: pageCount })}</span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount || loading}
              >
                {t("ecommerce.customerServiceWorkspace.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.id : t("ecommerce.customerServiceWorkspace.title")}
        maxWidth={920}
      >
        {selected && (
          <div className="cs-escalation-modal">
            <section className="cs-escalation-detail">
                <div className="cs-escalation-detail-head">
                  <div>
                    <div className="cs-escalation-detail-title">{selected.id}</div>
                    <div className="cs-escalation-detail-subtitle">
                      <span>{shopLabel(selected.shopId)}</span>
                      <span>{buyerLabel(selected)}</span>
                      <span>{t("ecommerce.customerServiceWorkspace.version", { version: selected.version })}</span>
                      <span>{formatCompactDateTime(selected.updatedAt)}</span>
                    </div>
                  </div>
                  <span className={selected.status === GQL.CsEscalationStatus.Pending ? "badge badge-warning" : "badge badge-info"}>
                    {statusLabel(selected.status, t)}
                  </span>
                </div>

                <div className="cs-escalation-block">
                  <div className="drawer-section-label">{t("ecommerce.customerServiceWorkspace.reason")}</div>
                  <p>{selected.reason}</p>
                </div>
                {selected.context && (
                  <div className="cs-escalation-block">
                    <div className="drawer-section-label">{t("ecommerce.customerServiceWorkspace.context")}</div>
                    <pre>{selected.context}</pre>
                  </div>
                )}

                <div className="cs-escalation-meta-actions">
                  <CopyMetaButton
                    label={t("ecommerce.customerServiceWorkspace.conversation")}
                    value={selected.conversationId}
                    copied={copiedMeta === `${t("ecommerce.customerServiceWorkspace.conversation")}:${selected.conversationId}`}
                    onCopy={copyMeta}
                  />
                  <CopyMetaButton
                    label={t("ecommerce.customerServiceWorkspace.buyer")}
                    value={selected.buyerUserId}
                    copied={copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyer")}:${selected.buyerUserId}`}
                    onCopy={copyMeta}
                  />
                  {selected.orderId && (
                    <CopyMetaButton
                      label={t("ecommerce.customerServiceWorkspace.order")}
                      value={selected.orderId}
                      copied={copiedMeta === `${t("ecommerce.customerServiceWorkspace.order")}:${selected.orderId}`}
                      onCopy={copyMeta}
                    />
                  )}
                  <span className="cs-escalation-created-at">
                    {t("ecommerce.customerServiceWorkspace.createdAt")} {formatDateTime(selected.createdAt)}
                  </span>
                </div>

                <div className="cs-response-form">
                  <label className="form-label-block">{t("ecommerce.customerServiceWorkspace.managerGuidance")}</label>
                  <textarea
                    className="input-full textarea-resize-vertical"
                    rows={6}
                    value={guidance}
                    onChange={(event) => setGuidance(event.target.value)}
                    placeholder={t("ecommerce.customerServiceWorkspace.managerGuidancePlaceholder")}
                  />
                  <label className="form-checkbox-row cs-resolved-toggle">
                    <input type="checkbox" checked={resolved} onChange={(event) => setResolved(event.target.checked)} />
                    <span className="form-checkbox-label">{t("ecommerce.customerServiceWorkspace.markResolved")}</span>
                    <span
                      className="has-tooltip cs-final-decision-help"
                      data-tooltip={t("ecommerce.customerServiceWorkspace.finalDecisionTooltip")}
                      aria-label={t("ecommerce.customerServiceWorkspace.finalDecisionTooltip")}
                    >
                      <InfoIcon size={14} />
                    </span>
                  </label>
                  <div className="cs-escalation-actions">
                    <div className="cs-escalation-modal-nav">
                      <button className="btn btn-secondary" type="button" onClick={goToPreviousEscalation} disabled={!hasPreviousEscalation || responding}>
                        {t("ecommerce.customerServiceWorkspace.previousEscalation")}
                      </button>
                      <button className="btn btn-secondary" type="button" onClick={goToNextEscalation} disabled={!hasNextEscalation || responding}>
                        {t("ecommerce.customerServiceWorkspace.nextEscalation")}
                      </button>
                    </div>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={respondToEscalation}
                      disabled={responding || !guidance.trim()}
                    >
                      {responding ? t("common.loading") : t("ecommerce.customerServiceWorkspace.sendResponse")}
                    </button>
                  </div>
                </div>
              </section>
          </div>
        )}
      </Modal>
    </div>
  );
});

function CopyMetaButton({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: (label: string, value: string) => Promise<void>;
}) {
  return (
    <button
      className={`cs-meta-copy${copied ? " cs-meta-copy-copied" : ""}`}
      type="button"
      title={`${label}: ${value}`}
      aria-label={`${label}: ${value}`}
      onClick={() => void onCopy(label, value)}
    >
      <span>{label}</span>
      <code>{shortId(value)}</code>
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
    </button>
  );
}

function readEscalation(raw: unknown): Escalation | null {
  const payload = raw as CsEscalationEventPayload;
  return payload.delivery?.escalation ?? null;
}

function sortEscalations(items: Escalation[]): Escalation[] {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function nextEscalationId(currentId: string, items: Escalation[]): string | null {
  const index = items.findIndex((item) => item.id === currentId);
  if (index < 0) return null;
  return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
}

function resultGuidance(result: Escalation["result"]): string {
  if (!result) return "";
  const decision = result.decision?.trim() ?? "";
  const instructions = result.instructions?.trim() ?? "";
  if (!decision) return instructions;
  if (!instructions || instructions === decision) return decision;
  return `${decision}\n\n${instructions}`;
}

function statusesForFilter(filter: StatusFilter): GQL.CsEscalationStatus[] {
  switch (filter) {
    case "pending":
      return [GQL.CsEscalationStatus.Pending];
    case "inProgress":
      return [GQL.CsEscalationStatus.InProgress];
    case "resolved":
      return [GQL.CsEscalationStatus.Resolved];
    case "closed":
      return [GQL.CsEscalationStatus.Closed];
    case "all":
      return [
        GQL.CsEscalationStatus.Pending,
        GQL.CsEscalationStatus.InProgress,
        GQL.CsEscalationStatus.Resolved,
        GQL.CsEscalationStatus.Closed,
      ];
    case "open":
    default:
      return [GQL.CsEscalationStatus.Pending, GQL.CsEscalationStatus.InProgress];
  }
}

function matchesFilters(
  escalation: Escalation,
  filters: { selectedShopId: string; statusFilter: StatusFilter; search: string },
): boolean {
  if (filters.selectedShopId && escalation.shopId !== filters.selectedShopId) return false;
  if (!statusesForFilter(filters.statusFilter).includes(escalation.status)) return false;
  const search = filters.search.trim().toLowerCase();
  if (!search) return true;
  return [
    escalation.id,
    escalation.reason,
    escalation.context ?? "",
    escalation.conversationId,
    escalation.buyerUserId,
    escalation.orderId ?? "",
  ].some((value) => value.toLowerCase().includes(search));
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatCompactDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function statusLabel(status: GQL.CsEscalationStatus, t: (key: string) => string): string {
  if (status === GQL.CsEscalationStatus.InProgress) return t("ecommerce.customerServiceWorkspace.statusInProgress");
  if (status === GQL.CsEscalationStatus.Resolved) return t("ecommerce.customerServiceWorkspace.statusResolved");
  if (status === GQL.CsEscalationStatus.Closed) return t("ecommerce.customerServiceWorkspace.statusClosed");
  return t("ecommerce.customerServiceWorkspace.statusPending");
}
