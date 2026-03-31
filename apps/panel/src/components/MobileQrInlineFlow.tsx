import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { fetchPrivacyMode } from "../api/settings.js";

export function MobileQrInlineFlow() {
    const { t } = useTranslation();
    const entityStore = useEntityStore();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installQrDataUrl, setInstallQrDataUrl] = useState<string | null>(null);
    const [privacyMode, setPrivacyMode] = useState(false);
    const [qrRevealed, setQrRevealed] = useState(false);

    useEffect(() => {
        fetchPrivacyMode().then(setPrivacyMode).catch(() => {});

        function onPrivacyChanged() {
            fetchPrivacyMode().then(setPrivacyMode).catch(() => {});
        }
        window.addEventListener("privacy-settings-changed", onPrivacyChanged);
        return () => window.removeEventListener("privacy-settings-changed", onPrivacyChanged);
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                const res = await entityStore.getInstallUrl();
                if (cancelled || !res.installUrl) return;
                const qrData = await QRCode.toDataURL(res.installUrl, {
                    margin: 1,
                    width: 180,
                    color: { dark: "#000000FF", light: "#FFFFFFFF" }
                });
                if (!cancelled) {
                    setInstallQrDataUrl(qrData);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || "Failed to load install URL");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const showBlur = privacyMode && !qrRevealed;

    if (error) {
        return <div className="mobile-qr-inline-error">{error}</div>;
    }

    if (loading && !installQrDataUrl) {
        return <div className="mobile-qr-inline-placeholder">{t("common.loading")}</div>;
    }

    if (!installQrDataUrl) return null;

    return (
        <div
            className={`mobile-qr-container mobile-qr-inline-img${showBlur ? " qr-privacy-blur" : ""}`}
            onClick={showBlur ? () => setQrRevealed(true) : undefined}
        >
            <img src={installQrDataUrl} alt="Install QR Code" width={180} height={180} />
            {showBlur && (
                <div className="qr-privacy-overlay">
                    {t("settings.app.clickToReveal")}
                </div>
            )}
        </div>
    );
}
