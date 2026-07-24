const en = {
  projectionSyncing: "Affiliate data is syncing",
  projectionHistorySyncing: "Current Affiliate data is ready; historical coverage is still syncing",
  projectionCurrentReady: "Affiliate operational data is ready",
  projectionLastSynced: "Operational data last synced",
  projectionDataset: {
    COLLABORATIONS: "Collaborations",
    SAMPLE_APPLICATIONS: "Sample applications",
  },
  projectionStatus: {
    NOT_STARTED: "Not started",
    SYNCING: "Syncing",
    READY: "Ready",
    DEGRADED: "Retrying after a sync interruption",
    BOOTSTRAPPING: "Loading history",
    PROVIDER_WINDOW_LIMITED: "Limited by platform history coverage",
  },
} as const;

const zh = {
  projectionSyncing: "Affiliate 数据正在同步",
  projectionHistorySyncing: "当前 Affiliate 数据已就绪，历史数据仍在同步",
  projectionCurrentReady: "Affiliate 业务数据已就绪",
  projectionLastSynced: "业务数据最近同步时间",
  projectionDataset: {
    COLLABORATIONS: "合作记录",
    SAMPLE_APPLICATIONS: "样品申请",
  },
  projectionStatus: {
    NOT_STARTED: "尚未开始",
    SYNCING: "同步中",
    READY: "已就绪",
    DEGRADED: "同步中断，正在重试",
    BOOTSTRAPPING: "正在加载历史数据",
    PROVIDER_WINDOW_LIMITED: "受平台历史数据范围限制",
  },
} as const;

const de = {
  projectionSyncing: "Affiliate-Daten werden synchronisiert",
  projectionHistorySyncing: "Aktuelle Affiliate-Daten sind bereit; historische Daten werden noch synchronisiert",
  projectionCurrentReady: "Affiliate-Betriebsdaten sind bereit",
  projectionLastSynced: "Letzte Synchronisierung der Betriebsdaten",
  projectionDataset: {
    COLLABORATIONS: "Kooperationen",
    SAMPLE_APPLICATIONS: "Musteranträge",
  },
  projectionStatus: {
    NOT_STARTED: "Nicht gestartet",
    SYNCING: "Wird synchronisiert",
    READY: "Bereit",
    DEGRADED: "Synchronisierung unterbrochen, erneuter Versuch läuft",
    BOOTSTRAPPING: "Historie wird geladen",
    PROVIDER_WINDOW_LIMITED: "Durch den Plattformverlauf begrenzt",
  },
} as const;

const es = {
  projectionSyncing: "Los datos de afiliados se están sincronizando",
  projectionHistorySyncing: "Los datos actuales están listos; el historial aún se está sincronizando",
  projectionCurrentReady: "Los datos operativos de afiliados están listos",
  projectionLastSynced: "Última sincronización de datos operativos",
  projectionDataset: {
    COLLABORATIONS: "Colaboraciones",
    SAMPLE_APPLICATIONS: "Solicitudes de muestras",
  },
  projectionStatus: {
    NOT_STARTED: "Sin iniciar",
    SYNCING: "Sincronizando",
    READY: "Listo",
    DEGRADED: "Sincronización interrumpida; reintentando",
    BOOTSTRAPPING: "Cargando historial",
    PROVIDER_WINDOW_LIMITED: "Limitado por el historial de la plataforma",
  },
} as const;

const fr = {
  projectionSyncing: "Les données Affiliate sont en cours de synchronisation",
  projectionHistorySyncing: "Les données actuelles sont prêtes ; l’historique est encore en cours de synchronisation",
  projectionCurrentReady: "Les données opérationnelles Affiliate sont prêtes",
  projectionLastSynced: "Dernière synchronisation des données opérationnelles",
  projectionDataset: {
    COLLABORATIONS: "Collaborations",
    SAMPLE_APPLICATIONS: "Demandes d’échantillons",
  },
  projectionStatus: {
    NOT_STARTED: "Non démarré",
    SYNCING: "Synchronisation en cours",
    READY: "Prêt",
    DEGRADED: "Synchronisation interrompue, nouvelle tentative en cours",
    BOOTSTRAPPING: "Chargement de l’historique",
    PROVIDER_WINDOW_LIMITED: "Limité par l’historique disponible sur la plateforme",
  },
} as const;

