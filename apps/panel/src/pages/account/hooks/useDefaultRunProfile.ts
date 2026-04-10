import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

export function useDefaultRunProfile() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultProfileError, setDefaultProfileError] = useState<string | null>(null);

  async function handleDefaultProfileChange(profileId: string) {
    setSavingDefault(true);
    setDefaultProfileError(null);
    try {
      await entityStore.currentUser!.setDefaultRunProfile(profileId || null);
    } catch {
      setDefaultProfileError(t("surfaces.failedToSaveProfile"));
    } finally {
      setSavingDefault(false);
    }
  }

  return { savingDefault, defaultProfileError, handleDefaultProfileChange };
}
