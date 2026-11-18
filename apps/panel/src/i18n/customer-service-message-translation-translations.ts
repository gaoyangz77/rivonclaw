/** Customer-service message translation (ADR-109): conversation toggle and the shop's automatic-translation setting (all supported locales). */
export const CUSTOMER_SERVICE_MESSAGE_TRANSLATION_TRANSLATIONS = {
  en: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "Translate",
        showOriginalMessages: "Show original",
        messageTranslationLabel: "Translation",
        messageTranslationSubscriptionRequired: "Message translation needs a cloud AI subscription.",
        messageTranslationQuotaExhausted: "The AI usage allowance is used up, so messages cannot be translated right now.",
        messageTranslationFailed: "Could not translate the messages.",
      },
      messageAutoTranslation: {
        title: "Message translation",
        field: "Automatic translation",
        off: "Do not translate automatically",
        escalated: "Translate escalated conversations",
        all: "Translate all conversations",
        hint: "Translates buyer and seller messages into the Panel language on the customer service page. Requires a cloud AI subscription. You can always translate a single conversation with the Translate button.",
        allHint: "Translating all conversations is not recommended: it consumes many tokens.",
        saveFailed: "Could not save the translation setting.",
      },
    },
  },
  zh: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "翻译",
        showOriginalMessages: "显示原文",
        messageTranslationLabel: "译文",
        messageTranslationSubscriptionRequired: "消息翻译需要云端 AI 订阅。",
        messageTranslationQuotaExhausted: "AI 用量额度已用完，暂时无法翻译消息。",
        messageTranslationFailed: "消息翻译失败。",
      },
      messageAutoTranslation: {
        title: "消息翻译",
        field: "自动翻译",
        off: "不自动翻译",
        escalated: "自动翻译升级对话",
        all: "自动翻译全部对话",
        hint: "在客服页面把买家和卖家的消息翻译成面板语言。需要云端 AI 订阅。无论如何设置，都可以用「翻译」按钮手动翻译单个对话。",
        allHint: "不推荐翻译全部对话：会消耗大量 token。",
        saveFailed: "翻译设置保存失败。",
      },
    },
  },
  de: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "Übersetzen",
        showOriginalMessages: "Original anzeigen",
        messageTranslationLabel: "Übersetzung",
        messageTranslationSubscriptionRequired: "Die Nachrichtenübersetzung erfordert ein Cloud-KI-Abonnement.",
        messageTranslationQuotaExhausted: "Das KI-Nutzungskontingent ist aufgebraucht, Nachrichten können derzeit nicht übersetzt werden.",
        messageTranslationFailed: "Die Nachrichten konnten nicht übersetzt werden.",
      },
      messageAutoTranslation: {
        title: "Nachrichtenübersetzung",
        field: "Automatische Übersetzung",
        off: "Nicht automatisch übersetzen",
        escalated: "Eskalierte Unterhaltungen übersetzen",
        all: "Alle Unterhaltungen übersetzen",
        hint: "Übersetzt Nachrichten von Käufern und Verkäufern auf der Kundenservice-Seite in die Sprache des Panels. Erfordert ein Cloud-KI-Abonnement. Einzelne Unterhaltungen lassen sich jederzeit mit der Schaltfläche „Übersetzen“ übersetzen.",
        allHint: "Alle Unterhaltungen zu übersetzen wird nicht empfohlen: Es verbraucht viele Tokens.",
        saveFailed: "Die Übersetzungseinstellung konnte nicht gespeichert werden.",
      },
    },
  },
  es: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "Traducir",
        showOriginalMessages: "Mostrar original",
        messageTranslationLabel: "Traducción",
        messageTranslationSubscriptionRequired: "La traducción de mensajes requiere una suscripción de IA en la nube.",
        messageTranslationQuotaExhausted: "Se ha agotado la cuota de uso de IA, por lo que ahora no se pueden traducir los mensajes.",
        messageTranslationFailed: "No se pudieron traducir los mensajes.",
      },
      messageAutoTranslation: {
        title: "Traducción de mensajes",
        field: "Traducción automática",
        off: "No traducir automáticamente",
        escalated: "Traducir conversaciones escaladas",
        all: "Traducir todas las conversaciones",
        hint: "Traduce los mensajes de compradores y vendedores al idioma del panel en la página de atención al cliente. Requiere una suscripción de IA en la nube. Siempre puedes traducir una conversación con el botón Traducir.",
        allHint: "No se recomienda traducir todas las conversaciones: consume muchos tokens.",
        saveFailed: "No se pudo guardar el ajuste de traducción.",
      },
    },
  },
  fr: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "Traduire",
        showOriginalMessages: "Afficher l’original",
        messageTranslationLabel: "Traduction",
        messageTranslationSubscriptionRequired: "La traduction des messages nécessite un abonnement IA cloud.",
        messageTranslationQuotaExhausted: "Le quota d’utilisation de l’IA est épuisé : les messages ne peuvent pas être traduits pour le moment.",
        messageTranslationFailed: "Impossible de traduire les messages.",
      },
      messageAutoTranslation: {
        title: "Traduction des messages",
        field: "Traduction automatique",
        off: "Ne pas traduire automatiquement",
        escalated: "Traduire les conversations escaladées",
        all: "Traduire toutes les conversations",
        hint: "Traduit les messages des acheteurs et des vendeurs dans la langue du panneau sur la page du service client. Nécessite un abonnement IA cloud. Vous pouvez toujours traduire une conversation avec le bouton Traduire.",
        allHint: "Traduire toutes les conversations n’est pas recommandé : cela consomme beaucoup de tokens.",
        saveFailed: "Impossible d’enregistrer le réglage de traduction.",
      },
    },
  },
  id: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "Terjemahkan",
        showOriginalMessages: "Tampilkan asli",
        messageTranslationLabel: "Terjemahan",
        messageTranslationSubscriptionRequired: "Terjemahan pesan memerlukan langganan AI cloud.",
        messageTranslationQuotaExhausted: "Kuota penggunaan AI sudah habis, sehingga pesan tidak dapat diterjemahkan saat ini.",
        messageTranslationFailed: "Pesan tidak dapat diterjemahkan.",
      },
      messageAutoTranslation: {
        title: "Terjemahan pesan",
        field: "Terjemahan otomatis",
        off: "Jangan terjemahkan otomatis",
        escalated: "Terjemahkan percakapan yang dieskalasi",
        all: "Terjemahkan semua percakapan",
        hint: "Menerjemahkan pesan pembeli dan penjual ke bahasa panel di halaman layanan pelanggan. Memerlukan langganan AI cloud. Anda selalu dapat menerjemahkan satu percakapan dengan tombol Terjemahkan.",
        allHint: "Menerjemahkan semua percakapan tidak disarankan: menghabiskan banyak token.",
        saveFailed: "Pengaturan terjemahan tidak dapat disimpan.",
      },
    },
  },
  it: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "Traduci",
        showOriginalMessages: "Mostra originale",
        messageTranslationLabel: "Traduzione",
        messageTranslationSubscriptionRequired: "La traduzione dei messaggi richiede un abbonamento AI cloud.",
        messageTranslationQuotaExhausted: "La quota di utilizzo dell’AI è esaurita, quindi al momento non è possibile tradurre i messaggi.",
        messageTranslationFailed: "Impossibile tradurre i messaggi.",
      },
      messageAutoTranslation: {
        title: "Traduzione dei messaggi",
        field: "Traduzione automatica",
        off: "Non tradurre automaticamente",
        escalated: "Traduci le conversazioni escalate",
        all: "Traduci tutte le conversazioni",
        hint: "Traduce i messaggi di acquirenti e venditori nella lingua del pannello nella pagina del servizio clienti. Richiede un abbonamento AI cloud. Puoi sempre tradurre una conversazione con il pulsante Traduci.",
        allHint: "Tradurre tutte le conversazioni non è consigliato: consuma molti token.",
        saveFailed: "Impossibile salvare l’impostazione di traduzione.",
      },
    },
  },
  th: {
    ecommerce: {
      customerServiceWorkspace: {
        translateMessages: "แปล",
        showOriginalMessages: "แสดงต้นฉบับ",
        messageTranslationLabel: "คำแปล",
        messageTranslationSubscriptionRequired: "การแปลข้อความต้องมีการสมัครสมาชิก AI บนคลาวด์",
        messageTranslationQuotaExhausted: "โควตาการใช้งาน AI หมดแล้ว จึงยังแปลข้อความไม่ได้ในขณะนี้",
        messageTranslationFailed: "ไม่สามารถแปลข้อความได้",
      },
      messageAutoTranslation: {
        title: "การแปลข้อความ",
        field: "การแปลอัตโนมัติ",
        off: "ไม่แปลอัตโนมัติ",
        escalated: "แปลบทสนทนาที่ส่งต่อให้เจ้าหน้าที่",
        all: "แปลทุกบทสนทนา",
        hint: "แปลข้อความของผู้ซื้อและผู้ขายเป็นภาษาของแผงควบคุมในหน้าบริการลูกค้า ต้องมีการสมัครสมาชิก AI บนคลาวด์ คุณยังแปลทีละบทสนทนาได้ด้วยปุ่มแปลเสมอ",
        allHint: "ไม่แนะนำให้แปลทุกบทสนทนา เพราะใช้โทเค็นจำนวนมาก",
        saveFailed: "บันทึกการตั้งค่าการแปลไม่สำเร็จ",
      },
    },
  },
} as const;
