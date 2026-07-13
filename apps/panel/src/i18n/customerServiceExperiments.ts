const base = {
  eyebrow: "CUSTOMER SERVICE · EXPERIMENT LAB",
  title: "Experiment analysis",
  subtitle:
    "Read live signals, maturity, and final outcomes from unpaid-order randomized experiments.",
  tabs: { label: "Experiment view", realtime: "Realtime", history: "History" },
  filters: {
    shop: "Shop",
    type: "Experiment type",
    allShops: "All shops",
    allTypes: "All experiment types",
  },
  types: { holdout: "Incrementality holdout", config: "Configuration A/B test" },
  status: { RUNNING: "Running", STOPPED_MATURING: "Maturing", FINAL: "Final" },
  dataStatus: { PROVISIONAL: "Provisional", FINAL: "Final" },
  actions: {
    NO_REACHOUT: "No reachout",
    CONTINUE: "Standard reachout",
    APPLY_CONFIG: "Apply configuration",
  },
  metrics: {
    PAYMENT_WITHIN_WINDOW: "Payment rate within window",
    GMV_PER_ASSIGNED_ORDER: "GMV per assigned order",
    UNITS_PER_ASSIGNED_ORDER: "Units per assigned order",
    PAYMENT_LATENCY: "Payment latency",
    MESSAGE_SEND_FAILURE_RATE: "Message send failure rate",
  },
  ranges: {
    REALTIME_6H: "Last 6 hours",
    REALTIME_24H: "Last 24 hours",
    REALTIME_72H: "Last 72 hours",
    DAILY_30D: "Last 30 days",
    DAILY_90D: "Last 90 days",
  },
  kpis: {
    assigned: "Assigned",
    matured: "Matured",
    variants: "Variants",
    srm: "Allocation quality",
    started: "Started",
    healthy: "Healthy",
    review: "Review SRM",
  },
  asOf: "Data as of {{time}}",
  experimentList: "Experiments",
  liveQueue: "Live queue",
  archive: "Final archive",
  variants: "variants",
  unknownShop: "Unknown shop",
  loadMore: "Load more",
  loadFailed: "Failed to load experiment data",
  emptyTitle: "No experiments in this view",
  emptyBody: "Try another shop, experiment type, or switch between realtime and history.",
  allocation: "Traffic & configurations",
  allocationHint: "Variant percentages are calculated within experiment traffic.",
  noReachout: "No message configuration",
  usesBaseConfiguration: "Uses the shop's base reachout configuration",
  analysis: "Outcome signal",
  comparisons: "Statistical comparisons",
  comparisonHint:
    "Randomized comparisons only. Provisional results may still change as cohorts mature.",
  noTrend: "No trend data is available for this range.",
  noComparison: "No statistical comparison is available yet.",
  awaitingMaturityTitle: "Waiting for the first mature cohort",
  awaitingMaturityBody:
    "{{assigned}} assigned orders are still inside the fixed outcome window. The next cohort matures around {{time}}; showing an earlier payment-rate comparison would bias the experiment.",
  comparisonAwaitingTitle: "Statistical comparison is not ready",
  comparisonAwaitingBody:
    "A comparison appears after both arms have mature observations. The next cohort matures around {{time}}.",
  curve: {
    paymentProgress: "Payment progress",
    metricTrend: "Metric trend",
    asOf: "Estimated {{time}}",
    focusedScale: "Focused scale {{low}}–{{high}}%",
    searchVariants: "Search variants",
    selectAll: "Select all",
    clear: "Clear",
    baselineBadge: "Baseline",
    pointEstimate: "Estimate {{value}}%",
    directionalOnly: "Directional signal",
    noExposureTitle: "No order has reached its message time yet",
    noExposureBody:
      "This curve only shows natural payment and cancellation before any reachout. It cannot be used to evaluate reachout impact yet.",
    tooltipCounts:
      "Assigned {{assigned}} · paid {{paid}} · cancelled {{cancelled}} · censored {{censored}} · at risk {{risk}} · coverage {{coverage}}%",
    axisNote: "Step curve from minute 1: share not yet converted to paid after order creation.",
    reliabilityNote:
      "Faded segments have fewer than 100 assigned orders, CI wider than 10pp, or observation coverage below 80%.",
    glossaryTitle: "How to read the observation counts",
    censoredDefinition:
      "Censored: orders whose observation ended at this snapshot before payment or cancellation was seen.",
    atRiskDefinition:
      "At risk: orders still unpaid and not cancelled at this elapsed time, so they can still reach either outcome.",
    coverageDefinition:
      "Coverage: share of assigned orders observed through this elapsed time or already at a final outcome.",
    endpointCancelled: "Endpoint cancelled {{value}}%",
    endpointStillUnpaid: "Endpoint still unpaid {{value}}%",
    endpointDirectional: "Endpoint estimate remains directional",
    preparingTitle: "Building the first payment-progress estimate",
    preparingBody:
      "The five-minute pipeline will publish a provisional curve after assignments reach the warehouse.",
    loadFailed: "Payment-progress curve failed to load",
    retry: "Retry",
    controlLabel: "Control · no reachout",
  },
  insufficient: "More data needed",
  ready: "Analyzable",
  table: {
    comparison: "Comparison",
    rate: "Observed value",
    lift: "Relative difference",
    signal: "Signal",
  },
};

