import { useTranslation } from "react-i18next";
import type { CronJob } from "../cron-utils.js";
import { formatSchedule, formatRelativeTime, getTzI18nKey } from "../cron-utils.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";

interface CronJobTableProps {
  jobs: CronJob[];
  loading: boolean;
  now: number;
  runningJobId: string | null;
  onEdit: (job: CronJob) => void;
  onToggle: (job: CronJob) => void;
  onRun: (id: string) => void;
  onHistory: (job: CronJob) => void;
  onDelete: (job: { id: string; name: string }) => void;
}

function getStatusBadge(job: CronJob, t: (key: string) => string) {
  if (job.state?.runningAtMs) {
    return <span className="badge badge-info"><span className="crons-running-indicator" />{t("crons.statusRunning")}</span>;
  }
  const status = job.state?.lastRunStatus ?? job.state?.lastStatus;
  if (!status) return <span className="badge badge-default">{t("crons.neverRun")}</span>;
  const cls = status === "ok" ? "badge-success" : status === "error" ? "badge-danger" : "badge-warning";
  return <span className={`badge ${cls}`}>{t(`crons.status${status.charAt(0).toUpperCase()}${status.slice(1)}`)}</span>;
}

export function CronJobTable({ jobs, loading, now, runningJobId, onEdit, onToggle, onRun, onHistory, onDelete }: CronJobTableProps) {
  const { t, i18n } = useTranslation();

  if (loading && jobs.length === 0) {
    return (
      <div className="section-card">
        <div className="loading-state">
          <span className="spinner" />
          <span>{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-cell">
          {t("crons.emptyState")}
        </div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="table-scroll-wrap">
        <table className="crons-table" data-tutorial-id="crons-table">
          <thead>
            <tr>
              <th>{t("crons.colName")}</th>
              <th>{t("crons.colSchedule")}</th>
              <th>{t("crons.colEnabled")}</th>
              <th>{t("crons.colLastRun")}</th>
              <th>{t("crons.colNextRun")}</th>
              <th>{t("crons.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="table-hover-row">
                <td>
                  <div className="crons-job-name">{job.name}</div>
                  {job.description && <div className="crons-job-desc" title={job.description}>{job.description}</div>}
                </td>
                <td>
                  {!job.schedule ? (
                    <span className="crons-schedule-text text-muted">—</span>
                  ) : job.schedule.kind === "cron" ? (
                    <>
                      <span className="crons-schedule-text">{job.schedule.expr}</span>
                      {job.schedule.tz && (
                        <div className="crons-schedule-tz">
                          {(() => {
                            const key = getTzI18nKey(job.schedule.tz);
                            return key ? t(`crons.${key}`) : job.schedule.tz;
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="crons-schedule-text">{formatSchedule(job.schedule, i18n.language)}</span>
                  )}
                </td>
                <td>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={job.enabled}
                      onChange={() => onToggle(job)}
                    />
                    <span className={`toggle-track ${job.enabled ? "toggle-track-on" : "toggle-track-off"}`}>
                      <span className={`toggle-thumb ${job.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`} />
                    </span>
                  </label>
                </td>
                <td>
                  <div className="crons-time-cell">
                    {getStatusBadge(job, t)}
                    {job.state?.lastRunAtMs && (
                      <div className="text-muted" title={formatLocalizedDateTime(job.state.lastRunAtMs, i18n.language)}>
                        {formatRelativeTime(job.state.lastRunAtMs, now, i18n.language)}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="crons-time-cell">
                    {job.state?.nextRunAtMs
                      ? <span title={formatLocalizedDateTime(job.state.nextRunAtMs, i18n.language)}>{formatRelativeTime(job.state.nextRunAtMs, now, i18n.language)}</span>
                      : <span className="text-muted">—</span>
                    }
                  </div>
                </td>
                <td className="td-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => onEdit(job)}>
                    {t("common.edit")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onRun(job.id)}
                    disabled={runningJobId === job.id}
                  >
                    {runningJobId === job.id ? "..." : t("crons.runNow")}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => onHistory(job)}>
                    {t("crons.viewHistory")}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete({ id: job.id, name: job.name })}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
