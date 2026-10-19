export const AFFILIATE_BD_INTAKE_COPY = {
  en: {
    intakeAdvanced: "New Creator intake · Advanced (optional)",
    intakeLimitsEnabled: "Limit automatic intake",
    weeklyCreatorLimit: "Weekly limit",
    monthlyCreatorLimit: "Monthly limit",
    creatorIntakeLimitsHint:
      "Off means unlimited. Automatic assignments are shared fairly across eligible BDs. Limits are per BD across all regions; either limit pauses intake. Resets Monday 00:00 and the first of each month at 00:00 (UTC+8). Manual claims/assignments are exempt; releases do not refund intake.",
    creatorIntakeLimitInvalid: "Enter positive whole-number limits.",
  },
  zh: {
    intakeAdvanced: "接收新达人 · 高级选项（可选）",
    intakeLimitsEnabled: "限制自动接收数量",
    weeklyCreatorLimit: "每周上限",
    monthlyCreatorLimit: "每月上限",
    creatorIntakeLimitsHint:
      "不启用则不限量。新达人在可接单的 BD 中均衡分配，额度按每个 BD 跨站点累计，任一上限达到即暂停自动接收。每周一及每月 1 日的 00:00（UTC+8）刷新。人工认领、管理员分配不计入额度，释放不返还额度。",
    creatorIntakeLimitInvalid: "请输入大于 0 的整数上限。",
  },
  de: {
    intakeAdvanced: "Neue Creator · Erweitert (optional)",
    intakeLimitsEnabled: "Automatische Aufnahme begrenzen",
    weeklyCreatorLimit: "Wochenlimit",
    monthlyCreatorLimit: "Monatslimit",
    creatorIntakeLimitsHint:
      "Ohne Aktivierung unbegrenzt. Automatische Zuweisungen werden gleichmäßig auf verfügbare BDs verteilt. Limits gelten je BD über alle Regionen; jedes erreichte Limit pausiert die Aufnahme. Zurücksetzung montags und am Monatsersten um 00:00 (UTC+8). Manuelle Übernahmen/Zuweisungen sind ausgenommen; Freigaben erstatten kein Kontingent.",
    creatorIntakeLimitInvalid: "Positive ganze Zahlen eingeben.",
  },
  es: {
    intakeAdvanced: "Nuevos creadores · Avanzado (opcional)",
    intakeLimitsEnabled: "Limitar asignaciones automáticas",
    weeklyCreatorLimit: "Límite semanal",
    monthlyCreatorLimit: "Límite mensual",
    creatorIntakeLimitsHint:
      "Desactivado significa sin límite. Las asignaciones se reparten equitativamente entre BD disponibles. Los límites son por BD en todas las regiones; alcanzar cualquiera pausa la recepción. Se reinician los lunes y el primer día del mes a las 00:00 (UTC+8). Las asignaciones manuales están exentas; liberar no devuelve cuota.",
    creatorIntakeLimitInvalid: "Introduce límites enteros positivos.",
  },
  fr: {
    intakeAdvanced: "Nouveaux créateurs · Avancé (facultatif)",
    intakeLimitsEnabled: "Limiter les attributions automatiques",
    weeklyCreatorLimit: "Limite hebdomadaire",
    monthlyCreatorLimit: "Limite mensuelle",
    creatorIntakeLimitsHint:
      "Désactivé signifie illimité. Les attributions sont réparties équitablement entre BD disponibles. Les limites s’appliquent par BD toutes régions confondues ; atteindre l’une suspend l’accueil. Réinitialisation le lundi et le premier du mois à 00:00 (UTC+8). Les attributions manuelles sont exclues ; libérer ne restitue pas de quota.",
    creatorIntakeLimitInvalid: "Saisissez des limites entières positives.",
  },
  id: {
    intakeAdvanced: "Kreator baru · Lanjutan (opsional)",
    intakeLimitsEnabled: "Batasi penugasan otomatis",
    weeklyCreatorLimit: "Batas mingguan",
    monthlyCreatorLimit: "Batas bulanan",
    creatorIntakeLimitsHint:
      "Nonaktif berarti tanpa batas. Penugasan dibagi merata di antara BD yang tersedia. Batas berlaku per BD untuk semua wilayah; mencapai salah satu batas menghentikan penerimaan. Direset Senin dan tanggal 1 pukul 00.00 (UTC+8). Penugasan manual dikecualikan; pelepasan tidak mengembalikan kuota.",
    creatorIntakeLimitInvalid: "Masukkan batas berupa bilangan bulat positif.",
  },
  it: {
    intakeAdvanced: "Nuovi creator · Avanzate (facoltativo)",
    intakeLimitsEnabled: "Limita assegnazioni automatiche",
    weeklyCreatorLimit: "Limite settimanale",
    monthlyCreatorLimit: "Limite mensile",
    creatorIntakeLimitsHint:
      "Disattivato significa illimitato. Le assegnazioni sono distribuite equamente tra BD disponibili. I limiti valgono per BD in tutte le regioni; raggiungerne uno sospende la ricezione. Azzeramento lunedì e il primo del mese alle 00:00 (UTC+8). Le assegnazioni manuali sono escluse; liberare non restituisce quota.",
    creatorIntakeLimitInvalid: "Inserisci limiti interi positivi.",
  },
  th: {
    intakeAdvanced: "รับครีเอเตอร์ใหม่ · ขั้นสูง (ไม่บังคับ)",
    intakeLimitsEnabled: "จำกัดการมอบหมายอัตโนมัติ",
    weeklyCreatorLimit: "ขีดจำกัดรายสัปดาห์",
    monthlyCreatorLimit: "ขีดจำกัดรายเดือน",
    creatorIntakeLimitsHint:
      "ไม่เปิดใช้หมายถึงไม่จำกัด ระบบแบ่งครีเอเตอร์อย่างสมดุลให้ BD ที่พร้อมรับ โควตานับต่อ BD รวมทุกภูมิภาค เมื่อถึงขีดจำกัดใดจะหยุดรับ รีเซ็ตวันจันทร์และวันที่ 1 เวลา 00:00 (UTC+8) การรับหรือมอบหมายด้วยตนเองไม่นับ และการคืนไม่คืนโควตา",
    creatorIntakeLimitInvalid: "กรุณาระบุขีดจำกัดเป็นจำนวนเต็มบวก",
  },
} as const;