type Translation = typeof base;
type TranslationOverride = Partial<
  Omit<
    Translation,
    | "tabs"
    | "filters"
    | "types"
    | "status"
    | "dataStatus"
    | "actions"
    | "metrics"
    | "ranges"
    | "kpis"
    | "curve"
    | "table"
  >
> & {
  tabs?: Partial<Translation["tabs"]>;
  filters?: Partial<Translation["filters"]>;
  types?: Partial<Translation["types"]>;
  status?: Partial<Translation["status"]>;
  dataStatus?: Partial<Translation["dataStatus"]>;
  actions?: Partial<Translation["actions"]>;
  metrics?: Partial<Translation["metrics"]>;
  ranges?: Partial<Translation["ranges"]>;
  kpis?: Partial<Translation["kpis"]>;
  curve?: Partial<Translation["curve"]>;
  table?: Partial<Translation["table"]>;
};
const localized = (value: TranslationOverride): Translation => ({
  ...base,
  ...value,
  tabs: { ...base.tabs, ...value.tabs },
  filters: { ...base.filters, ...value.filters },
  types: { ...base.types, ...value.types },
  status: { ...base.status, ...value.status },
  dataStatus: { ...base.dataStatus, ...value.dataStatus },
  actions: { ...base.actions, ...value.actions },
  metrics: { ...base.metrics, ...value.metrics },
  ranges: { ...base.ranges, ...value.ranges },
  kpis: { ...base.kpis, ...value.kpis },
  curve: { ...base.curve, ...value.curve },
  table: { ...base.table, ...value.table },
});

