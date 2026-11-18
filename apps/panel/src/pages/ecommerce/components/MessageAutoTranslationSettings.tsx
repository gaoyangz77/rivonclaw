import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { GQL } from '@rivonclaw/core';
import { TkAlert, TkButton, TkChoiceSelect, TkPanel, TkPanelBody, TkPanelFooter } from '../../../components/design-system/index.js';
import { useEntityStore } from '../../../store/EntityStoreProvider.js';

const LEVELS = [
  { value: GQL.CustomerServiceMessageAutoTranslation.Off, labelKey: 'off' },
  { value: GQL.CustomerServiceMessageAutoTranslation.Escalated, labelKey: 'escalated' },
  { value: GQL.CustomerServiceMessageAutoTranslation.All, labelKey: 'all' },
] as const;

/** Shop-level automatic translation of CS conversation messages (ADR-109). Serves human operators, so it does not depend on AI customer service being enabled. */
export const MessageAutoTranslationSettings = observer(function MessageAutoTranslationSettings({ shopId }: { shopId: string }) {
  const store = useEntityStore();
  const { t } = useTranslation();
  const shop = store.shops.find(item => item.id === shopId);
  const savedLevel = shop?.services?.customerService?.messageAutoTranslation ?? GQL.CustomerServiceMessageAutoTranslation.Off;
  const [draftLevel, setDraftLevel] = useState<GQL.CustomerServiceMessageAutoTranslation>(savedLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraftLevel(savedLevel); setError(null); }, [shopId, savedLevel]);
  async function save() {
    setSaving(true); setError(null);
    try { await store.setShopMessageAutoTranslation(shopId, draftLevel); }
    catch { setError(t('ecommerce.messageAutoTranslation.saveFailed')); }
    finally { setSaving(false); }
  }
  return <section id="shop-workspace-aiCustomerService-message-auto-translation">
    <div className="drawer-section-label">{t('ecommerce.messageAutoTranslation.title')}</div>
    <TkPanel padding="none"><TkPanelBody>
      <TkChoiceSelect label={t('ecommerce.messageAutoTranslation.field')} value={draftLevel} disabled={saving}
        onChange={value => setDraftLevel(value as GQL.CustomerServiceMessageAutoTranslation)}
        options={LEVELS.map(level => ({ value: level.value, label: t(`ecommerce.messageAutoTranslation.${level.labelKey}`) }))}
        hint={t('ecommerce.messageAutoTranslation.hint')} />
      {draftLevel === GQL.CustomerServiceMessageAutoTranslation.All && <TkAlert tone="warning">{t('ecommerce.messageAutoTranslation.allHint')}</TkAlert>}
      {error && <p role="alert">{error}</p>}
    </TkPanelBody><TkPanelFooter><TkButton size="sm" loading={saving} disabled={savedLevel === draftLevel} onClick={save}>{t('common.save')}</TkButton></TkPanelFooter>
    </TkPanel>
  </section>;
});
