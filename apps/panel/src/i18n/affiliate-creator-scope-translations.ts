const en = {
  view: "View",
  globalView: "Global view",
  globalInformation: "Global information",
  globalHint:
    "Contacts, tags, owner and protection apply to all shops. Changes affect the whole relationship.",
  profileHint: "Creator profile information is shared across shops.",
  sharedMessagesHint:
    "Only messages assigned to this shop are shown. Switch to Global view for unassigned or cross-shop conversations.",
  noLoadedMessages:
    "No messages for this shop in the loaded history. Load earlier messages to continue.",
  selectedShop: "Selected shop",
  noRecentActivity: "No recent business activity",
  shopCounts:
    "{{agenda}} tasks · {{samples}} samples · {{collaborations}} collaborations · {{proposals}} pending proposals",
  changeView: "Switch view",
  discardDraftHint:
    "Switching views will discard this unsent draft and its attachments, and reset the reply target and sending shop. Continue?",
  discardAndSwitch: "Discard draft and switch",
  crossShopProposal: "Cross-shop proposal",
  crossShopProposalHint:
    "This proposal also affects other shops. Review the full proposal in Global view before making a decision.",
  backToGlobal: "Go to Global view",
};
const resource = (creatorScope: Record<keyof typeof en, string>) => ({
  ecommerce: { affiliateWorkspace: { creatorScope } },
});
export const AFFILIATE_CREATOR_SCOPE_TRANSLATIONS = {
  en: resource(en),
  zh: resource({
    view: "查看范围",
    globalView: "全局视角",
    globalInformation: "全局信息",
    globalHint: "联系方式、标签、负责人和保护状态适用于全部店铺，修改会影响整个达人关系。",
    profileHint: "达人资料为全局信息，不随店铺视角切换。",
    sharedMessagesHint: "仅显示明确归属当前店铺的消息。未归属店铺或跨店沟通，请切换全局视角查看。",
    noLoadedMessages: "已加载记录中暂无该店铺消息，可继续加载更早的记录。",
    selectedShop: "当前店铺",
    noRecentActivity: "暂无最近业务活动",
    shopCounts:
      "{{agenda}} 项待办 · {{samples}} 条申样 · {{collaborations}} 项合作 · {{proposals}} 项待审批提案",
    changeView: "切换视角",
    discardDraftHint: "切换视角将丢弃尚未发送的草稿及附件，并重置回复目标和发送店铺。是否继续？",
    discardAndSwitch: "丢弃草稿并切换",
    crossShopProposal: "跨店铺提案",
    crossShopProposalHint: "这份提案还涉及其他店铺，请切换全局视角查看完整内容后再处理。",
    backToGlobal: "切换全局视角",
  }),
  de: resource({
    view: "Ansicht",
    globalView: "Globale Ansicht",
    globalInformation: "Globale Informationen",
    globalHint:
      "Kontakte, Tags, Zuständigkeit und Schutz gelten für alle Shops. Änderungen betreffen die gesamte Beziehung.",
    profileHint: "Das Creator-Profil gilt shopübergreifend.",
    sharedMessagesHint:
      "Nur Nachrichten dieses Shops werden angezeigt. Nicht zugeordnete oder shopübergreifende Gespräche finden Sie in der globalen Ansicht.",
    noLoadedMessages:
      "Keine Nachrichten dieses Shops im geladenen Verlauf. Laden Sie ältere Nachrichten.",
    selectedShop: "Ausgewählter Shop",
    noRecentActivity: "Keine aktuelle Geschäftsaktivität",
    shopCounts:
      "{{agenda}} Aufgaben · {{samples}} Muster · {{collaborations}} Kooperationen · {{proposals}} offene Vorschläge",
    changeView: "Ansicht wechseln",
    discardDraftHint:
      "Beim Wechsel werden der ungesendete Entwurf und Anhänge verworfen. Antwortziel und sendender Shop werden zurückgesetzt. Fortfahren?",
    discardAndSwitch: "Verwerfen und wechseln",
    crossShopProposal: "Shopübergreifender Vorschlag",
    crossShopProposalHint:
      "Dieser Vorschlag betrifft weitere Shops. Prüfen Sie ihn vor einer Entscheidung vollständig in der globalen Ansicht.",
    backToGlobal: "Zur globalen Ansicht",
  }),
  es: resource({
    view: "Vista",
    globalView: "Vista global",
    globalInformation: "Información global",
    globalHint:
      "Los contactos, etiquetas, responsable y protección se aplican a todas las tiendas. Los cambios afectan a toda la relación.",
    profileHint: "El perfil del creador es común a todas las tiendas.",
    sharedMessagesHint:
      "Solo se muestran mensajes de esta tienda. Consulte las conversaciones sin tienda o compartidas en la vista global.",
    noLoadedMessages:
      "No hay mensajes de esta tienda en el historial cargado. Cargue mensajes anteriores.",
    selectedShop: "Tienda seleccionada",
    noRecentActivity: "Sin actividad comercial reciente",
    shopCounts:
      "{{agenda}} tareas · {{samples}} muestras · {{collaborations}} colaboraciones · {{proposals}} propuestas pendientes",
    changeView: "Cambiar vista",
    discardDraftHint:
      "Se descartarán el borrador sin enviar y sus archivos, y se restablecerán el destino de respuesta y la tienda remitente. ¿Continuar?",
    discardAndSwitch: "Descartar y cambiar",
    crossShopProposal: "Propuesta para varias tiendas",
    crossShopProposalHint:
      "Esta propuesta también afecta a otras tiendas. Revísela completa en la vista global antes de decidir.",
    backToGlobal: "Ir a la vista global",
  }),
  fr: resource({
    view: "Vue",
    globalView: "Vue globale",
    globalInformation: "Informations globales",
    globalHint:
      "Contacts, étiquettes, responsable et protection s’appliquent à toutes les boutiques. Les modifications affectent toute la relation.",
    profileHint: "Le profil du créateur est commun à toutes les boutiques.",
    sharedMessagesHint:
      "Seuls les messages de cette boutique sont affichés. Les échanges non attribués ou partagés sont disponibles dans la vue globale.",
    noLoadedMessages:
      "Aucun message de cette boutique dans l’historique chargé. Chargez les messages précédents.",
    selectedShop: "Boutique sélectionnée",
    noRecentActivity: "Aucune activité commerciale récente",
    shopCounts:
      "{{agenda}} tâches · {{samples}} échantillons · {{collaborations}} collaborations · {{proposals}} propositions en attente",
    changeView: "Changer de vue",
    discardDraftHint:
      "Le brouillon non envoyé et ses pièces jointes seront supprimés. La cible de réponse et la boutique d’envoi seront réinitialisées. Continuer ?",
    discardAndSwitch: "Abandonner et changer",
    crossShopProposal: "Proposition multiboutique",
    crossShopProposalHint:
      "Cette proposition concerne aussi d’autres boutiques. Consultez-la intégralement dans la vue globale avant de décider.",
    backToGlobal: "Passer à la vue globale",
  }),
  id: resource({
    view: "Tampilan",
    globalView: "Tampilan global",
    globalInformation: "Informasi global",
    globalHint:
      "Kontak, tag, penanggung jawab, dan perlindungan berlaku untuk semua toko. Perubahan memengaruhi seluruh hubungan.",
    profileHint: "Profil kreator berlaku di semua toko.",
    sharedMessagesHint:
      "Hanya pesan milik toko ini yang ditampilkan. Percakapan tanpa toko atau lintas toko tersedia di tampilan global.",
    noLoadedMessages: "Belum ada pesan toko ini dalam riwayat yang dimuat. Muat pesan sebelumnya.",
    selectedShop: "Toko terpilih",
    noRecentActivity: "Belum ada aktivitas bisnis terbaru",
    shopCounts:
      "{{agenda}} tugas · {{samples}} sampel · {{collaborations}} kolaborasi · {{proposals}} proposal tertunda",
    changeView: "Ganti tampilan",
    discardDraftHint:
      "Draf yang belum dikirim dan lampirannya akan dibuang. Tujuan balasan dan toko pengirim akan direset. Lanjutkan?",
    discardAndSwitch: "Buang dan ganti",
    crossShopProposal: "Proposal lintas toko",
    crossShopProposalHint:
      "Proposal ini juga memengaruhi toko lain. Tinjau proposal lengkap dalam tampilan global sebelum mengambil keputusan.",
    backToGlobal: "Buka tampilan global",
  }),
  it: resource({
    view: "Vista",
    globalView: "Vista globale",
    globalInformation: "Informazioni globali",
    globalHint:
      "Contatti, tag, responsabile e protezione valgono per tutti i negozi. Le modifiche riguardano l’intera relazione.",
    profileHint: "Il profilo del creator è condiviso tra tutti i negozi.",
    sharedMessagesHint:
      "Sono mostrati solo i messaggi di questo negozio. Le conversazioni non assegnate o condivise sono disponibili nella vista globale.",
    noLoadedMessages:
      "Nessun messaggio di questo negozio nella cronologia caricata. Carica i messaggi precedenti.",
    selectedShop: "Negozio selezionato",
    noRecentActivity: "Nessuna attività commerciale recente",
    shopCounts:
      "{{agenda}} attività · {{samples}} campioni · {{collaborations}} collaborazioni · {{proposals}} proposte in attesa",
    changeView: "Cambia vista",
    discardDraftHint:
      "La bozza non inviata e gli allegati saranno eliminati. La destinazione della risposta e il negozio mittente saranno reimpostati. Continuare?",
    discardAndSwitch: "Scarta e cambia",
    crossShopProposal: "Proposta multinegozio",
    crossShopProposalHint:
      "Questa proposta riguarda anche altri negozi. Esaminala per intero nella vista globale prima di decidere.",
    backToGlobal: "Vai alla vista globale",
  }),
  th: resource({
    view: "มุมมอง",
    globalView: "มุมมองรวม",
    globalInformation: "ข้อมูลส่วนกลาง",
    globalHint: "ข้อมูลติดต่อ แท็ก ผู้รับผิดชอบ และการป้องกันใช้กับทุกร้าน การเปลี่ยนแปลงมีผลต่อความสัมพันธ์ทั้งหมด",
    profileHint: "โปรไฟล์ครีเอเตอร์เป็นข้อมูลร่วมกันของทุกร้าน",
    sharedMessagesHint: "แสดงเฉพาะข้อความของร้านนี้ ดูข้อความที่ไม่ระบุร้านหรือการสนทนาข้ามร้านได้ในมุมมองรวม",
    noLoadedMessages: "ยังไม่มีข้อความของร้านนี้ในประวัติที่โหลด โปรดโหลดข้อความก่อนหน้า",
    selectedShop: "ร้านที่เลือก",
    noRecentActivity: "ยังไม่มีกิจกรรมธุรกิจล่าสุด",
    shopCounts:
      "{{agenda}} งาน · {{samples}} ตัวอย่าง · {{collaborations}} ความร่วมมือ · {{proposals}} ข้อเสนอรออนุมัติ",
    changeView: "เปลี่ยนมุมมอง",
    discardDraftHint:
      "การเปลี่ยนมุมมองจะทิ้งฉบับร่างและไฟล์แนบที่ยังไม่ได้ส่ง และรีเซ็ตเป้าหมายการตอบกลับกับร้านผู้ส่ง ต้องการดำเนินการต่อหรือไม่?",
    discardAndSwitch: "ทิ้งร่างและเปลี่ยน",
    crossShopProposal: "ข้อเสนอข้ามร้าน",
    crossShopProposalHint: "ข้อเสนอนี้มีผลต่อร้านอื่นด้วย โปรดตรวจสอบเนื้อหาทั้งหมดในมุมมองรวมก่อนตัดสินใจ",
    backToGlobal: "ไปที่มุมมองรวม",
  }),
};
