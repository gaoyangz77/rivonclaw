import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { TkButton, TkSwitch, TkPanel, TkPanelBody, TkPanelFooter } from '../../../components/design-system/index.js';
import { useEntityStore } from '../../../store/EntityStoreProvider.js';

export const DeliveryFailureReminderSettings = observer(function DeliveryFailureReminderSettings({ shopId }: { shopId: string }) {
  const store = useEntityStore();
  const { t } = useTranslation();
  const shop = store.shops.find(item => item.id === shopId);
  const savedEnabled = shop?.services?.customerService?.deliveryFailureReminderEnabled ?? false;
  const csEnabled = shop?.services?.customerService?.enabled ?? false;
  const [draftEnabled, setDraftEnabled] = useState(savedEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraftEnabled(savedEnabled); setError(null); }, [shopId, savedEnabled]);
  async function save() {
    setSaving(true); setError(null);
    try { await store.setShopDeliveryFailureReminderEnabled(shopId, draftEnabled); }
    catch { setError(t('ecommerce.deliveryFailureReminder.saveFailed')); }
    finally { setSaving(false); }
  }
  return <section id="shop-workspace-aiCustomerService-delivery-failure-reminder">
    <div className="drawer-section-label">{t('ecommerce.deliveryFailureReminder.title')}</div>
    <TkPanel padding="none"><TkPanelBody>
      <TkSwitch checked={draftEnabled} onChange={setDraftEnabled} disabled={saving || !csEnabled}
        label={t('ecommerce.deliveryFailureReminder.enabled')} description={t('ecommerce.deliveryFailureReminder.hint')} />
      {error && <p role="alert">{error}</p>}
      </TkPanelBody><TkPanelFooter><TkButton size="sm" loading={saving} disabled={!csEnabled || savedEnabled === draftEnabled} onClick={save}>{t('common.save')}</TkButton></TkPanelFooter>
    </TkPanel>
  </section>;
});
