type TranslationTree = Record<string, unknown>;

function merge(base: TranslationTree, override: TranslationTree): TranslationTree {
  const result: TranslationTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = current && typeof current === "object" && !Array.isArray(current)
      && value && typeof value === "object" && !Array.isArray(value)
      ? merge(current as TranslationTree, value as TranslationTree)
      : value;
  }
  return result;
}

const englishAnalytics = {
  eyebrow: "Affiliate operations intelligence",
  title: "Affiliate Analytics",
  subtitle: "Follow platform performance and sample conversion as two parallel, non-additive contracts.",
  overview: "Overview",
  region: "Shop region",
  allRegions: "All regions",
  customShopScope: "Custom shop scope",
  selectedShops: "{{count}} shops selected",
  selectAll: "Select all",
  startDate: "Start date",
  endDate: "End date",
  comparison: "Comparison",
  previousPeriod: "Previous period",
  previousYear: "Previous year",
  none: "None",
  granularity: "Granularity",
  granularities: { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" },
  refresh: "Refresh",
  refreshing: "Refreshing…",
  retry: "Retry",
  loading: "Loading Affiliate Analytics",
  stale: "Stale",
  materialized: "Materialized",
  liveObserved: "Live observed {{date}}",
  noComparison: "No comparison",
  platformShort: "Platform",
  sampleShort: "Sample",
  platformEyebrow: "Platform Affiliate Performance",
  platformTitle: "Platform performance",
  sampleEyebrow: "Sample Conversion Performance",
  sampleTitle: "Sample conversion",
  platformComparison: "Platform · comparison",
  sampleComparison: "Sample · comparison",
  nonAdditive: "These GMV contracts can overlap. Never add them into an Affiliate Total.",
  portfolio: { shops: "Selected shops", campaigns: "Active campaigns", target: "Active TARGET", open: "Active OPEN" },
  metrics: {
    netGmv: "Net GMV USD", sampleGmv: "Sample-attributed net GMV USD", orders: "Orders",
    units: "Units", commission: "Commission USD", invited: "Target invited",
    responseRate: "Confirmed response rate", applications: "Applications", approvalRate: "Approval rate",
    fulfillmentRate: "Shipped observed / approved", completionRate: "Completion rate",
    shipped: "Shipped observed", contents: "Contents",
  },
  section: {
    portfolio: "Portfolio", performance: "Performance", trend: "Performance trend", activity: "Campaign activity",
    status: "Current sample status", leaderboard: "Leaderboard", health: "Data health", quality: "Contract quality",
  },
  trendMetrics: { netGmvUsd: "Net GMV USD", orders: "Orders", units: "Units", actualCommissionUsd: "Commission USD" },
  activityNote: "Activity stages are not a cohort funnel.",
  statusNonExclusive: "Status buckets do not reconcile; showing independent bars.",
  maturity: "Maturity",
  responseMaturity: "Cumulative response maturity",
  sampleAge: "Current outcome by application age",
  sampleAgeNote: "A current-state cross-section, not historical conversion time or a survival curve.",
  health: {
    creatorRows: "Creator exact row coverage", creatorGmv: "Creator exact GMV coverage",
    exactTime: "Exact application-time share", targetMapping: "TARGET-mapped applications",
    campaignMapping: "Campaign mapping coverage",
  },
  noDataTitle: "No data in this scope",
  noDataBody: "Try a wider date range or another authorized shop.",
  errorTitle: "Affiliate Analytics could not load",
  noEntitlementTitle: "Analytics access is not enabled",
  noEntitlementBody: "No authorized shop in this account currently has Analytics access.",
  signInTitle: "Sign in to view Affiliate Analytics",
  signInBody: "Your authorized shop scope is resolved from your account.",
  add: "Add",
  search: "Search",
  run: "Run",
  running: "Running…",
  loadMore: "Load more",
  entity: "Entity",
  groupPresets: {
    DATE: "Date", SHOP: "Shop", REGION: "Region", CAMPAIGN: "Campaign",
    COLLABORATION: "Collaboration", CREATOR: "Creator", PRODUCT: "Product",
  },
  leaderTypes: { SHOP: "Shop", CAMPAIGN: "Campaign", COLLABORATION: "Collaboration", CREATOR: "Creator", PRODUCT: "Product" },
  chartModes: { AUTO: "Auto", LINE: "Line", BAR: "Bar", STACKED: "Stacked", TABLE: "Table" },
  explore: {
    title: "Explore", contract: "Contract", chooseContract: "Choose one contract",
    metrics: "Metrics", groupBy: "Group by", filters: "Dimension filters",
    invalidGrouping: "This combination has no physical Aggregate contract.",
    searchValues: "Search authorized values", exactValue: "Or enter an exact value",
    sort: "Sort", direction: "Direction", limit: "Row limit", notRun: "Edits not run yet",
    rows: "{{count}} rows", mixedCurrency: "Mixed currencies — use USD metrics.",
    visualization: "Visualization", detail: "Query detail", resultTable: "Result table",
    rateTooltip: "Derived from {{numerator}} / {{denominator}}; row rates are never averaged.",
  },
} as const;

const englishTutorial = {
  welcomeTitle: "Two contracts, one operating view",
  welcomeBody: "Affiliate Analytics keeps platform performance and sample conversion parallel so overlapping GMV is never double-counted.",
  scopeTitle: "Choose the business scope",
  scopeBody: "Filter authorized shops, region, activity dates, comparison period and time granularity from one control rail.",
  contractsTitle: "Read the contracts side by side",
  contractsBody: "Each panel has its own denominators, trends and GMV. The divider is a permanent reminder that they are not additive.",
  maturityTitle: "Interpret young cohorts fairly",
  maturityBody: "Response maturity uses only invitations old enough for each horizon; sample maturity is explicitly a current-state age cross-section.",
  healthTitle: "Keep coverage visible",
  healthBody: "Identity, application-time, TARGET mapping, Campaign mapping and watermark health stay next to the business metrics.",
  exploreTitle: "Compose a contract-safe query",
  exploreBody: "Choose one contract, metrics, dimensions and filters. Unsupported physical Aggregate combinations are disabled before you run.",
  resultsTitle: "Drill without changing semantics",
  resultsBody: "Charts and tables use the same rows. Click an entity to add a filter; rates are always recomputed from total numerator and denominator.",
} as const;

const CUSTOM_SHOP_SCOPE_BY_TITLE: Record<string, string> = {
  "联盟数据分析": "自定义店铺范围",
  "Affiliate-Analysen": "Benutzerdefinierter Shop-Bereich",
  "Analítica de afiliados": "Ámbito de tiendas personalizado",
  "Analytique Affiliate": "Périmètre de boutiques personnalisé",
  "Analitik Affiliate": "Cakupan toko khusus",
  "Analytics Affiliate": "Ambito negozi personalizzato",
  "การวิเคราะห์ Affiliate": "ขอบเขตร้านค้าแบบกำหนดเอง",
};

function resource(analytics: TranslationTree, tutorial: TranslationTree, navLabel: string) {
  const localizedCustomScope = typeof analytics.title === "string" ? CUSTOM_SHOP_SCOPE_BY_TITLE[analytics.title] : undefined;
  return {
    nav: { affiliateAnalytics: navLabel },
    ecommerce: { affiliateAnalytics: merge(englishAnalytics, localizedCustomScope ? merge({ customShopScope: localizedCustomScope }, analytics) : analytics) },
    tutorial: { ecommerceAffiliateAnalytics: merge(englishTutorial, tutorial) },
  };
}

export const AFFILIATE_ANALYTICS_TRANSLATIONS = {
  en: resource({}, {}, "Analytics"),
  zh: resource({
    eyebrow: "联盟经营洞察", title: "联盟数据分析", subtitle: "并行查看平台业绩与申样转化，两套合同可能重叠，绝不相加。",
    overview: "概览", region: "店铺区域", allRegions: "全部区域", customShopScope: "自定义店铺范围", selectedShops: "已选 {{count}} 家店铺", selectAll: "全选",
    startDate: "开始日期", endDate: "结束日期", comparison: "对比", previousPeriod: "上一等长周期", previousYear: "去年同期",
    granularity: "时间粒度", granularities: { DAILY: "按日", WEEKLY: "按周", MONTHLY: "按月" }, refresh: "刷新", refreshing: "刷新中…",
    platformTitle: "平台业绩", sampleTitle: "申样转化", nonAdditive: "两套 GMV 可能重叠，不得相加为“联盟总计”。",
    section: { performance: "经营表现", trend: "业绩趋势", activity: "Campaign 活动阶段", status: "当前申样状态", leaderboard: "排行榜", health: "数据健康", quality: "合同质量" },
    maturity: "成熟度", responseMaturity: "累计回复成熟度", sampleAge: "按申请年龄查看当前结果",
    sampleAgeNote: "这是当前状态横截面，不是历史转化耗时或生存曲线。",
    explore: { title: "探索", contract: "数据合同", chooseContract: "选择一套合同", metrics: "指标", groupBy: "分组维度", filters: "维度筛选", invalidGrouping: "该组合没有对应的物理汇总合同。", searchValues: "搜索授权范围内的值", exactValue: "或输入精确值", sort: "排序", direction: "方向", limit: "行数上限", notRun: "修改尚未运行", rows: "{{count}} 行", mixedCurrency: "包含多种币种，请使用 USD 指标。", visualization: "可视化", detail: "查询明细", resultTable: "结果表" },
  }, {
    welcomeTitle: "两套合同，一个经营视图", welcomeBody: "平台业绩和申样转化始终平行呈现，避免重叠 GMV 被重复计算。",
    scopeTitle: "选择业务范围", scopeBody: "在一个控制栏中筛选授权店铺、区域、事实日期、对比周期和时间粒度。",
    contractsTitle: "并排阅读两套合同", contractsBody: "每块都有独立分母、趋势和 GMV，中间的提示永久说明二者不可相加。",
    maturityTitle: "公平解读近期数据", maturityBody: "回复曲线只纳入已成熟到对应时长的邀请；申样区明确是按申请年龄的当前状态横截面。",
    healthTitle: "让覆盖率始终可见", healthBody: "Creator、申请时间、TARGET/Campaign 映射与 watermark 健康度和业务指标一起呈现。",
    exploreTitle: "组合符合合同的查询", exploreBody: "一次选择一套合同、指标、维度和筛选；不受物理 Aggregate 支持的组合会在运行前禁用。",
    resultsTitle: "不改变语义地钻取", resultsBody: "图表和表格共用查询结果；点击实体即可筛选，Rate 始终用总分子和总分母重算。",
  }, "数据分析"),
  de: resource({ title: "Affiliate-Analysen", subtitle: "Plattformleistung und Sample-Konversion als getrennte, nicht additive Verträge.", overview: "Übersicht", region: "Shop-Region", allRegions: "Alle Regionen", selectedShops: "{{count}} Shops ausgewählt", startDate: "Startdatum", endDate: "Enddatum", comparison: "Vergleich", previousPeriod: "Vorheriger Zeitraum", previousYear: "Vorjahr", granularity: "Granularität", refresh: "Aktualisieren", platformTitle: "Plattformleistung", sampleTitle: "Sample-Konversion", nonAdditive: "Die GMV-Verträge können sich überschneiden und dürfen nicht addiert werden.", explore: { title: "Erkunden", contract: "Vertrag", chooseContract: "Einen Vertrag wählen", metrics: "Kennzahlen", groupBy: "Gruppieren nach", filters: "Dimensionsfilter", resultTable: "Ergebnistabelle" } }, {
    welcomeTitle: "Zwei Verträge, eine Betriebsansicht", welcomeBody: "Plattformleistung und Sample-Konversion bleiben getrennt, damit überlappender GMV nie doppelt zählt.", scopeTitle: "Geschäftsbereich wählen", scopeBody: "Autorisierte Shops, Region, Datum, Vergleich und Zeitgranularität filtern.", contractsTitle: "Verträge nebeneinander lesen", contractsBody: "Jeder Bereich besitzt eigene Nenner, Trends und GMV; sie sind nicht additiv.", maturityTitle: "Junge Kohorten fair deuten", maturityBody: "Nur ausreichend alte Einladungen zählen je Zeithorizont; Sample-Alter ist ein aktueller Querschnitt.", healthTitle: "Abdeckung sichtbar halten", healthBody: "Identität, Zeitbasis, Zuordnungen und Watermarks stehen neben den Geschäftsmetriken.", exploreTitle: "Vertragssichere Abfrage erstellen", exploreBody: "Nicht unterstützte Aggregate-Kombinationen werden vor dem Start deaktiviert.", resultsTitle: "Mit stabiler Semantik aufschlüsseln", resultsBody: "Diagramm und Tabelle nutzen dieselben Zeilen; Raten werden aus Gesamtzähler und -nenner berechnet."
  }, "Analysen"),
  es: resource({ title: "Analítica de afiliados", subtitle: "Rendimiento de plataforma y conversión de muestras como contratos separados y no aditivos.", overview: "Resumen", region: "Región de tienda", allRegions: "Todas las regiones", selectedShops: "{{count}} tiendas seleccionadas", startDate: "Fecha inicial", endDate: "Fecha final", comparison: "Comparación", previousPeriod: "Periodo anterior", previousYear: "Año anterior", granularity: "Granularidad", refresh: "Actualizar", platformTitle: "Rendimiento de plataforma", sampleTitle: "Conversión de muestras", nonAdditive: "Los contratos de GMV pueden solaparse y nunca deben sumarse.", explore: { title: "Explorar", contract: "Contrato", chooseContract: "Elige un contrato", metrics: "Métricas", groupBy: "Agrupar por", filters: "Filtros de dimensión", resultTable: "Tabla de resultados" } }, {
    welcomeTitle: "Dos contratos, una vista operativa", welcomeBody: "El rendimiento y la conversión permanecen separados para no contar dos veces el GMV.", scopeTitle: "Elige el alcance", scopeBody: "Filtra tiendas autorizadas, región, fechas, comparación y granularidad.", contractsTitle: "Lee ambos contratos en paralelo", contractsBody: "Cada panel conserva sus denominadores, tendencias y GMV; no son aditivos.", maturityTitle: "Interpreta cohortes recientes", maturityBody: "Cada horizonte usa invitaciones suficientemente maduras; la edad de solicitud es un corte del estado actual.", healthTitle: "Mantén visible la cobertura", healthBody: "Identidad, tiempo, mapeos y watermarks acompañan a las métricas.", exploreTitle: "Compón una consulta segura", exploreBody: "Las combinaciones Aggregate no admitidas se desactivan antes de ejecutar.", resultsTitle: "Profundiza sin cambiar la semántica", resultsBody: "Gráfico y tabla comparten filas; las tasas se recalculan con numerador y denominador totales."
  }, "Analítica"),
  fr: resource({ title: "Analytique Affiliate", subtitle: "Performance plateforme et conversion d’échantillons comme contrats séparés et non additifs.", overview: "Vue d’ensemble", region: "Région boutique", allRegions: "Toutes les régions", selectedShops: "{{count}} boutiques sélectionnées", startDate: "Date de début", endDate: "Date de fin", comparison: "Comparaison", previousPeriod: "Période précédente", previousYear: "Année précédente", granularity: "Granularité", refresh: "Actualiser", platformTitle: "Performance plateforme", sampleTitle: "Conversion échantillons", nonAdditive: "Les contrats GMV peuvent se chevaucher et ne doivent jamais être additionnés.", explore: { title: "Explorer", contract: "Contrat", chooseContract: "Choisir un contrat", metrics: "Indicateurs", groupBy: "Regrouper par", filters: "Filtres de dimension", resultTable: "Tableau de résultats" } }, {
    welcomeTitle: "Deux contrats, une vue opérationnelle", welcomeBody: "Les deux performances restent parallèles pour éviter tout double comptage du GMV.", scopeTitle: "Choisir le périmètre", scopeBody: "Filtrez boutiques autorisées, région, dates, comparaison et granularité.", contractsTitle: "Lire les contrats côte à côte", contractsBody: "Chaque panneau garde ses dénominateurs, tendances et GMV ; ils ne s’additionnent pas.", maturityTitle: "Interpréter les cohortes récentes", maturityBody: "Chaque horizon retient les invitations assez anciennes ; l’âge des demandes décrit l’état actuel.", healthTitle: "Garder la couverture visible", healthBody: "Identité, temps, mappings et watermarks accompagnent les métriques métier.", exploreTitle: "Composer une requête conforme", exploreBody: "Les combinaisons Aggregate non prises en charge sont désactivées avant exécution.", resultsTitle: "Explorer sans changer la sémantique", resultsBody: "Graphique et tableau partagent les lignes ; les taux sont recalculés depuis les totaux."
  }, "Analytique"),
  id: resource({ title: "Analitik Affiliate", subtitle: "Kinerja platform dan konversi sampel sebagai dua kontrak terpisah yang tidak dijumlahkan.", overview: "Ringkasan", region: "Wilayah toko", allRegions: "Semua wilayah", selectedShops: "{{count}} toko dipilih", startDate: "Tanggal mulai", endDate: "Tanggal akhir", comparison: "Perbandingan", previousPeriod: "Periode sebelumnya", previousYear: "Tahun sebelumnya", granularity: "Granularitas", refresh: "Segarkan", platformTitle: "Kinerja platform", sampleTitle: "Konversi sampel", nonAdditive: "Kontrak GMV dapat tumpang tindih dan tidak boleh dijumlahkan.", explore: { title: "Jelajahi", contract: "Kontrak", chooseContract: "Pilih satu kontrak", metrics: "Metrik", groupBy: "Kelompokkan", filters: "Filter dimensi", resultTable: "Tabel hasil" } }, {
    welcomeTitle: "Dua kontrak, satu tampilan operasi", welcomeBody: "Kinerja platform dan sampel tetap terpisah agar GMV tidak dihitung ganda.", scopeTitle: "Pilih cakupan bisnis", scopeBody: "Filter toko, wilayah, tanggal, pembanding, dan granularitas yang diizinkan.", contractsTitle: "Baca kontrak berdampingan", contractsBody: "Setiap panel memiliki penyebut, tren, dan GMV sendiri; nilainya tidak dijumlahkan.", maturityTitle: "Baca kohor baru dengan adil", maturityBody: "Setiap horizon hanya memakai undangan yang cukup matang; umur aplikasi adalah potret status saat ini.", healthTitle: "Tampilkan cakupan", healthBody: "Identitas, waktu, mapping, dan watermark tampil bersama metrik bisnis.", exploreTitle: "Susun kueri yang aman", exploreBody: "Kombinasi Aggregate yang tidak didukung dinonaktifkan sebelum dijalankan.", resultsTitle: "Telusuri tanpa mengubah semantik", resultsBody: "Grafik dan tabel memakai baris yang sama; rate dihitung dari total pembilang dan penyebut."
  }, "Analitik"),
  it: resource({ title: "Analytics Affiliate", subtitle: "Performance della piattaforma e conversione campioni come contratti separati e non additivi.", overview: "Panoramica", region: "Regione negozio", allRegions: "Tutte le regioni", selectedShops: "{{count}} negozi selezionati", startDate: "Data iniziale", endDate: "Data finale", comparison: "Confronto", previousPeriod: "Periodo precedente", previousYear: "Anno precedente", granularity: "Granularità", refresh: "Aggiorna", platformTitle: "Performance piattaforma", sampleTitle: "Conversione campioni", nonAdditive: "I contratti GMV possono sovrapporsi e non devono mai essere sommati.", explore: { title: "Esplora", contract: "Contratto", chooseContract: "Scegli un contratto", metrics: "Metriche", groupBy: "Raggruppa per", filters: "Filtri dimensionali", resultTable: "Tabella risultati" } }, {
    welcomeTitle: "Due contratti, una vista operativa", welcomeBody: "Le due performance restano separate per non conteggiare due volte il GMV.", scopeTitle: "Scegli l’ambito", scopeBody: "Filtra negozi autorizzati, regione, date, confronto e granularità.", contractsTitle: "Leggi i contratti affiancati", contractsBody: "Ogni pannello conserva denominatori, trend e GMV propri; non sono additivi.", maturityTitle: "Interpreta le coorti recenti", maturityBody: "Ogni orizzonte usa inviti abbastanza maturi; l’età della richiesta è una sezione dello stato attuale.", healthTitle: "Mantieni visibile la copertura", healthBody: "Identità, tempi, mapping e watermark affiancano le metriche di business.", exploreTitle: "Componi una query sicura", exploreBody: "Le combinazioni Aggregate non supportate vengono disabilitate prima dell’esecuzione.", resultsTitle: "Approfondisci senza cambiare semantica", resultsBody: "Grafico e tabella condividono le righe; i tassi sono ricalcolati dai totali."
  }, "Analytics"),
  th: resource({ title: "การวิเคราะห์ Affiliate", subtitle: "แสดงผลงานแพลตฟอร์มและการแปลงตัวอย่างเป็นสัญญาแยกกันและห้ามรวมยอด", overview: "ภาพรวม", region: "ภูมิภาคร้าน", allRegions: "ทุกภูมิภาค", selectedShops: "เลือก {{count}} ร้าน", startDate: "วันที่เริ่ม", endDate: "วันที่สิ้นสุด", comparison: "เปรียบเทียบ", previousPeriod: "ช่วงก่อนหน้า", previousYear: "ปีก่อน", granularity: "ความละเอียดเวลา", refresh: "รีเฟรช", platformTitle: "ผลงานแพลตฟอร์ม", sampleTitle: "การแปลงตัวอย่าง", nonAdditive: "GMV สองสัญญาอาจซ้ำกันและห้ามนำมาบวกกัน", explore: { title: "สำรวจ", contract: "สัญญา", chooseContract: "เลือกหนึ่งสัญญา", metrics: "เมตริก", groupBy: "จัดกลุ่มตาม", filters: "ตัวกรองมิติ", resultTable: "ตารางผลลัพธ์" } }, {
    welcomeTitle: "สองสัญญา หนึ่งมุมมองการดำเนินงาน", welcomeBody: "ผลงานแพลตฟอร์มและตัวอย่างแยกจากกันเพื่อไม่ให้นับ GMV ซ้ำ", scopeTitle: "เลือกขอบเขตธุรกิจ", scopeBody: "กรองร้านที่ได้รับอนุญาต ภูมิภาค วันที่ ช่วงเปรียบเทียบ และความละเอียดเวลา", contractsTitle: "อ่านสองสัญญาควบคู่กัน", contractsBody: "แต่ละส่วนมีตัวหาร แนวโน้ม และ GMV ของตนเอง และห้ามนำมารวมกัน", maturityTitle: "อ่านกลุ่มข้อมูลใหม่อย่างยุติธรรม", maturityBody: "แต่ละช่วงใช้เฉพาะคำเชิญที่มีอายุเพียงพอ ส่วนอายุใบสมัครคือภาพสถานะปัจจุบัน", healthTitle: "แสดงความครอบคลุมไว้เสมอ", healthBody: "ข้อมูลตัวตน เวลา การแมป และ watermark แสดงคู่กับเมตริกธุรกิจ", exploreTitle: "สร้างคำค้นที่ตรงตามสัญญา", exploreBody: "ระบบจะปิดชุด Aggregate ที่ไม่รองรับก่อนสั่งรัน", resultsTitle: "เจาะลึกโดยไม่เปลี่ยนความหมาย", resultsBody: "กราฟและตารางใช้ข้อมูลเดียวกัน และคำนวณอัตราจากตัวตั้งกับตัวหารรวม"
  }, "การวิเคราะห์"),
} as const;