const id = {
  projectionSyncing: "Data Affiliate sedang disinkronkan",
  projectionHistorySyncing: "Data Affiliate saat ini sudah siap; riwayat masih disinkronkan",
  projectionCurrentReady: "Data operasional Affiliate sudah siap",
  projectionLastSynced: "Sinkronisasi terakhir data operasional",
  projectionDataset: {
    COLLABORATIONS: "Kolaborasi",
    SAMPLE_APPLICATIONS: "Pengajuan sampel",
  },
  projectionStatus: {
    NOT_STARTED: "Belum dimulai",
    SYNCING: "Menyinkronkan",
    READY: "Siap",
    DEGRADED: "Sinkronisasi terhenti; sedang mencoba lagi",
    BOOTSTRAPPING: "Memuat riwayat",
    PROVIDER_WINDOW_LIMITED: "Dibatasi cakupan riwayat platform",
  },
} as const;

const it = {
  projectionSyncing: "I dati Affiliate sono in sincronizzazione",
  projectionHistorySyncing: "I dati correnti sono pronti; la cronologia è ancora in sincronizzazione",
  projectionCurrentReady: "I dati operativi Affiliate sono pronti",
  projectionLastSynced: "Ultima sincronizzazione dei dati operativi",
  projectionDataset: {
    COLLABORATIONS: "Collaborazioni",
    SAMPLE_APPLICATIONS: "Richieste di campioni",
  },
  projectionStatus: {
    NOT_STARTED: "Non avviato",
    SYNCING: "Sincronizzazione",
    READY: "Pronto",
    DEGRADED: "Sincronizzazione interrotta; nuovo tentativo in corso",
    BOOTSTRAPPING: "Caricamento cronologia",
    PROVIDER_WINDOW_LIMITED: "Limitato dalla cronologia disponibile sulla piattaforma",
  },
} as const;

const th = {
  projectionSyncing: "กำลังซิงค์ข้อมูล Affiliate",
  projectionHistorySyncing: "ข้อมูล Affiliate ปัจจุบันพร้อมแล้ว และกำลังซิงค์ข้อมูลย้อนหลัง",
  projectionCurrentReady: "ข้อมูลดำเนินงาน Affiliate พร้อมใช้งาน",
  projectionLastSynced: "ซิงค์ข้อมูลดำเนินงานล่าสุด",
  projectionDataset: {
    COLLABORATIONS: "ความร่วมมือ",
    SAMPLE_APPLICATIONS: "คำขอตัวอย่าง",
  },
  projectionStatus: {
    NOT_STARTED: "ยังไม่เริ่ม",
    SYNCING: "กำลังซิงค์",
    READY: "พร้อม",
    DEGRADED: "การซิงค์สะดุดและกำลังลองใหม่",
    BOOTSTRAPPING: "กำลังโหลดข้อมูลย้อนหลัง",
    PROVIDER_WINDOW_LIMITED: "ถูกจำกัดด้วยช่วงข้อมูลย้อนหลังของแพลตฟอร์ม",
  },
} as const;

export const AFFILIATE_PROJECTION_TRANSLATIONS = {
  en: { ecommerce: { affiliateWorkspace: en } },
  zh: { ecommerce: { affiliateWorkspace: zh } },
  de: { ecommerce: { affiliateWorkspace: de } },
  es: { ecommerce: { affiliateWorkspace: es } },
  fr: { ecommerce: { affiliateWorkspace: fr } },
  id: { ecommerce: { affiliateWorkspace: id } },
  it: { ecommerce: { affiliateWorkspace: it } },
  th: { ecommerce: { affiliateWorkspace: th } },
} as const;
