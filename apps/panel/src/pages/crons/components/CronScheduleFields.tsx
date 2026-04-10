import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../../components/inputs/Select.js";
import type { CronJobFormData, ScheduleKind, EveryUnit, FormErrors } from "../cron-utils.js";
import { TIMEZONE_ENTRIES } from "../cron-utils.js";

const SCHEDULE_KINDS: ScheduleKind[] = ["cron", "every", "at"];
const EVERY_UNITS: EveryUnit[] = ["seconds", "minutes", "hours"];

const CRON_PRESETS: { key: string; expr: string }[] = [
  { key: "presetEveryMinute", expr: "* * * * *" },
  { key: "presetEvery5Min", expr: "*/5 * * * *" },
  { key: "presetEvery15Min", expr: "*/15 * * * *" },
  { key: "presetEveryHour", expr: "0 * * * *" },
  { key: "presetEveryDay", expr: "0 0 * * *" },
  { key: "presetEveryMonday9am", expr: "0 9 * * 1" },
  { key: "presetEvery1stOfMonth", expr: "0 0 1 * *" },
];

/** Parse a cron expression into its 5 fields. */
function parseCronFields(expr: string): [string, string, string, string, string] {
  const parts = expr.trim().split(/\s+/);
  return [parts[0] || "*", parts[1] || "*", parts[2] || "*", parts[3] || "*", parts[4] || "*"];
}

const MONTH_KEYS = ["cronJan", "cronFeb", "cronMar", "cronApr", "cronMay", "cronJun", "cronJul", "cronAug", "cronSep", "cronOct", "cronNov", "cronDec"] as const;
const DOW_KEYS = ["cronSun", "cronMon", "cronTue", "cronWed", "cronThu", "cronFri", "cronSat"] as const;

interface CronScheduleFieldsProps {
  form: CronJobFormData;
  errors: FormErrors;
  showRawCron: boolean;
  onShowRawCronChange: (v: boolean) => void;
  onUpdate: <K extends keyof CronJobFormData>(key: K, value: CronJobFormData[K]) => void;
}

