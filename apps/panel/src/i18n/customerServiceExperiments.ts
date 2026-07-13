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
    searchShops: "Search shops",
    searchExperiments: "Search experiments",
  },
  terms: {
    control: "Control",
    treatment: "Reachout-eligible traffic",
    productionConfig: "Current production configuration",
  },
  duration: { minute: "{{count}} min", hour: "{{count}} hr", day: "{{count}} day" },
  types: { holdout: "Incrementality holdout", config: "Configuration A/B test" },
  status: { RUNNING: "Running", STOPPED_MATURING: "Ended", FINAL: "Final" },
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
  sampleSize: "Sample {{value}}",
  unknownShop: "Unknown shop",
  loadMore: "Load more",
  loadFailed: "Failed to load experiment data",
  emptyTitle: "No experiments in this view",
  emptyBody: "Try another shop, experiment type, or switch between realtime and history.",
  allocation: "Traffic & configurations",
  allocationHint: "Variant percentages are calculated within experiment traffic.",
  noReachout: "No message configuration",
  usesBaseConfiguration: "Uses the shop's base reachout configuration",
  viewConfiguration: "View configuration",
  configurationTitle: "{{variant}} configuration",
  configurationSubtitle: "The immutable reachout plan assigned to this experiment variant.",
  stageLabel: "Stage {{index}}",
  enabledStage: "Enabled",
  disabledStage: "Disabled",
  afterOrder: "{{minutes}} minutes after order",
  messageTemplate: "Message template",
  configurationUnavailable: "The historical configuration snapshot is unavailable.",
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
    estimatorLabel: "Payment-progress estimator",
    modelEstimator: "Modeled signal",
    modelEstimatorHint: "Shared natural hazard before reachout",
    rawEstimator: "Raw steps",
    rawEstimatorHint: "Non-parametric diagnostic",
    asOf: "Estimated {{time}}",
    focusedScale: "Focused scale {{low}}–{{high}}%",
    timeWindow: "Time window",
    fullWindow: "Full",
    resetWindow: "Reset range",
    dragHint: "Drag horizontally on the chart to zoom into any range",
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
    modelAxisNote:
      "Shared-hazard model from minute 1: arms share the natural payment baseline until their reachout begins.",
    rawAxisNote:
      "Raw Aalen–Johansen steps from minute 1: the non-parametric share not yet converted to paid.",
    modelIntervalLabel: "95% uncertainty band",
    rawIntervalLabel: "95% CI",
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
    confidenceInterval: "95% confidence interval",
    pValue: "p-value",
    versus: "versus {{baseline}}",
    signal: "Signal",
  },
};

