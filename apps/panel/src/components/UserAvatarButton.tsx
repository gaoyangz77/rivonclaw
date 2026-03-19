import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../providers/AuthProvider.js";
import { AuthModal } from "./modals/AuthModal.js";
import { UserPlusIcon } from "./icons.js";
import { getUserInitial } from "../lib/user-manager.js";

interface UserAvatarButtonProps {
  onNavigate: (path: string) => void;
}

export function UserAvatarButton({ onNavigate }: UserAvatarButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  function handleClick() {
    if (user) {
      onNavigate("/account");
    } else {
      setAuthModalOpen(true);
    }
  }

  const initial = user ? getUserInitial(user) : "";

  return (
    <>
      <button
        className={`user-avatar-btn${user ? " user-avatar-btn-active" : ""}`}
        onClick={handleClick}
        title={user ? user.email : t("auth.login")}
      >
        {user ? <span className="user-avatar-circle">{initial}</span> : <UserPlusIcon />}
      </button>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
