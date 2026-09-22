// Qualification counters belong to the execution, not exclusively to its current mode.
export const campaignScreeningCopy = {
  en: {
    aiFiltered: "AI model filtered out",
    otherFiltered: "Other conditions filtered out",
    unattributed: "Unattributed decisions",
    breakdownHint:
      "Rejection breakdown counts creators by their latest decision today (shop time), not cumulative evaluation attempts. Only explicit model rejections count as AI; duplicates, protected creators, pending decisions, technical errors and delivery failures do not.",
    unavailable:
      "AI rejection breakdown unavailable. No count has been inferred from the current mode.",
    evaluated: "Entered evaluation",
    passed: "Passed screening",
    filtered: "Filtered by screening",
    beforeScreening: "Excluded before screening",
    passRate: "Pass rate",
    aiMode: "Current mode · Smart screening",
    rulesMode: "Current mode · Marketplace rules",
    modeUnknown: "Qualification screening",
    aiHint:
      "Smart screening uses the pre-approval model to select creators before scheduling outreach. It is not a sales guarantee.",
    rulesHint:
      "Creators are screened before scheduling outreach; qualification and delivery outcomes are shown separately.",
    evaluatedHint:
      "Creators entering qualification, including those still awaiting a decision or technical retry.",
    rateHint:
      "Passed ÷ (passed + filtered). Pending decisions and technical errors are not counted as rejections.",
    filteredHint: "Did not meet the qualification criteria. These are not failed invitations.",
    scopeHint:
      "Mainline counts and pass rate use today's cumulative execution results across modes; AI attribution uses recorded decisions separately.",
  },
  zh: {
    aiFiltered: "AI 模型筛除",
    otherFiltered: "其他条件筛除",
    unattributed: "原因未归类",
    breakdownHint:
      "筛除明细按店铺今日每位达人的最新决策去重统计，不是累计评估次数。AI 只统计模型明确拒绝，不含去重、保护名单、待定、技术异常或发送失败。",
    unavailable: "AI 筛除明细暂不可用，未按当前模式推算人数。",
    evaluated: "进入评估",
    passed: "筛选通过",
    filtered: "筛选未通过",
    beforeScreening: "筛选前排除",
    passRate: "筛选通过率",
    aiMode: "当前模式 · 智能筛选",
    rulesMode: "当前模式 · 达人广场规则",
    modeUnknown: "资格筛选",
    aiHint: "智能模式使用预审模型，在安排触达前筛选达人；筛选结果不代表销量保证。",
    rulesHint: "达人通过资格筛选后才安排触达；筛选结果与投递结果分开统计。",
    evaluatedHint: "进入资格评估的达人，包括尚待决策或技术重试的达人。",
    rateHint: "通过人数 ÷（通过人数 + 筛除人数）。待定和技术异常不算筛除。",
    filteredHint: "未达到资格筛选条件，不是定邀发送失败。",
    scopeHint:
      "主干人数和通过率为今日跨模式累计结果；AI 筛除单独按实际决策归因，不按当前模式推算。",
  },
  de: {
    aiFiltered: "Vom KI-Modell ausgeschlossen",
    otherFiltered: "Durch andere Kriterien ausgeschlossen",
    unattributed: "Nicht zugeordnete Entscheidungen",
    breakdownHint:
      "Die Aufschlüsselung zählt Creator nach ihrer letzten heutigen Entscheidung (Shop-Zeit), nicht kumulierte Prüfungen. Nur ausdrückliche Modellablehnungen zählen zur KI, keine Duplikate, geschützten Creator, ausstehenden Entscheidungen, technischen Fehler oder Zustellfehler.",
    unavailable: "KI-Aufschlüsselung nicht verfügbar. Keine Schätzung anhand des aktuellen Modus.",
    evaluated: "Zur Prüfung eingegangen",
    passed: "Prüfung bestanden",
    filtered: "Bei Prüfung ausgeschlossen",
    beforeScreening: "Vor Prüfung ausgeschlossen",
    passRate: "Bestehensquote",
    aiMode: "Aktueller Modus · Intelligente Prüfung",
    rulesMode: "Aktueller Modus · Marketplace-Regeln",
    modeUnknown: "Eignungsprüfung",
    aiHint:
      "Die intelligente Prüfung wählt Creator vor der Kontaktplanung mit dem Vorprüfungsmodell aus. Sie garantiert keine Verkäufe.",
    rulesHint:
      "Die Eignung wird vor der Kontaktplanung geprüft. Prüfungs- und Zustellergebnisse werden getrennt ausgewiesen.",
    evaluatedHint:
      "Creator in der Eignungsprüfung, einschließlich ausstehender Entscheidungen und technischer Wiederholungen.",
    rateHint:
      "Bestanden ÷ (bestanden + ausgeschlossen). Ausstehende Entscheidungen und technische Fehler zählen nicht als Ausschluss.",
    filteredHint: "Eignungskriterien nicht erfüllt. Dies sind keine fehlgeschlagenen Einladungen.",
    scopeHint:
      "Hauptzahlen und Bestehensquote sind heutige kumulierte Ergebnisse aller Modi; die KI-Zuordnung basiert separat auf gespeicherten Entscheidungen.",
  },
  es: {
    aiFiltered: "Excluidos por el modelo de IA",
    otherFiltered: "Excluidos por otros criterios",
    unattributed: "Decisiones sin clasificar",
    breakdownHint:
      "El desglose cuenta creadores según su última decisión de hoy (hora de la tienda), no evaluaciones acumuladas. Solo los rechazos explícitos del modelo cuentan como IA; no duplicados, protegidos, pendientes, errores técnicos ni fallos de envío.",
    unavailable: "Desglose de IA no disponible. No se ha estimado según el modo actual.",
    evaluated: "Entraron en evaluación",
    passed: "Superaron el filtro",
    filtered: "Excluidos por el filtro",
    beforeScreening: "Excluidos antes del filtro",
    passRate: "Tasa de aprobación",
    aiMode: "Modo actual · Filtro inteligente",
    rulesMode: "Modo actual · Reglas de Marketplace",
    modeUnknown: "Evaluación de elegibilidad",
    aiHint:
      "El filtro inteligente usa el modelo de preaprobación para seleccionar creadores antes de programar el contacto. No garantiza ventas.",
    rulesHint:
      "La elegibilidad se evalúa antes de programar el contacto; los resultados de evaluación y entrega se muestran por separado.",
    evaluatedHint:
      "Creadores que entraron en evaluación, incluidos los pendientes de decisión o reintento técnico.",
    rateHint:
      "Aprobados ÷ (aprobados + excluidos). Las decisiones pendientes y los errores técnicos no cuentan como exclusiones.",
    filteredHint: "No cumplieron los criterios de elegibilidad. No son invitaciones fallidas.",
    scopeHint:
      "Los conteos principales y la tasa son acumulados de hoy entre modos; la atribución a IA usa decisiones registradas por separado.",
  },
  fr: {
    aiFiltered: "Écartés par le modèle IA",
    otherFiltered: "Écartés par d’autres critères",
    unattributed: "Décisions non attribuées",
    breakdownHint:
      "Le détail compte les créateurs selon leur dernière décision du jour (heure de la boutique), pas les évaluations cumulées. Seuls les refus explicites du modèle comptent pour l’IA, sans doublons, créateurs protégés, décisions en attente, erreurs techniques ou échecs d’envoi.",
    unavailable: "Détail IA indisponible. Aucun nombre déduit du mode actuel.",
    evaluated: "Entrés en évaluation",
    passed: "Sélection réussie",
    filtered: "Écartés par la sélection",
    beforeScreening: "Écartés avant sélection",
    passRate: "Taux de sélection",
    aiMode: "Mode actuel · Sélection intelligente",
    rulesMode: "Mode actuel · Règles Marketplace",
    modeUnknown: "Évaluation d’éligibilité",
    aiHint:
      "La sélection intelligente utilise le modèle de préapprobation avant de planifier le contact. Elle ne garantit pas les ventes.",
    rulesHint:
      "L’éligibilité est vérifiée avant la planification ; les résultats de sélection et d’envoi sont séparés.",
    evaluatedHint:
      "Créateurs entrés en évaluation, y compris les décisions en attente et les nouvelles tentatives techniques.",
    rateHint:
      "Retenus ÷ (retenus + écartés). Les décisions en attente et erreurs techniques ne sont pas des exclusions.",
    filteredHint: "Critères d’éligibilité non remplis. Il ne s’agit pas d’invitations échouées.",
    scopeHint:
      "Les chiffres principaux et le taux cumulent les résultats du jour entre modes ; l’attribution IA repose séparément sur les décisions enregistrées.",
  },
  id: {
    aiFiltered: "Disaring keluar oleh model AI",
    otherFiltered: "Disaring keluar oleh kriteria lain",
    unattributed: "Keputusan belum diklasifikasi",
    breakdownHint:
      "Rincian menghitung kreator berdasarkan keputusan terakhir hari ini (waktu toko), bukan total percobaan evaluasi. Hanya penolakan eksplisit model dihitung sebagai AI; bukan duplikat, daftar terlindungi, keputusan tertunda, kesalahan teknis, atau kegagalan kirim.",
    unavailable: "Rincian AI belum tersedia. Jumlah tidak diperkirakan dari mode saat ini.",
    evaluated: "Masuk evaluasi",
    passed: "Lolos penyaringan",
    filtered: "Tidak lolos penyaringan",
    beforeScreening: "Dikecualikan sebelum penyaringan",
    passRate: "Tingkat kelulusan",
    aiMode: "Mode saat ini · Penyaringan cerdas",
    rulesMode: "Mode saat ini · Aturan Marketplace",
    modeUnknown: "Penyaringan kelayakan",
    aiHint:
      "Penyaringan cerdas menggunakan model prapersetujuan sebelum menjadwalkan kontak. Hasilnya bukan jaminan penjualan.",
    rulesHint:
      "Kelayakan diperiksa sebelum penjadwalan kontak; hasil penyaringan dan pengiriman ditampilkan terpisah.",
    evaluatedHint:
      "Kreator yang masuk evaluasi, termasuk yang menunggu keputusan atau percobaan ulang teknis.",
    rateHint:
      "Lolos ÷ (lolos + tidak lolos). Keputusan tertunda dan kesalahan teknis tidak dihitung sebagai penolakan.",
    filteredHint: "Tidak memenuhi kriteria kelayakan. Ini bukan undangan yang gagal dikirim.",
    scopeHint:
      "Jumlah utama dan tingkat kelulusan memakai total hasil hari ini lintas mode; atribusi AI memakai keputusan tercatat secara terpisah.",
  },
  it: {
    aiFiltered: "Esclusi dal modello IA",
    otherFiltered: "Esclusi da altri criteri",
    unattributed: "Decisioni non attribuite",
    breakdownHint:
      "Il dettaglio conta i creator in base all’ultima decisione odierna (ora del negozio), non le valutazioni cumulative. Solo i rifiuti espliciti del modello contano come IA, non duplicati, creator protetti, decisioni in attesa, errori tecnici o invii falliti.",
    unavailable: "Dettaglio IA non disponibile. Nessun conteggio dedotto dalla modalità attuale.",
    evaluated: "Entrati in valutazione",
    passed: "Selezione superata",
    filtered: "Esclusi dalla selezione",
    beforeScreening: "Esclusi prima della selezione",
    passRate: "Tasso di approvazione",
    aiMode: "Modalità attuale · Selezione intelligente",
    rulesMode: "Modalità attuale · Regole Marketplace",
    modeUnknown: "Valutazione di idoneità",
    aiHint:
      "La selezione intelligente usa il modello di preapprovazione prima di pianificare il contatto. Non garantisce vendite.",
    rulesHint:
      "L’idoneità viene verificata prima di pianificare il contatto; selezione e invio hanno risultati separati.",
    evaluatedHint:
      "Creator entrati in valutazione, inclusi quelli in attesa di decisione o di un nuovo tentativo tecnico.",
    rateHint:
      "Approvati ÷ (approvati + esclusi). Decisioni in attesa ed errori tecnici non contano come esclusioni.",
    filteredHint: "Criteri di idoneità non soddisfatti. Non sono inviti falliti.",
    scopeHint:
      "I conteggi principali e il tasso cumulano i risultati odierni tra modalità; l’attribuzione IA usa separatamente le decisioni registrate.",
  },
  th: {
    aiFiltered: "คัดออกโดยโมเดล AI",
    otherFiltered: "คัดออกด้วยเงื่อนไขอื่น",
    unattributed: "ยังไม่ระบุสาเหตุ",
    breakdownHint:
      "รายละเอียดนับครีเอเตอร์ตามผลตัดสินล่าสุดของวันนี้ตามเวลาร้าน ไม่ใช่จำนวนครั้งประเมินสะสม AI นับเฉพาะการปฏิเสธจากโมเดล ไม่รวมรายการซ้ำ รายชื่อคุ้มครอง รายการรอผล ข้อผิดพลาดทางเทคนิค หรือการส่งล้มเหลว",
    unavailable: "ยังไม่มีรายละเอียดการคัดออกโดย AI ไม่มีการประมาณจำนวนจากโหมดปัจจุบัน",
    evaluated: "เข้าสู่การประเมิน",
    passed: "ผ่านการคัดกรอง",
    filtered: "ไม่ผ่านการคัดกรอง",
    beforeScreening: "ถูกยกเว้นก่อนคัดกรอง",
    passRate: "อัตราผ่านการคัดกรอง",
    aiMode: "โหมดปัจจุบัน · คัดกรองอัจฉริยะ",
    rulesMode: "โหมดปัจจุบัน · กฎ Marketplace",
    modeUnknown: "การประเมินคุณสมบัติ",
    aiHint: "โหมดอัจฉริยะใช้โมเดลประเมินเบื้องต้นเพื่อคัดเลือกครีเอเตอร์ก่อนกำหนดเวลาติดต่อ ไม่ใช่การรับประกันยอดขาย",
    rulesHint: "ตรวจสอบคุณสมบัติก่อนกำหนดเวลาติดต่อ โดยแยกผลการคัดกรองออกจากผลการส่ง",
    evaluatedHint: "ครีเอเตอร์ที่เข้าสู่การประเมิน รวมถึงผู้ที่รอผลหรือรอลองใหม่จากปัญหาทางเทคนิค",
    rateHint: "ผ่าน ÷ (ผ่าน + ไม่ผ่าน) ไม่นับรายการรอผลหรือข้อผิดพลาดทางเทคนิคเป็นการคัดออก",
    filteredHint: "ไม่ผ่านเกณฑ์คุณสมบัติ ไม่ใช่การส่งคำเชิญล้มเหลว",
    scopeHint: "จำนวนหลักและอัตราผ่านใช้ผลสะสมวันนี้จากทุกโหมด ส่วนการคัดออกโดย AI ใช้ผลตัดสินที่บันทึกไว้แยกต่างหาก",
  },
};