type Translation = typeof base;
type TranslationOverride = Partial<
  Omit<
    Translation,
    | "tabs"
    | "filters"
    | "terms"
    | "duration"
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
  terms?: Partial<Translation["terms"]>;
  duration?: Partial<Translation["duration"]>;
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
  terms: { ...base.terms, ...value.terms },
  duration: { ...base.duration, ...value.duration },
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
    eyebrow: "KUNDENSERVICE · EXPERIMENTLABOR",
    title: "Experimentanalyse",
    subtitle:
      "Live-Signale, Reifegrad und Endergebnisse randomisierter Experimente für unbezahlte Bestellungen.",
    tabs: { label: "Experimentansicht", realtime: "Echtzeit", history: "Verlauf" },
    filters: {
      shop: "Shop",
      type: "Experimenttyp",
      allShops: "Alle Shops",
      allTypes: "Alle Experimenttypen",
      searchShops: "Shops durchsuchen",
      searchExperiments: "Experimente durchsuchen",
    },
    terms: {
      control: "Kontrollgruppe",
      treatment: "Für Kontaktaufnahme vorgesehener Traffic",
      productionConfig: "Aktuelle Produktionskonfiguration",
    },
    duration: { minute: "{{count}} Min.", hour: "{{count}} Std.", day: "{{count}} Tag" },
    actions: {
      NO_REACHOUT: "Keine Kontaktaufnahme",
      CONTINUE: "Standard-Kontaktaufnahme",
      APPLY_CONFIG: "Konfiguration anwenden",
    },
    types: { holdout: "Inkrementalitäts-Holdout", config: "Konfigurations-A/B-Test" },
    status: { RUNNING: "Läuft", STOPPED_MATURING: "Beendet", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Vorläufig", FINAL: "Final" },
    asOf: "Datenstand {{time}}",
    liveQueue: "Live-Experimente",
    archive: "Finales Archiv",
    variants: "Varianten",
    sampleSize: "Stichprobe {{value}}",
    loadMore: "Mehr laden",
    analysis: "Ergebnissignal",
    comparisons: "Statistische Vergleiche",
    curve: {
      modelEstimator: "Modellsignal",
      modelEstimatorHint: "Gemeinsame natürliche Zahlungsrate vor der Kontaktaufnahme",
      rawEstimator: "Rohdaten-Stufen",
      rawEstimatorHint: "Nichtparametrische Diagnose",
      timeWindow: "Zeitfenster",
      fullWindow: "Gesamt",
      resetWindow: "Bereich zurücksetzen",
      dragHint: "Im Diagramm horizontal ziehen, um einen Bereich zu vergrößern",
      modelAxisNote:
        "Modell der gemeinsamen Zahlungsrate ab Minute 1: Bis zur Kontaktaufnahme verwenden alle Gruppen dieselbe natürliche Zahlungsbasis.",
      rawAxisNote:
        "Rohe Aalen–Johansen-Stufen ab Minute 1: nichtparametrischer Anteil der noch nicht bezahlten Bestellungen.",
      modelIntervalLabel: "95-%-Unsicherheitsintervall",
      rawIntervalLabel: "95-%-Konfidenzintervall",
      controlLabel: "Kontrollgruppe · keine Kontaktaufnahme",
    },
    table: {
      confidenceInterval: "95-%-Konfidenzintervall",
      pValue: "p-Wert",
      versus: "gegen {{baseline}}",
    },
    insufficient: "Mehr Daten nötig",
    ready: "Analysierbar",
  }),
  es: localized({
    eyebrow: "ATENCIÓN AL CLIENTE · LABORATORIO DE EXPERIMENTOS",
    title: "Análisis de experimentos",
    subtitle:
      "Consulta señales en vivo, madurez y resultados finales de experimentos aleatorios de pedidos sin pagar.",
    tabs: { label: "Vista del experimento", realtime: "Tiempo real", history: "Historial" },
    filters: {
      shop: "Tienda",
      type: "Tipo de experimento",
      allShops: "Todas las tiendas",
      allTypes: "Todos los tipos",
      searchShops: "Buscar tiendas",
      searchExperiments: "Buscar experimentos",
    },
    terms: {
      control: "Grupo de control",
      treatment: "Tráfico apto para contacto",
      productionConfig: "Configuración actual de producción",
    },
    duration: { minute: "{{count}} min", hour: "{{count}} h", day: "{{count}} día" },
    actions: {
      NO_REACHOUT: "Sin contacto",
      CONTINUE: "Contacto estándar",
      APPLY_CONFIG: "Aplicar configuración",
    },
    types: { holdout: "Holdout de incrementalidad", config: "Prueba A/B de configuración" },
    status: { RUNNING: "En curso", STOPPED_MATURING: "Finalizado", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Provisional", FINAL: "Final" },
    asOf: "Datos hasta {{time}}",
    liveQueue: "Cola activa",
    archive: "Archivo final",
    variants: "variantes",
    sampleSize: "Muestra {{value}}",
    loadMore: "Cargar más",
    analysis: "Señal de resultado",
    comparisons: "Comparaciones estadísticas",
    curve: {
      modelEstimator: "Señal modelada",
      modelEstimatorHint: "Tasa natural de pago compartida antes del contacto",
      rawEstimator: "Escalones sin ajustar",
      rawEstimatorHint: "Diagnóstico no paramétrico",
      timeWindow: "Intervalo de tiempo",
      fullWindow: "Todo",
      resetWindow: "Restablecer intervalo",
      dragHint: "Arrastra horizontalmente en el gráfico para ampliar cualquier intervalo",
      modelAxisNote:
        "Modelo de tasa de pago compartida desde el minuto 1: los grupos comparten la base natural hasta el inicio del contacto.",
      rawAxisNote:
        "Escalones Aalen–Johansen desde el minuto 1: proporción no paramétrica que aún no se ha convertido en pago.",
      modelIntervalLabel: "Intervalo de incertidumbre del 95 %",
      rawIntervalLabel: "Intervalo de confianza del 95 %",
      controlLabel: "Grupo de control · sin contacto",
    },
    table: {
      confidenceInterval: "Intervalo de confianza del 95 %",
      pValue: "valor p",
      versus: "frente a {{baseline}}",
    },
    insufficient: "Faltan datos",
    ready: "Analizable",
  }),
  fr: localized({
    eyebrow: "SERVICE CLIENT · LABORATOIRE D’EXPÉRIENCES",
    title: "Analyse des expériences",
    subtitle:
      "Consultez les signaux en direct, la maturité et les résultats finaux des expériences sur les commandes impayées.",
    tabs: { label: "Vue expérience", realtime: "Temps réel", history: "Historique" },
    filters: {
      shop: "Boutique",
      type: "Type d’expérience",
      allShops: "Toutes les boutiques",
      allTypes: "Tous les types",
      searchShops: "Rechercher des boutiques",
      searchExperiments: "Rechercher des expériences",
    },
    terms: {
      control: "Groupe témoin",
      treatment: "Trafic éligible à la relance",
      productionConfig: "Configuration de production actuelle",
    },
    duration: { minute: "{{count}} min", hour: "{{count}} h", day: "{{count}} jour" },
    actions: {
      NO_REACHOUT: "Aucun contact",
      CONTINUE: "Contact standard",
      APPLY_CONFIG: "Appliquer la configuration",
    },
    types: { holdout: "Holdout d’incrémentalité", config: "Test A/B de configuration" },
    status: { RUNNING: "En cours", STOPPED_MATURING: "Terminée", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Provisoire", FINAL: "Final" },
    asOf: "Données au {{time}}",
    liveQueue: "File active",
    archive: "Archive finale",
    variants: "variantes",
    sampleSize: "Échantillon {{value}}",
    loadMore: "Charger plus",
    analysis: "Signal de résultat",
    comparisons: "Comparaisons statistiques",
    curve: {
      modelEstimator: "Signal modélisé",
      modelEstimatorHint: "Taux naturel de paiement partagé avant le contact",
      rawEstimator: "Paliers bruts",
      rawEstimatorHint: "Diagnostic non paramétrique",
      timeWindow: "Fenêtre temporelle",
      fullWindow: "Tout",
      resetWindow: "Réinitialiser la plage",
      dragHint: "Faites glisser horizontalement sur le graphique pour agrandir une plage",
      modelAxisNote:
        "Modèle de taux de paiement partagé dès la minute 1 : les groupes partagent la base naturelle avant leur contact.",
      rawAxisNote:
        "Paliers Aalen–Johansen dès la minute 1 : part non paramétrique des commandes pas encore payées.",
      modelIntervalLabel: "Intervalle d’incertitude à 95 %",
      rawIntervalLabel: "Intervalle de confiance à 95 %",
      controlLabel: "Groupe témoin · aucun contact",
    },
    table: {
      confidenceInterval: "Intervalle de confiance à 95 %",
      pValue: "valeur p",
      versus: "par rapport à {{baseline}}",
    },
    insufficient: "Données insuffisantes",
    ready: "Analysable",
  }),
  id: localized({
    eyebrow: "LAYANAN PELANGGAN · LAB EKSPERIMEN",
    title: "Analisis eksperimen",
    subtitle:
      "Lihat sinyal langsung, kematangan, dan hasil akhir eksperimen acak pesanan belum dibayar.",
    tabs: { label: "Tampilan eksperimen", realtime: "Waktu nyata", history: "Riwayat" },
    filters: {
      shop: "Toko",
      type: "Jenis eksperimen",
      allShops: "Semua toko",
      allTypes: "Semua jenis eksperimen",
      searchShops: "Cari toko",
      searchExperiments: "Cari eksperimen",
    },
    terms: {
      control: "Grup kontrol",
      treatment: "Traffic yang memenuhi syarat untuk dijangkau",
      productionConfig: "Konfigurasi produksi saat ini",
    },
    duration: { minute: "{{count}} mnt", hour: "{{count}} jam", day: "{{count}} hari" },
    actions: {
      NO_REACHOUT: "Tanpa pesan",
      CONTINUE: "Pesan standar",
      APPLY_CONFIG: "Terapkan konfigurasi",
    },
    types: { holdout: "Holdout inkrementalitas", config: "Uji A/B konfigurasi" },
    status: { RUNNING: "Berjalan", STOPPED_MATURING: "Selesai", FINAL: "Final" },
    dataStatus: { PROVISIONAL: "Sementara", FINAL: "Final" },
    asOf: "Data per {{time}}",
    liveQueue: "Antrean aktif",
    archive: "Arsip final",
    variants: "varian",
    sampleSize: "Sampel {{value}}",
    loadMore: "Muat lagi",
    analysis: "Sinyal hasil",
    comparisons: "Perbandingan statistik",
    curve: {
      modelEstimator: "Sinyal model",
      modelEstimatorHint: "Laju pembayaran alami bersama sebelum pesan dikirim",
      rawEstimator: "Tangga mentah",
      rawEstimatorHint: "Diagnostik nonparametrik",
      timeWindow: "Rentang waktu",
      fullWindow: "Semua",
      resetWindow: "Atur ulang rentang",
      dragHint: "Seret secara horizontal pada grafik untuk memperbesar rentang mana pun",
      modelAxisNote:
        "Model laju pembayaran bersama sejak menit 1: semua grup memakai dasar pembayaran alami yang sama sebelum pesan dikirim.",
      rawAxisNote:
        "Tangga Aalen–Johansen sejak menit 1: proporsi nonparametrik yang belum berubah menjadi pembayaran.",
      modelIntervalLabel: "Rentang ketidakpastian 95%",
      rawIntervalLabel: "Interval kepercayaan 95%",
      controlLabel: "Grup kontrol · tanpa pesan",
    },
    table: {
      confidenceInterval: "Interval kepercayaan 95%",
      pValue: "nilai p",
      versus: "dibanding {{baseline}}",
    },
    insufficient: "Perlu lebih banyak data",
    ready: "Dapat dianalisis",
  }),
  it: localized({
    eyebrow: "SERVIZIO CLIENTI · LABORATORIO ESPERIMENTI",
    title: "Analisi degli esperimenti",
    subtitle:
      "Consulta segnali in tempo reale, maturazione e risultati finali degli esperimenti sugli ordini non pagati.",
    tabs: { label: "Vista esperimento", realtime: "Tempo reale", history: "Cronologia" },
    filters: {
      shop: "Negozio",
      type: "Tipo di esperimento",
      allShops: "Tutti i negozi",
      allTypes: "Tutti i tipi",
      searchShops: "Cerca negozi",
      searchExperiments: "Cerca esperimenti",
    },
    terms: {
      control: "Gruppo di controllo",
      treatment: "Traffico idoneo al contatto",
      productionConfig: "Configurazione di produzione attuale",
    },
    duration: { minute: "{{count}} min", hour: "{{count}} h", day: "{{count}} giorno" },
    actions: {
      NO_REACHOUT: "Nessun contatto",
      CONTINUE: "Contatto standard",
      APPLY_CONFIG: "Applica configurazione",
    },
    types: { holdout: "Holdout di incrementalità", config: "Test A/B di configurazione" },
    status: { RUNNING: "In corso", STOPPED_MATURING: "Terminato", FINAL: "Finale" },
    dataStatus: { PROVISIONAL: "Provvisorio", FINAL: "Finale" },
    asOf: "Dati aggiornati al {{time}}",
    liveQueue: "Coda attiva",
    archive: "Archivio finale",
    variants: "varianti",
    sampleSize: "Campione {{value}}",
    loadMore: "Carica altro",
    analysis: "Segnale risultato",
    comparisons: "Confronti statistici",
    curve: {
      modelEstimator: "Segnale modellato",
      modelEstimatorHint: "Tasso naturale di pagamento condiviso prima del contatto",
      rawEstimator: "Gradini grezzi",
      rawEstimatorHint: "Diagnostica non parametrica",
      timeWindow: "Intervallo temporale",
      fullWindow: "Tutto",
      resetWindow: "Reimposta intervallo",
      dragHint: "Trascina orizzontalmente sul grafico per ingrandire qualsiasi intervallo",
      modelAxisNote:
        "Modello del tasso di pagamento condiviso dal minuto 1: i gruppi condividono la base naturale prima del contatto.",
      rawAxisNote:
        "Gradini Aalen–Johansen dal minuto 1: quota non parametrica degli ordini non ancora pagati.",
      modelIntervalLabel: "Intervallo di incertezza al 95%",
      rawIntervalLabel: "Intervallo di confidenza al 95%",
      controlLabel: "Gruppo di controllo · nessun contatto",
    },
    table: {
      confidenceInterval: "Intervallo di confidenza al 95%",
      pValue: "valore p",
      versus: "rispetto a {{baseline}}",
    },
    insufficient: "Servono più dati",
    ready: "Analizzabile",
  }),
  th: localized({
    eyebrow: "บริการลูกค้า · ห้องทดลอง",
    title: "การวิเคราะห์การทดลอง",
    subtitle: "ดูสัญญาณแบบเรียลไทม์ ความสมบูรณ์ และผลลัพธ์สุดท้ายของการทดลองคำสั่งซื้อที่ยังไม่ชำระเงิน",
    tabs: { label: "มุมมองการทดลอง", realtime: "เรียลไทม์", history: "ประวัติ" },
    filters: {
      shop: "ร้านค้า",
      type: "ประเภทการทดลอง",
      allShops: "ทุกร้านค้า",
      allTypes: "ทุกประเภท",
      searchShops: "ค้นหาร้านค้า",
      searchExperiments: "ค้นหาการทดลอง",
    },
    terms: {
      control: "กลุ่มควบคุม",
      treatment: "ทราฟฟิกที่เข้าเกณฑ์การติดต่อ",
      productionConfig: "การกำหนดค่าที่ใช้งานจริงในปัจจุบัน",
    },
    duration: { minute: "{{count}} นาที", hour: "{{count}} ชม.", day: "{{count}} วัน" },
    actions: {
      NO_REACHOUT: "ไม่ส่งข้อความ",
      CONTINUE: "ส่งข้อความตามปกติ",
      APPLY_CONFIG: "ใช้การตั้งค่า",
    },
    types: { holdout: "การวัดผลส่วนเพิ่ม", config: "ทดสอบการตั้งค่า A/B" },
    status: { RUNNING: "กำลังทำงาน", STOPPED_MATURING: "สิ้นสุดแล้ว", FINAL: "เสร็จสิ้น" },
    dataStatus: { PROVISIONAL: "ชั่วคราว", FINAL: "สุดท้าย" },
    asOf: "ข้อมูล ณ {{time}}",
    liveQueue: "รายการสด",
    archive: "ประวัติที่เสร็จแล้ว",
    variants: "รูปแบบ",
    sampleSize: "ตัวอย่าง {{value}}",
    loadMore: "โหลดเพิ่ม",
    analysis: "สัญญาณผลลัพธ์",
    comparisons: "การเปรียบเทียบทางสถิติ",
    curve: {
      modelEstimator: "สัญญาณจากแบบจำลอง",
      modelEstimatorHint: "อัตราการชำระเงินตามธรรมชาติร่วมกันก่อนส่งข้อความ",
      rawEstimator: "ขั้นข้อมูลดิบ",
      rawEstimatorHint: "การวินิจฉัยแบบไม่อิงพารามิเตอร์",
      timeWindow: "ช่วงเวลา",
      fullWindow: "ทั้งหมด",
      resetWindow: "รีเซ็ตช่วง",
      dragHint: "ลากในแนวนอนบนกราฟเพื่อขยายช่วงเวลาใดก็ได้",
      modelAxisNote:
        "แบบจำลองอัตราการชำระเงินร่วมกันตั้งแต่นาทีที่ 1: ทุกกลุ่มใช้ฐานการชำระเงินตามธรรมชาติเดียวกันก่อนส่งข้อความ",
      rawAxisNote: "ขั้น Aalen–Johansen ตั้งแต่นาทีที่ 1: สัดส่วนแบบไม่อิงพารามิเตอร์ที่ยังไม่เปลี่ยนเป็นการชำระเงิน",
      modelIntervalLabel: "ช่วงความไม่แน่นอน 95%",
      rawIntervalLabel: "ช่วงความเชื่อมั่น 95%",
      controlLabel: "กลุ่มควบคุม · ไม่ส่งข้อความ",
    },
    table: {
      confidenceInterval: "ช่วงความเชื่อมั่น 95%",
      pValue: "ค่า p",
      versus: "เทียบกับ {{baseline}}",
    },
    insufficient: "ข้อมูลยังไม่พอ",
    ready: "วิเคราะห์ได้",
  }),
} as const;