export const customerServiceExperimentTranslations = {
  de: localized({
    title: "Experimentanalyse",
    subtitle:
      "Live-Signale, Reifegrad und Endergebnisse randomisierter Experimente für unbezahlte Bestellungen.",
    tabs: { label: "Experimentansicht", realtime: "Echtzeit", history: "Verlauf" },
    filters: {
      shop: "Shop",
      type: "Experimenttyp",
      allShops: "Alle Shops",
      allTypes: "Alle Experimenttypen",
    },
    types: { holdout: "Inkrementalitäts-Holdout", config: "Konfigurations-A/B-Test" },
    status: { RUNNING: "Läuft", STOPPED_MATURING: "Reift", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Vorläufig", FINAL: "Final" },
    asOf: "Datenstand {{time}}",
    liveQueue: "Live-Experimente",
    archive: "Finales Archiv",
    variants: "Varianten",
    loadMore: "Mehr laden",
    analysis: "Ergebnissignal",
    comparisons: "Statistische Vergleiche",
    insufficient: "Mehr Daten nötig",
    ready: "Analysierbar",
  }),
  es: localized({
    title: "Análisis de experimentos",
    subtitle:
      "Consulta señales en vivo, madurez y resultados finales de experimentos aleatorios de pedidos sin pagar.",
    tabs: { label: "Vista del experimento", realtime: "Tiempo real", history: "Historial" },
    filters: {
      shop: "Tienda",
      type: "Tipo de experimento",
      allShops: "Todas las tiendas",
      allTypes: "Todos los tipos",
    },
    types: { holdout: "Holdout de incrementalidad", config: "Prueba A/B de configuración" },
    status: { RUNNING: "En curso", STOPPED_MATURING: "Madurando", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Provisional", FINAL: "Final" },
    asOf: "Datos hasta {{time}}",
    liveQueue: "Cola activa",
    archive: "Archivo final",
    variants: "variantes",
    loadMore: "Cargar más",
    analysis: "Señal de resultado",
    comparisons: "Comparaciones estadísticas",
    insufficient: "Faltan datos",
    ready: "Analizable",
  }),
  fr: localized({
    title: "Analyse des expériences",
    subtitle:
      "Consultez les signaux en direct, la maturité et les résultats finaux des expériences sur les commandes impayées.",
    tabs: { label: "Vue expérience", realtime: "Temps réel", history: "Historique" },
    filters: {
      shop: "Boutique",
      type: "Type d’expérience",
      allShops: "Toutes les boutiques",
      allTypes: "Tous les types",
    },
    types: { holdout: "Holdout d’incrémentalité", config: "Test A/B de configuration" },
    status: { RUNNING: "En cours", STOPPED_MATURING: "En maturation", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Provisoire", FINAL: "Final" },
    asOf: "Données au {{time}}",
    liveQueue: "File active",
    archive: "Archive finale",
    variants: "variantes",
    loadMore: "Charger plus",
    analysis: "Signal de résultat",
    comparisons: "Comparaisons statistiques",
    insufficient: "Données insuffisantes",
    ready: "Analysable",
  }),
  id: localized({
    title: "Analisis eksperimen",
    subtitle:
      "Lihat sinyal langsung, kematangan, dan hasil akhir eksperimen acak pesanan belum dibayar.",
    tabs: { label: "Tampilan eksperimen", realtime: "Waktu nyata", history: "Riwayat" },
    filters: {
      shop: "Toko",
      type: "Jenis eksperimen",
      allShops: "Semua toko",
      allTypes: "Semua jenis eksperimen",
    },
    types: { holdout: "Holdout inkrementalitas", config: "Uji A/B konfigurasi" },
    status: { RUNNING: "Berjalan", STOPPED_MATURING: "Dalam pematangan", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Sementara", FINAL: "Final" },
    asOf: "Data per {{time}}",
    liveQueue: "Antrean aktif",
    archive: "Arsip final",
    variants: "varian",
    loadMore: "Muat lagi",
    analysis: "Sinyal hasil",
    comparisons: "Perbandingan statistik",
    insufficient: "Perlu lebih banyak data",
    ready: "Dapat dianalisis",
  }),
  it: localized({
    title: "Analisi degli esperimenti",
    subtitle:
      "Consulta segnali in tempo reale, maturazione e risultati finali degli esperimenti sugli ordini non pagati.",
    tabs: { label: "Vista esperimento", realtime: "Tempo reale", history: "Cronologia" },
    filters: {
      shop: "Negozio",
      type: "Tipo di esperimento",
      allShops: "Tutti i negozi",
      allTypes: "Tutti i tipi",
    },
    types: { holdout: "Holdout di incrementalità", config: "Test A/B di configurazione" },
    status: { RUNNING: "In corso", STOPPED_MATURING: "In maturazione", FINAL: "Finale" },
    dataStatus: { PROVISIONAL: "Provvisorio", FINAL: "Finale" },
    asOf: "Dati aggiornati al {{time}}",
    liveQueue: "Coda attiva",
    archive: "Archivio finale",
    variants: "varianti",
    loadMore: "Carica altro",
    analysis: "Segnale risultato",
    comparisons: "Confronti statistici",
    insufficient: "Servono più dati",
    ready: "Analizzabile",
  }),
  th: localized({
    title: "การวิเคราะห์การทดลอง",
    subtitle: "ดูสัญญาณแบบเรียลไทม์ ความสมบูรณ์ และผลลัพธ์สุดท้ายของการทดลองคำสั่งซื้อที่ยังไม่ชำระเงิน",
    tabs: { label: "มุมมองการทดลอง", realtime: "เรียลไทม์", history: "ประวัติ" },
    filters: { shop: "ร้านค้า", type: "ประเภทการทดลอง", allShops: "ทุกร้านค้า", allTypes: "ทุกประเภท" },
    types: { holdout: "การวัดผลส่วนเพิ่ม", config: "ทดสอบการตั้งค่า A/B" },
    status: { RUNNING: "กำลังทำงาน", STOPPED_MATURING: "กำลังรอข้อมูล", FINAL: "เสร็จสิ้น" },
    dataStatus: { PROVISIONAL: "ชั่วคราว", FINAL: "สุดท้าย" },
    asOf: "ข้อมูล ณ {{time}}",
    liveQueue: "รายการสด",
    archive: "ประวัติที่เสร็จแล้ว",
    variants: "รูปแบบ",
    loadMore: "โหลดเพิ่ม",
    analysis: "สัญญาณผลลัพธ์",
    comparisons: "การเปรียบเทียบทางสถิติ",
    insufficient: "ข้อมูลยังไม่พอ",
    ready: "วิเคราะห์ได้",
  }),
} as const;
