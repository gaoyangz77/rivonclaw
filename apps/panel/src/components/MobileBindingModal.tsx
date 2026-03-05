import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import {
    generateMobilePairingCode,
    getMobilePairingStatus,
    disconnectMobilePairing
} from "../api/mobile-chat.js";
import { Modal } from "./Modal.js";

interface MobileBindingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBindingSuccess: () => void;
}

export function MobileBindingModal({ isOpen, onClose, onBindingSuccess }: MobileBindingModalProps) {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);

    const pollIntervalRef = useRef<number | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await getMobilePairingStatus();
            if (res.pairing) {
                setIsConnected(true);
                setConnectedDeviceId(res.pairing.mobileDeviceId || "Unknown Device");
                setPairingCode(null);
                setQrDataUrl(null);
                return true; // is connected
            }
            setIsConnected(false);
            setConnectedDeviceId(null);
            return false; // not connected
        } catch (err: any) {
            console.warn("Failed to fetch mobile status:", err);
            return false;
        }
    }, []);

    const generateCode = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const res = await generateMobilePairingCode();
            setPairingCode(res.code || null);

            if (res.code) {
                // Generate QR Code data URL
                const qrData = await QRCode.toDataURL(res.code, {
                    margin: 2,
                    width: 250,
                    color: {
                        dark: "#000000FF",
                        light: "#FFFFFFFF",
                    }
                });
                setQrDataUrl(qrData);
            } else {
                setQrDataUrl(null);
            }
        } catch (err: any) {
            setError(t("mobile.generationFailed", { error: err.message || "Unknown error" }));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const loadInitialData = useCallback(async () => {
        if (!isOpen) return;
        setLoading(true);
        const currentlyConnected = await fetchStatus();
        if (!currentlyConnected) {
            await generateCode();
        }
        setLoading(false);
    }, [isOpen, fetchStatus, generateCode]);

    useEffect(() => {
        if (!isOpen) {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        loadInitialData();

        // Poll status every 3 seconds to catch when a mobile device connects
        pollIntervalRef.current = window.setInterval(async () => {
            const currentlyConnected = await fetchStatus();
            if (currentlyConnected && pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                onBindingSuccess();
            }
        }, 3000);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [isOpen, loadInitialData, fetchStatus, onBindingSuccess]);

    const handleDisconnect = async () => {
        if (!confirm(t("mobile.disconnectConfirm") as string)) return;
        try {
            setLoading(true);
            await disconnectMobilePairing();
            await loadInitialData(); // Will regenerate a new code

            // Restart polling
            pollIntervalRef.current = window.setInterval(async () => {
                const currentlyConnected = await fetchStatus();
                if (currentlyConnected && pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    onBindingSuccess();
                }
            }, 3000);

        } catch (err: any) {
            setError(t("mobile.disconnectFailed", { error: err.message || "Unknown error" }));
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("mobile.statusTitle")}
            maxWidth={420}
        >
            <div className="modal-form-col">
                {error && <div className="modal-error-box">{error}</div>}

                <div style={{ padding: "1rem 0" }}>
                    {loading && !pairingCode && !isConnected ? (
                        <p>{t("common.loading")}</p>
                    ) : isConnected ? (
                        <div className="mobile-connected-view" style={{ textAlign: "center" }}>
                            <div className="status-badge badge-success" style={{ display: "inline-block", marginBottom: "1rem" }}>{t("common.connected")}</div>
                            <p>{t("mobile.connectedDesc", { device: connectedDeviceId })}</p>
                            <div style={{ marginTop: "1rem" }}>
                                <button className="btn btn-danger" onClick={handleDisconnect} disabled={loading}>
                                    {t("mobile.disconnect")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mobile-pairing-view" style={{ textAlign: "center" }}>
                            <div className="status-badge badge-warning" style={{ display: "inline-block" }}>{t("mobile.waitingForConnection")}</div>
                            <p style={{ marginTop: "1rem", marginBottom: "2rem" }}>
                                {t("mobile.scanHint")}
                            </p>

                            {qrDataUrl && (
                                <div className="qr-container" style={{ margin: "0 auto", padding: "16px", background: "white", display: "inline-block", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                                    <img src={qrDataUrl} alt="Pairing QR Code" width={250} height={250} style={{ display: "block" }} />
                                </div>
                            )}

                            {pairingCode && (
                                <div className="code-container" style={{ marginTop: "2rem" }}>
                                    <p>{t("mobile.manualCodeHint")}</p>
                                    <div className="pairing-code" style={{
                                        fontSize: "2rem",
                                        letterSpacing: "4px",
                                        fontWeight: "bold",
                                        fontFamily: "monospace",
                                        background: "var(--bg-secondary)",
                                        padding: "1rem 2rem",
                                        borderRadius: "8px",
                                        display: "inline-block",
                                        marginTop: "0.5rem"
                                    }}>
                                        {pairingCode}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