export function CronScheduleFields({ form, errors, showRawCron, onShowRawCronChange, onUpdate }: CronScheduleFieldsProps) {
  const { t } = useTranslation();

  /** Build translated option lists for the 5 cron fields. */
  const cronFieldDefs = useMemo(() => {
    const minuteOpts = [
      { value: "*", label: t("crons.cronAny") },
      { value: "*/5", label: t("crons.cronEveryNMin", { n: 5 }) },
      { value: "*/10", label: t("crons.cronEveryNMin", { n: 10 }) },
      { value: "*/15", label: t("crons.cronEveryNMin", { n: 15 }) },
      { value: "*/30", label: t("crons.cronEveryNMin", { n: 30 }) },
      { value: "0", label: ":00" },
      { value: "15", label: ":15" },
      { value: "30", label: ":30" },
      { value: "45", label: ":45" },
    ];
    const hourOpts = [
      { value: "*", label: t("crons.cronAny") },
      { value: "*/2", label: t("crons.cronEveryNH", { n: 2 }) },
      { value: "*/3", label: t("crons.cronEveryNH", { n: 3 }) },
      { value: "*/4", label: t("crons.cronEveryNH", { n: 4 }) },
      { value: "*/6", label: t("crons.cronEveryNH", { n: 6 }) },
      { value: "*/12", label: t("crons.cronEveryNH", { n: 12 }) },
      { value: "0", label: "0:00" },
      { value: "6", label: "6:00" },
      { value: "8", label: "8:00" },
      { value: "9", label: "9:00" },
      { value: "12", label: "12:00" },
      { value: "18", label: "18:00" },
    ];
    const domOpts = [
      { value: "*", label: t("crons.cronAny") },
      { value: "1", label: "1" },
      { value: "15", label: "15" },
    ];
    const monthOpts = [
      { value: "*", label: t("crons.cronAny") },
      ...MONTH_KEYS.map((k, i) => ({ value: String(i + 1), label: t(`crons.${k}`) })),
    ];
    const dowOpts = [
      { value: "*", label: t("crons.cronAny") },
      { value: "1-5", label: t("crons.cronWeekdays") },
      { value: "0,6", label: t("crons.cronWeekends") },
      ...DOW_KEYS.map((k, i) => ({ value: String(i), label: t(`crons.${k}`) })),
    ];
    return [
      { label: t("crons.cronFieldMinute"), options: minuteOpts },
      { label: t("crons.cronFieldHour"), options: hourOpts },
      { label: t("crons.cronFieldDay"), options: domOpts },
      { label: t("crons.cronFieldMonth"), options: monthOpts },
      { label: t("crons.cronFieldWeekday"), options: dowOpts },
    ];
  }, [t]);

  const handleCronFieldChange = useCallback((index: number, value: string) => {
    const parts = parseCronFields(form.cronExpr || "* * * * *");
    parts[index] = value;
    onUpdate("cronExpr", parts.join(" "));
  }, [form.cronExpr, onUpdate]);

  return (
    <>
      {/* Schedule type */}
      <div className="form-group">
        <label className="form-label-block">{t("crons.fieldScheduleType")} <span className="required">*</span></label>
        <div className="crons-schedule-type-row">
          {SCHEDULE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`crons-schedule-type-btn${form.scheduleKind === kind ? " crons-schedule-type-btn-active" : ""}`}
              onClick={() => onUpdate("scheduleKind", kind)}
            >
              {t(`crons.schedule${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule fields */}
      {form.scheduleKind === "cron" && (
        <>
          <div className="form-group">
            <label className="form-label-block">{t("crons.fieldCronExpr")} <span className="required">*</span></label>
            {/* Quick presets */}
            <div className="crons-preset-grid">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.expr}
                  type="button"
                  className={`crons-preset-chip${form.cronExpr === p.expr ? " crons-preset-chip-active" : ""}`}
                  onClick={() => onUpdate("cronExpr", p.expr)}
                >
                  {t(`crons.${p.key}`)}
                </button>
              ))}
            </div>
            {/* Expression display + mode toggle */}
            <div className="crons-expr-bar">
              {showRawCron ? (
                <input
                  className="crons-expr-input input-mono"
                  value={form.cronExpr}
                  onChange={(e) => onUpdate("cronExpr", e.target.value)}
                  placeholder="*/5 * * * *"
                />
              ) : (
                <code className="crons-expr-value">{form.cronExpr || "* * * * *"}</code>
              )}
              <div className="crons-mode-toggle">
                <button
                  type="button"
                  className={`crons-mode-btn${!showRawCron ? " crons-mode-btn-active" : ""}`}
                  onClick={() => onShowRawCronChange(false)}
                >
                  {t("crons.cronModeVisual")}
                </button>
                <button
                  type="button"
                  className={`crons-mode-btn${showRawCron ? " crons-mode-btn-active" : ""}`}
                  onClick={() => onShowRawCronChange(true)}
                >
                  {t("crons.cronModeRaw")}
                </button>
              </div>
            </div>
            {/* Visual builder (hidden in raw mode) */}
            {!showRawCron && (
              <div className="crons-builder-row">
                {cronFieldDefs.map((field, i) => {
                  const parts = parseCronFields(form.cronExpr || "* * * * *");
                  const currentVal = parts[i];
                  const options = field.options.some((o) => o.value === currentVal)
                    ? field.options
                    : [{ value: currentVal, label: currentVal }, ...field.options];
                  return (
                    <div key={i}>
                      <span className="crons-builder-field-label">{field.label}</span>
                      <Select
                        value={currentVal}
                        onChange={(v) => handleCronFieldChange(i, v)}
                        options={options}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {errors.cronExpr && <div className="crons-field-error">{t(`crons.${errors.cronExpr}`)}</div>}
          </div>
          <div className="form-group">
            <label className="form-label-block">{t("crons.fieldTimezone")}</label>
            <Select
              searchable
              value={form.cronTz}
              onChange={(v) => onUpdate("cronTz", v)}
              options={TIMEZONE_ENTRIES.map((tz) => ({
                value: tz.value,
                label: t(`crons.${tz.i18nKey}`),
              }))}
            />
          </div>
        </>
      )}

      {form.scheduleKind === "every" && (
        <div className="form-group">
          <label className="form-label-block">{t("crons.fieldInterval")} <span className="required">*</span></label>
          <div className="crons-form-row">
            <input
              type="number"
              className="input-full"
              min={1}
              value={form.everyValue}
              onChange={(e) => onUpdate("everyValue", Number(e.target.value))}
            />
            <Select
              value={form.everyUnit}
              onChange={(v) => onUpdate("everyUnit", v as EveryUnit)}
              options={EVERY_UNITS.map((u) => ({ value: u, label: t(`crons.unit${u.charAt(0).toUpperCase()}${u.slice(1)}`) }))}
            />
          </div>
          {errors.everyValue && <div className="crons-field-error">{t(`crons.${errors.everyValue}`)}</div>}
        </div>
      )}

      {form.scheduleKind === "at" && (
        <div className="form-group">
          <label className="form-label-block">{t("crons.fieldRunAt")} <span className="required">*</span></label>
          <input
            type="datetime-local"
            className="input-full"
            value={form.atDatetime}
            onChange={(e) => {
              onUpdate("atDatetime", e.target.value);
              onUpdate("deleteAfterRun", true);
            }}
          />
          {errors.atDatetime && <div className="crons-field-error">{t(`crons.${errors.atDatetime}`)}</div>}
        </div>
      )}
    </>
  );
}
