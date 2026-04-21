import { useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { AuthModal } from "./modals/AuthModal.js";
import { UserPlusIcon } from "./icons.js";
import { getUserInitial } from "../lib/user-manager.js";

interface UserAvatarButtonProps {
  onNavigate: (path: string) => void;
}

export const UserAvatarButton = observer(function UserAvatarButton({ onNavigate }: UserAvatarButtonProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const [authModalOpen, setAuthModalOpen] = useState(false);

  function handleClick() {
    if (user) {
      onNavigate("/account");
    } else if (authChecking) {
      return;
    } else {
      setAuthModalOpen(true);
    }
  }

  const initial = user ? getUserInitial(user) : "";

  return (
    <div className="user-avatar-wrapper">
      <button
        className={`user-avatar-btn${user || authChecking ? " user-avatar-btn-active" : ""}`}
        onClick={handleClick}
        title={user ? user.email : authChecking ? t("common.loading") : t("auth.login")}
      >
        {user
          ? <span className="user-avatar-circle">{initial}</span>
          : authChecking
            ? <span className="user-avatar-circle">...</span>
            : <UserPlusIcon />}
      </button>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
});
