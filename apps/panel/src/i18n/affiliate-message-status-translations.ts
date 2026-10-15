export const AFFILIATE_MESSAGE_STATUS_COPY = {
  en: {
    messageStatusPending: "Pending",
    messageStatusResolved: "Handled",
    messageStatusUnactionable: "Unactionable",
    colMessageTime: "Message time",
    messageTimeSortLabel: "Message time order",
    messageSortOldestFirst: "Oldest message first",
    messageStatusCountsHint:
      "Channel counts follow the status, shop, BD and protection filters, but ignore channel and time filters.",
    noMessagesForStatus: "No conversations match this status.",
    allMatchingMessagesLoaded: "All {{count}} matching conversations loaded",
    allMatchingMessagesLoadedChannel: "All {{count}} matching {{channel}} conversations loaded",
  },
  zh: {
    messageStatusPending: "待处理",
    messageStatusResolved: "已处理",
    messageStatusUnactionable: "不可处理",
    colMessageTime: "消息时间",
    messageTimeSortLabel: "消息时间排序",
    messageSortOldestFirst: "最早消息优先",
    messageStatusCountsHint: "渠道计数按当前状态和店铺、BD、保护条件统计，不受渠道或时间筛选影响。",
    noMessagesForStatus: "当前状态下没有消息会话。",
    allMatchingMessagesLoaded: "已加载全部 {{count}} 条匹配会话",
    allMatchingMessagesLoadedChannel: "已加载全部 {{count}} 条 {{channel}} 匹配会话",
  },
  de: {
    messageStatusPending: "Ausstehend",
    messageStatusResolved: "Bearbeitet",
    messageStatusUnactionable: "Nicht bearbeitbar",
    colMessageTime: "Nachrichtenzeit",
    messageTimeSortLabel: "Nachrichtenzeit",
    messageSortOldestFirst: "Älteste Nachricht zuerst",
    messageStatusCountsHint:
      "Kanalzahlen berücksichtigen Status, Shop, BD und Schutz, aber keine Kanal- oder Zeitfilter.",
    noMessagesForStatus: "Keine Unterhaltungen mit diesem Status.",
    allMatchingMessagesLoaded: "Alle {{count}} passenden Unterhaltungen geladen",
    allMatchingMessagesLoadedChannel: "Alle {{count}} passenden {{channel}}-Unterhaltungen geladen",
  },
  es: {
    messageStatusPending: "Pendiente",
    messageStatusResolved: "Gestionada",
    messageStatusUnactionable: "No procesable",
    colMessageTime: "Fecha del mensaje",
    messageTimeSortLabel: "Orden de mensajes",
    messageSortOldestFirst: "Mensaje más antiguo primero",
    messageStatusCountsHint:
      "Los recuentos siguen el estado, la tienda, el BD y la protección, pero no el canal ni el intervalo de fechas.",
    noMessagesForStatus: "No hay conversaciones con este estado.",
    allMatchingMessagesLoaded: "Se cargaron las {{count}} conversaciones coincidentes",
    allMatchingMessagesLoadedChannel:
      "Se cargaron las {{count}} conversaciones coincidentes de {{channel}}",
  },
  fr: {
    messageStatusPending: "À traiter",
    messageStatusResolved: "Traité",
    messageStatusUnactionable: "Impossible à traiter",
    colMessageTime: "Date du message",
    messageTimeSortLabel: "Ordre des messages",
    messageSortOldestFirst: "Message le plus ancien en premier",
    messageStatusCountsHint:
      "Les compteurs suivent le statut, la boutique, le BD et la protection, mais pas le canal ni la période.",
    noMessagesForStatus: "Aucune conversation pour ce statut.",
    allMatchingMessagesLoaded: "Les {{count}} conversations correspondantes sont chargées",
    allMatchingMessagesLoadedChannel:
      "Les {{count}} conversations {{channel}} correspondantes sont chargées",
  },
  id: {
    messageStatusPending: "Tertunda",
    messageStatusResolved: "Ditangani",
    messageStatusUnactionable: "Tidak dapat ditangani",
    colMessageTime: "Waktu pesan",
    messageTimeSortLabel: "Urutan pesan",
    messageSortOldestFirst: "Pesan terlama dahulu",
    messageStatusCountsHint:
      "Jumlah kanal mengikuti status, toko, BD, dan perlindungan, tetapi tidak mengikuti filter kanal atau waktu.",
    noMessagesForStatus: "Tidak ada percakapan dengan status ini.",
    allMatchingMessagesLoaded: "Semua {{count}} percakapan yang cocok telah dimuat",
    allMatchingMessagesLoadedChannel:
      "Semua {{count}} percakapan {{channel}} yang cocok telah dimuat",
  },
  it: {
    messageStatusPending: "Da gestire",
    messageStatusResolved: "Gestita",
    messageStatusUnactionable: "Non gestibile",
    colMessageTime: "Data del messaggio",
    messageTimeSortLabel: "Ordine messaggi",
    messageSortOldestFirst: "Messaggio meno recente prima",
    messageStatusCountsHint:
      "I conteggi seguono stato, negozio, BD e protezione, ma non i filtri di canale o periodo.",
    noMessagesForStatus: "Nessuna conversazione con questo stato.",
    allMatchingMessagesLoaded: "Caricate tutte le {{count}} conversazioni corrispondenti",
    allMatchingMessagesLoadedChannel:
      "Caricate tutte le {{count}} conversazioni {{channel}} corrispondenti",
  },
  th: {
    messageStatusPending: "รอดำเนินการ",
    messageStatusResolved: "ดำเนินการแล้ว",
    messageStatusUnactionable: "ไม่สามารถดำเนินการได้",
    colMessageTime: "เวลาข้อความ",
    messageTimeSortLabel: "เรียงตามเวลาข้อความ",
    messageSortOldestFirst: "ข้อความเก่าสุดก่อน",
    messageStatusCountsHint:
      "จำนวนตามช่องทางใช้ตัวกรองสถานะ ร้านค้า BD และการปกป้อง แต่ไม่ใช้ตัวกรองช่องทางหรือเวลา",
    noMessagesForStatus: "ไม่มีการสนทนาที่ตรงกับสถานะนี้",
    allMatchingMessagesLoaded: "โหลดการสนทนาที่ตรงกันครบ {{count}} รายการแล้ว",
    allMatchingMessagesLoadedChannel: "โหลดการสนทนา {{channel}} ที่ตรงกันครบ {{count}} รายการแล้ว",
  },
} as const;
