/**
 * Copy for a SEND_MESSAGE proposal once it is no longer open for review.
 *
 * The backend scrubs a proposal's creator-facing review draft as soon as the
 * proposal reaches a terminal state, so the card cannot keep promising a future
 * send: it either shows what the linked Delivery actually delivered, or says
 * plainly that the draft wording is gone.
 */
export const AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        proposalExecutionDescriptions: {
          SEND_MESSAGE_EXECUTED: "The system sent this message to the creator.",
          SEND_MESSAGE_NOT_SENT: "This proposal ended without a message reaching the creator.",
          SEND_MESSAGE_CONTENT_CLEARED:
            "After this proposal closed, the message text was cleared under the retention policy and is no longer shown here.",
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
          SEND_MESSAGE_CONTENT_CLEARED: "提议结束后，消息原文已按保留策略清除，这里不再显示原文。",
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
            "Nach dem Abschluss dieses Vorschlags wurde der Nachrichtentext gemäß Aufbewahrungsrichtlinie gelöscht und wird hier nicht mehr angezeigt.",
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
            "Tras cerrarse la propuesta, el texto del mensaje se eliminó según la política de retención y ya no se muestra aquí.",
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
            "Après la clôture de la proposition, le texte du message a été supprimé conformément à la politique de conservation et n'est plus affiché ici.",
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
            "Setelah proposal ditutup, teks pesan dihapus sesuai kebijakan retensi sehingga tidak lagi ditampilkan di sini.",
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
            "Dopo la chiusura della proposta il testo del messaggio è stato eliminato secondo la policy di conservazione e non viene più mostrato qui.",
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
            "หลังจากข้อเสนอปิดลง เนื้อหาข้อความถูกลบตามนโยบายการเก็บรักษา จึงไม่แสดงข้อความต้นฉบับที่นี่แล้ว",
        },
      },
    },
  },
} as const;
