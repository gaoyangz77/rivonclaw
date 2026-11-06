import { useRef, useState, type ChangeEvent } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  TkAlert,
  TkBadge,
  TkButton,
  TkModal,
  TkPrivate,
  TkTableFrame,
} from "../../../../components/design-system/index.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import { BadReviewWorkbookError, readBadReviewWorkbook } from "../../bad-review-import.js";

const PREFIX = "ecommerce.badReview.import";
const ROW_CLASSES = Object.values(GQL.BadReviewImportRowClass);

function writableRows(rows: readonly GQL.EcomBadReviewImportRow[]): number {
  return rows.filter(
    (row) =>
      row.rowClass === GQL.BadReviewImportRowClass.Importable ||
      row.rowClass === GQL.BadReviewImportRowClass.Update,
  ).length;
}

/** Upload always goes through a preview that classifies every row before anything is written. */
export const BadReviewImportModal = observer(function BadReviewImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const badReview = useEntityStore().ecommerceBadReview;
  const fileInput = useRef<HTMLInputElement | null>(null);
  // The file being handled, as plain rows: this is a draft, not business state.
  const [rows, setRows] = useState<GQL.EcomBadReviewImportRowInput[]>([]);
  const [preview, setPreview] = useState<GQL.EcomBadReviewImportResult | null>(null);
  const [applied, setApplied] = useState<GQL.EcomBadReviewImportResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRows([]);
    setPreview(null);
    setApplied(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const fileError = (err: unknown): string => {
    if (!(err instanceof BadReviewWorkbookError)) return err instanceof Error ? err.message : String(err);
    return err.code === "MISSING_COLUMNS"
      ? t(`${PREFIX}.missingColumns`, { columns: err.columns.join(", ") })
      : t(`${PREFIX}.noRows`);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    reset();
    setWorking(true);
    try {
      const XLSX = await import("xlsx");
      const parsed = readBadReviewWorkbook(XLSX, await file.arrayBuffer());
      setRows(parsed);
      setPreview(await badReview.previewImport(parsed));
    } catch (err) {
      setError(fileError(err));
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    setWorking(true);
    setError(null);
    try {
      setApplied(await badReview.applyImport(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const shown = applied ?? preview;
  const problems = (shown?.rows ?? []).filter(
    (row) =>
      row.rowClass !== GQL.BadReviewImportRowClass.Importable &&
      row.rowClass !== GQL.BadReviewImportRowClass.Update,
  );
  const writable = preview ? writableRows(preview.rows) : 0;

  return (
    <TkModal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t(`${PREFIX}.title`)}
      closeLabel={t("common.close")}
      maxWidth={760}
    >
      <div className="bad-review-import">
        <input
          ref={fileInput}
          className="bad-review-file-input"
          type="file"
          accept=".xlsx,.xls"
          aria-label={t(`${PREFIX}.chooseFile`)}
          onChange={(event) => {
            onFile(event).catch(() => {});
          }}
        />
        <div className="bad-review-import-row">
          <TkButton
            variant="secondary"
            disabled={working}
            onClick={() => fileInput.current?.click()}
          >
            {t(`${PREFIX}.chooseFile`)}
          </TkButton>
          <span className="form-hint">{t(`${PREFIX}.fileHint`)}</span>
        </div>
        {error ? (
          <TkAlert tone="danger" title={t(`${PREFIX}.failed`)}>
            {error}
          </TkAlert>
        ) : null}
        {working && !shown ? <p className="bad-review-muted">{t("common.loading")}</p> : null}
        {shown ? (
          <>
            {applied ? <TkAlert tone="success">{t(`${PREFIX}.done`)}</TkAlert> : null}
            <div className="bad-review-import-summary">
              {ROW_CLASSES.map((rowClass) => (
                <TkBadge key={rowClass} tone="neutral">
                  {t(`${PREFIX}.class.${rowClass}`, {
                    count: shown.rows.filter((row) => row.rowClass === rowClass).length,
                  })}
                </TkBadge>
              ))}
            </div>
            {problems.length ? (
              <TkTableFrame>
                <table className="bad-review-table">
                  <thead>
                    <tr>
                      <th>{t(`${PREFIX}.row`)}</th>
                      <th>{t("ecommerce.badReview.columns.order")}</th>
                      <th>{t(`${PREFIX}.result`)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>
                          <TkPrivate>{row.orderId || "-"}</TkPrivate>
                        </td>
                        <td>
                          {row.problem
                            ? t(`${PREFIX}.problem.${row.problem}`)
                            : t(`${PREFIX}.rowResult.${row.rowClass}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TkTableFrame>
            ) : null}
            {!applied ? (
              <>
                <TkAlert tone="warning">{t(`${PREFIX}.aiWarning`)}</TkAlert>
                <div className="bad-review-import-row">
                  <TkButton
                    variant="primary"
                    disabled={writable === 0}
                    loading={working}
                    onClick={() => {
                      apply().catch(() => {});
                    }}
                  >
                    {t(`${PREFIX}.apply`, { count: writable })}
                  </TkButton>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </TkModal>
  );
});
