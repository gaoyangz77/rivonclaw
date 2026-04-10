import { useTranslation } from "react-i18next";
import { Select } from "../../../components/inputs/Select.js";
import type { CronJobFormData, CronDeliveryMode, FormErrors } from "../cron-utils.js";
import { InfoTip } from "./InfoTip.js";

const DELIVERY_MODES: CronDeliveryMode[] = ["none", "announce", "webhook"];

interface CronDeliveryFieldsProps {
  form: CronJobFormData;
  errors: FormErrors;
  channelOptions: Array<{ value: string; label: string }>;
  recipientOptions: Array<{ value: string; label: string }>;
  channelStatusLoading: boolean;
  onUpdate: <K extends keyof CronJobFormData>(key: K, value: CronJobFormData[K]) => void;
  onChannelChange: (v: string) => void;
}

export function CronDeliveryFields({ form, errors, channelOptions, recipientOptions, channelStatusLoading, onUpdate, onChannelChange }: CronDeliveryFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="form-group">
      <label className="form-label-block">
        {t("crons.fieldDeliveryMode")}
        <InfoTip tooltipKey="tooltipDeliveryMode" />
      </label>
      {form.payloadKind === "systemEvent" ? (
        <>
          <Select
            value="none"
            onChange={() => { }}
            options={[{ value: "none", label: t("crons.deliveryNone") }]}
            disabled
          />
          <div className="form-hint">{t("crons.deliveryAgentOnly")}</div>
        </>
      ) : (
        <>
          <Select
            value={form.deliveryMode}
            onChange={(v) => onUpdate("deliveryMode", v as CronDeliveryMode)}
            options={DELIVERY_MODES.map((m) => ({
              value: m,
              label: t(`crons.delivery${m.charAt(0).toUpperCase()}${m.slice(1)}`),
            }))}
          />
          {form.deliveryMode === "announce" && (
            <div className="escalation-cascade-row escalation-cascade-row-flush">
              <div className="escalation-cascade-col">
                <label className="form-label-block">{t("crons.fieldDeliveryChannel")}</label>
                {channelStatusLoading ? (
                  <Select
                    value=""
                    onChange={() => { }}
                    options={[]}
                    placeholder={t("crons.channelStatusLoading")}
                    disabled
                  />
                ) : (
                  <>
                    <Select
                      value={form.deliveryChannel && form.deliveryAccountId ? `${form.deliveryChannel}:${form.deliveryAccountId}` : form.deliveryChannel}
                      onChange={onChannelChange}
                      options={channelOptions}
                      placeholder={t("crons.fieldDeliveryChannel")}
                    />
                    {channelOptions.length === 0 && (
                      <div className="form-hint">{t("crons.noConnectedChannels")}</div>
                    )}
                  </>
                )}
              </div>
              <div className={`escalation-cascade-col${!form.deliveryChannel ? " escalation-cascade-col-disabled" : ""}`}>
                <label className="form-label-block">{t("crons.fieldDeliveryRecipient")}</label>
                <Select
                  value={form.deliveryTo}
                  onChange={(v) => onUpdate("deliveryTo", v)}
                  options={recipientOptions}
                  disabled={!form.deliveryChannel}
                />
              </div>
            </div>
          )}
          {form.deliveryMode === "webhook" && (
            <div className="form-group">
              <label className="form-label-block">{t("crons.fieldDeliveryTo")} <span className="required">*</span></label>
              <input
                className="input-full"
                value={form.deliveryTo}
                onChange={(e) => onUpdate("deliveryTo", e.target.value)}
                placeholder="https://example.com/webhook"
              />
              {errors.deliveryTo && <div className="crons-field-error">{t(`crons.${errors.deliveryTo}`)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
