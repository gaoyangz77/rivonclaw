import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";
import { returnToOwner } from "../../api/account-switch.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { TkAlert, TkButton } from "../design-system/index.js";

interface SwitchState {
  ownerLabel: string;
  memberLabel: string;
}

export const AccountSwitchBanner = observer(function AccountSwitchBanner() {
  const { t } = useTranslation();
  const store = useEntityStore();
  const userId = store.currentUser?.userId ?? null;
  const [state, setState] = useState<SwitchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    let active = true;
    setState(null);
    void fetchJson<{ accountSwitch?: SwitchState | null }>(clientPath(API["auth.session"]))
      .then((session) => {
        if (active) {
          setState(session.accountSwitch ?? null);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : String(failure));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function restoreOwner() {
    setReturning(true);
    try {
      await returnToOwner();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setReturning(false);
    }
  }

  if (!state && !error) return null;
  return (
    <TkAlert
      tone={error ? "danger" : "warning"}
      title={state ? t("subAccounts.loginAsBanner", { member: state.memberLabel }) : undefined}
      actions={
        state ? (
          <TkButton
            size="sm"
            variant="secondary"
            disabled={returning}
            onClick={() => void restoreOwner()}
          >
            {t(returning ? "common.loading" : "subAccounts.returnToOwner")}
          </TkButton>
        ) : undefined
      }
    >
      {error
        ? t("common.operationFailed", { message: error })
        : t("subAccounts.loginAsHint", { owner: state?.ownerLabel })}
    </TkAlert>
  );
});
