/** Customer-service conversation category tabs (all supported locales). */
export const CUSTOMER_SERVICE_CONVERSATION_TAB_TRANSLATIONS = {
  en: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "All",
        conversationTabEscalated: "Escalations to handle",
        conversationTabPending: "Awaiting reply",
        conversationTabResolved: "Replied",
        conversationCountsLoadFailed: "Could not load the tab counts. They will retry on the next refresh.",
      },
    },
  },
  zh: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "全部消息",
        conversationTabEscalated: "客服升级待处理",
        conversationTabPending: "待回复",
        conversationTabResolved: "已回复",
        conversationCountsLoadFailed: "分类数量加载失败，下次刷新时会重试。",
      },
    },
  },
  de: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "Alle Nachrichten",
        conversationTabEscalated: "Eskalationen zu bearbeiten",
        conversationTabPending: "Antwort ausstehend",
        conversationTabResolved: "Beantwortet",
        conversationCountsLoadFailed: "Die Anzahl pro Kategorie konnte nicht geladen werden. Beim nächsten Aktualisieren wird es erneut versucht.",
      },
    },
  },
  es: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "Todos los mensajes",
        conversationTabEscalated: "Escaladas por atender",
        conversationTabPending: "Pendientes de respuesta",
        conversationTabResolved: "Respondidos",
        conversationCountsLoadFailed: "No se pudieron cargar los recuentos por categoría. Se reintentará en la próxima actualización.",
      },
    },
  },
  fr: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "Tous les messages",
        conversationTabEscalated: "Escalades à traiter",
        conversationTabPending: "En attente de réponse",
        conversationTabResolved: "Répondus",
        conversationCountsLoadFailed: "Impossible de charger le nombre par catégorie. Nouvel essai à la prochaine actualisation.",
      },
    },
  },
  id: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "Semua pesan",
        conversationTabEscalated: "Eskalasi perlu ditangani",
        conversationTabPending: "Menunggu balasan",
        conversationTabResolved: "Sudah dibalas",
        conversationCountsLoadFailed: "Gagal memuat jumlah per kategori. Akan dicoba lagi saat penyegaran berikutnya.",
      },
    },
  },
  it: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "Tutti i messaggi",
        conversationTabEscalated: "Escalation da gestire",
        conversationTabPending: "In attesa di risposta",
        conversationTabResolved: "Risposti",
        conversationCountsLoadFailed: "Impossibile caricare i conteggi per categoria. Verrà ritentato al prossimo aggiornamento.",
      },
    },
  },
  th: {
    ecommerce: {
      customerServiceWorkspace: {
        conversationTabAll: "ข้อความทั้งหมด",
        conversationTabEscalated: "การยกระดับที่ต้องจัดการ",
        conversationTabPending: "รอตอบกลับ",
        conversationTabResolved: "ตอบกลับแล้ว",
        conversationCountsLoadFailed: "โหลดจำนวนตามหมวดหมู่ไม่สำเร็จ จะลองใหม่เมื่อรีเฟรชครั้งถัดไป",
      },
    },
  },
} as const;
