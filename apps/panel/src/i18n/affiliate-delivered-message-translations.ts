/**
 * Copy for a SEND_MESSAGE proposal once it is no longer open for review.
 *
 * A closed card cannot keep promising a future send, so the wording follows the
 * proposal's own outcome. A proposal now keeps its message whatever that outcome
 * is, so the "no wording available" line is only ever reached by proposals older
 * than that change, whose drafts were deleted at terminal state.
 */
export const AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "The system sent this message to the creator.",
          SEND_MESSAGE_NOT_SENT: "This proposal ended without a message reaching the creator.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "This proposal predates message retention, so its wording was not kept and cannot be shown.",
        },
      },
    },
  },
  zh: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "系统已把这条消息发送给达人。",
          SEND_MESSAGE_NOT_SENT: "这条提议结束时没有成功向达人发送消息。",
          SEND_MESSAGE_CONTENT_CLEARED: "这是一条较早的提议，当时没有保留消息原文，已无法显示。",
        },
      },
    },
  },
  de: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "Das System hat diese Nachricht an den Creator gesendet.",
          SEND_MESSAGE_NOT_SENT:
            "Dieser Vorschlag endete, ohne dass eine Nachricht den Creator erreicht hat.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "Dieser Vorschlag stammt aus der Zeit vor der Nachrichtenaufbewahrung – sein Wortlaut wurde nicht gespeichert und kann nicht angezeigt werden.",
        },
      },
    },
  },
  es: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "El sistema envió este mensaje al creador.",
          SEND_MESSAGE_NOT_SENT:
            "Esta propuesta terminó sin que ningún mensaje llegara al creador.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "Esta propuesta es anterior a la retención de mensajes, así que su texto no se conservó y no puede mostrarse.",
        },
      },
    },
  },
  fr: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "Le système a envoyé ce message au créateur.",
          SEND_MESSAGE_NOT_SENT:
            "Cette proposition s'est terminée sans qu'aucun message ne parvienne au créateur.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "Cette proposition est antérieure à la conservation des messages : son texte n'a pas été gardé et ne peut pas être affiché.",
        },
      },
    },
  },
  id: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "Sistem sudah mengirim pesan ini ke kreator.",
          SEND_MESSAGE_NOT_SENT:
            "Proposal ini berakhir tanpa ada pesan yang sampai ke kreator.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "Proposal ini dibuat sebelum pesan mulai disimpan, jadi teksnya tidak tersimpan dan tidak bisa ditampilkan.",
        },
      },
    },
  },
  it: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "Il sistema ha inviato questo messaggio al creator.",
          SEND_MESSAGE_NOT_SENT:
            "Questa proposta si è conclusa senza che nessun messaggio raggiungesse il creator.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "Questa proposta è precedente alla conservazione dei messaggi: il suo testo non è stato mantenuto e non può essere mostrato.",
        },
      },
    },
  },
  th: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "ระบบส่งข้อความนี้ให้ครีเอเตอร์แล้ว",
          SEND_MESSAGE_NOT_SENT:
            "ข้อเสนอนี้สิ้นสุดลงโดยไม่มีข้อความส่งถึงครีเอเตอร์",
          SEND_MESSAGE_CONTENT_CLEARED:
            "ข้อเสนอนี้เกิดขึ้นก่อนที่ระบบจะเก็บเนื้อหาข้อความ จึงไม่มีข้อความต้นฉบับให้แสดง",
        },
      },
    },
  },
} as const;
