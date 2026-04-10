import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { Select } from "../../../components/inputs/Select.js";
import type { PlatformApp } from "@rivonclaw/core/models";

interface TikTokShopConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  platformApps: PlatformApp[];
  selectedPlatformAppId: string;
  onPlatformAppChange: (id: string) => void;
  onConnect: () => void;
  oauthLoading: boolean;
}

export function TikTokShopConnectModal({
  isOpen,
  onClose,
  platformApps,
  selectedPlatformAppId,
  onPlatformAppChange,
  onConnect,
  oauthLoading,
}: TikTokShopConnectModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("tiktokShops.connectShopTitle")}
    >
      <div className="modal-form-col">
        <p>{t("tiktokShops.connectShopDesc")}</p>
        <div>
          <label className="form-label-block">
            {t("tiktokShops.platformAppLabel")}
          </label>
          {platformApps.length === 0 ? (
            <div className="form-hint">{t("tiktokShops.noPlatformApps")}</div>
          ) : platformApps.length === 1 ? (
            <div className="form-hint">{platformApps[0].label}</div>
          ) : (
            <Select
              value={selectedPlatformAppId}
              onChange={(v) => onPlatformAppChange(v)}
              className="input-full"
              options={platformApps.map((app) => ({
                value: app.id,
                label: app.label,
              }))}
            />
          )}
          <div className="form-hint">{t("tiktokShops.platformAppHint")}</div>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConnect}
            disabled={oauthLoading || !selectedPlatformAppId}
          >
            {oauthLoading ? t("common.loading") : t("tiktokShops.authorizeButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
