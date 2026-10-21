function translation(missing: string, load: string, failed: string) {
  return { ecommerce: { affiliateWorkspace: { messageTargetCard: { missing, load, failed } } } };
}

export const AFFILIATE_MESSAGE_TARGET_TRANSLATIONS = {
  en: translation("Invitation details are not fully synced locally.", "Load invitation details", "Could not load invitation details."),
  zh: translation("邀约详情尚未完整同步到本地。", "从平台加载邀约详情", "邀约详情加载失败。"),
  de: translation("Die Einladungsdetails sind lokal noch nicht vollständig synchronisiert.", "Einladungsdetails laden", "Einladungsdetails konnten nicht geladen werden."),
  es: translation("Los detalles de la invitación aún no están sincronizados por completo.", "Cargar detalles de la invitación", "No se pudieron cargar los detalles de la invitación."),
  fr: translation("Les détails de l’invitation ne sont pas encore entièrement synchronisés localement.", "Charger les détails de l’invitation", "Impossible de charger les détails de l’invitation."),
  id: translation("Detail undangan belum tersinkron sepenuhnya secara lokal.", "Muat detail undangan", "Gagal memuat detail undangan."),
  it: translation("I dettagli dell’invito non sono ancora completamente sincronizzati in locale.", "Carica i dettagli dell’invito", "Impossibile caricare i dettagli dell’invito."),
  th: translation("รายละเอียดคำเชิญยังซิงค์ไว้ในเครื่องไม่ครบถ้วน", "โหลดรายละเอียดคำเชิญ", "โหลดรายละเอียดคำเชิญไม่สำเร็จ"),
};
