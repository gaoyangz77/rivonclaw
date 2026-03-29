import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { getUserInitial } from "../lib/user-manager.js";
import { LogOutIcon } from "./icons.js";

interface UserPopoverProps {
    open: boolean;
    onClose: () => void;
    onNavigate: (path: string) => void;
}

export const UserPopover = observer(function UserPopover({ open, onClose, onNavigate }: UserPopoverProps) {
    const { t } = useTranslation();
    const entityStore = useEntityStore();
    const user = entityStore.currentUser;
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        const id = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
        return () => { clearTimeout(id); document.removeEventListener("mousedown", handleClick); };
    }, [open, onClose]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    const sub = entityStore.subscriptionStatus;

    if (!open || !user) return null;
    const initial = getUserInitial(user);

    function handleLogout() { onClose(); entityStore.logout(); onNavigate("/"); }

    return (
        <div className="upop" ref={ref}>
            <div className="upop-header">
                <div className="upop-avatar">{initial}</div>
                <div className="upop-email">{user.email}</div>
                <div className="upop-member-since">
                    {t("account.memberSince")} {new Date(user.createdAt).toLocaleDateString()}
                </div>
            </div>
            <div className="upop-plan-section">
                <div className="upop-plan-card">
                    <div className="upop-plan-row">
                        <span className="upop-plan-label">{t("account.plan")}</span>
                        <span className="upop-plan-badge">{sub?.plan ?? user.plan}</span>
                    </div>
                    <div className="upop-plan-row">
                        <span className="upop-plan-label">{t("account.validUntil")}</span>
                        <span className="upop-plan-value">
                            {sub ? new Date(sub.validUntil).toLocaleDateString() : "-"}
                        </span>
                    </div>
                </div>
            </div>
            <div className="upop-divider" />
            <div className="upop-menu">
                <button className="upop-menu-item upop-menu-item-danger" onClick={handleLogout}>
                    <LogOutIcon size={16} />
                    <span>{t("auth.logout")}</span>
                </button>
            </div>
        </div>
    );
});
