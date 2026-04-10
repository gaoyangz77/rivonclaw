import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";

interface BrowserProfilesTableProps {
  profiles: GQL.BrowserProfile[];
  selectedIds: Set<string>;
  testingProxy: string | null;
  proxyTestResult: { id: string; ok: boolean; message: string } | null;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onEdit: (profile: GQL.BrowserProfile) => void;
  onTestProxy: (id: string) => void;
  onArchive: (profile: GQL.BrowserProfile) => void;
  onUnarchive: (profile: GQL.BrowserProfile) => void;
  onDelete: (profile: GQL.BrowserProfile) => void;
  onBatchArchive: () => void;
  onBatchDelete: () => void;
  onDismissProxyResult: () => void;
}

export function BrowserProfilesTable({
  profiles,
  selectedIds,
  testingProxy,
  proxyTestResult,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onEdit,
  onTestProxy,
  onArchive,
  onUnarchive,
  onDelete,
  onBatchArchive,
  onBatchDelete,
  onDismissProxyResult,
}: BrowserProfilesTableProps) {
  const { t } = useTranslation();
  return (
    <>
      {selectedIds.size > 0 && (
        <div className="bp-batch-bar">
          <span className="bp-batch-count">
            {t("browserProfiles.selectedCount", { count: selectedIds.size })}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onBatchArchive}
            type="button"
          >
            {t("browserProfiles.batchArchive")}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={onBatchDelete}
            type="button"
          >
            {t("browserProfiles.batchDelete")}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClearSelection}
            type="button"
          >
            {t("browserProfiles.clearSelection")}
          </button>
        </div>
      )}

      <table className="bp-table">
        <thead>
          <tr>
            <th className="bp-col-checkbox">
              <input
                type="checkbox"
                checked={profiles.length > 0 && selectedIds.size === profiles.length}
                onChange={onToggleSelectAll}
              />
            </th>
            <th>{t("browserProfiles.colName")}</th>
            <th>{t("browserProfiles.colProxy")}</th>
            <th>{t("browserProfiles.colSession")}</th>
            <th>{t("browserProfiles.colStatus")}</th>
            <th>{t("browserProfiles.colTags")}</th>
            <th>{t("browserProfiles.colActions")}</th>
          </tr>
        </thead>
        <tbody>
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={7} className="centered-muted">
                {t("browserProfiles.noMatchingProfiles")}
              </td>
            </tr>
          ) : profiles.map((p) => (
            <tr key={p.id} className={p.status === "ARCHIVED" ? "bp-row-archived" : ""}>
              <td className="bp-col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => onToggleSelect(p.id)}
                />
              </td>
              <td className="bp-cell-name">{p.name}</td>
              <td>
                {p.proxyPolicy.enabled ? (
                  <span className="badge badge-active">
                    {t("browserProfiles.proxyOn")}
                  </span>
                ) : (
                  <span className="badge badge-muted">
                    {t("browserProfiles.proxyOff")}
                  </span>
                )}
              </td>
              <td>
                {p.sessionStatePolicy?.enabled !== false ? (
                  <span className="badge badge-active">
                    {(p.sessionStatePolicy?.storage ?? "local").charAt(0).toUpperCase() +
                      (p.sessionStatePolicy?.storage ?? "local").slice(1)}
                  </span>
                ) : (
                  <span className="badge badge-muted">
                    {t("browserProfiles.sessionOff")}
                  </span>
                )}
              </td>
              <td>
                <span
                  className={`badge ${
                    p.status === "ACTIVE"
                      ? "badge-success"
                      : p.status === "DISABLED"
                        ? "badge-warning"
                        : "badge-muted"
                  }`}
                >
                  {t(`browserProfiles.status_${p.status.toLowerCase()}`)}
                </span>
              </td>
              <td className="td-meta">
                {p.tags && p.tags.length > 0 ? p.tags.join(", ") : "-"}
              </td>
              <td className="td-actions">
                {p.status !== "ARCHIVED" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEdit(p)}
                    type="button"
                  >
                    {t("common.edit")}
                  </button>
                )}
                {p.proxyPolicy.enabled && p.status !== "ARCHIVED" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onTestProxy(p.id)}
                    disabled={testingProxy === p.id}
                    type="button"
                  >
                    {testingProxy === p.id
                      ? t("browserProfiles.testing")
                      : t("browserProfiles.testProxy")}
                  </button>
                )}
                {p.status === "ARCHIVED" ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onUnarchive(p)}
                    title={t("browserProfiles.unarchiveTooltip")}
                    type="button"
                  >
                    {t("browserProfiles.unarchive")}
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onArchive(p)}
                    title={t("browserProfiles.archiveTooltip")}
                    type="button"
                  >
                    {t("browserProfiles.archive")}
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDelete(p)}
                  type="button"
                >
                  {t("browserProfiles.delete")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Proxy test result banner */}
      {proxyTestResult && (
        <div
          className={`bp-proxy-result ${proxyTestResult.ok ? "bp-proxy-result-ok" : "bp-proxy-result-fail"}`}
        >
          <span>
            {proxyTestResult.ok
              ? t("browserProfiles.proxyTestSuccess")
              : t("browserProfiles.proxyTestFail")}
            {": "}
            {proxyTestResult.message}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onDismissProxyResult}
            type="button"
          >
            {t("common.close")}
          </button>
        </div>
      )}
    </>
  );
}
