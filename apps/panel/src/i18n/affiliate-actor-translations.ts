/**
 * Labels for the person (or process) that performed an Affiliate action: the
 * kind labels resolved by `formatAffiliateActor` plus the captions that put
 * those labels next to a sample review and an outbound message. Merged into
 * every locale in languages.ts.
 *
 * AGENT stays "Agent" in every locale so it matches the existing review and
 * timeline wording; the BD hint is the same abbreviation everywhere.
 */
export const AFFILIATE_ACTOR_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "Owner account",
            DELETED_MEMBER: "Deleted account",
            UNKNOWN_HUMAN: "Staff",
            AGENT: "Agent",
            SYSTEM: "System",
          },
          businessDeveloperHint: "BD",
          reviewer: "Reviewer: {{actor}}",
          sentBy: "Sent by {{actor}}",
        },
      },
    },
  },
  zh: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "主账号",
            DELETED_MEMBER: "已删除的账号",
            UNKNOWN_HUMAN: "人工",
            AGENT: "Agent",
            SYSTEM: "系统",
          },
          businessDeveloperHint: "BD",
          reviewer: "审核人：{{actor}}",
          sentBy: "{{actor}} 发送",
        },
      },
    },
  },
  de: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "Hauptkonto",
            DELETED_MEMBER: "Gelöschtes Konto",
            UNKNOWN_HUMAN: "Mitarbeiter",
            AGENT: "Agent",
            SYSTEM: "System",
          },
          businessDeveloperHint: "BD",
          reviewer: "Prüfer: {{actor}}",
          sentBy: "Gesendet von {{actor}}",
        },
      },
    },
  },
  es: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "Cuenta principal",
            DELETED_MEMBER: "Cuenta eliminada",
            UNKNOWN_HUMAN: "Personal",
            AGENT: "Agent",
            SYSTEM: "Sistema",
          },
          businessDeveloperHint: "BD",
          reviewer: "Revisor: {{actor}}",
          sentBy: "Enviado por {{actor}}",
        },
      },
    },
  },
  fr: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "Compte principal",
            DELETED_MEMBER: "Compte supprimé",
            UNKNOWN_HUMAN: "Équipe",
            AGENT: "Agent",
            SYSTEM: "Système",
          },
          businessDeveloperHint: "BD",
          reviewer: "Examiné par : {{actor}}",
          sentBy: "Envoyé par {{actor}}",
        },
      },
    },
  },
  id: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "Akun utama",
            DELETED_MEMBER: "Akun yang dihapus",
            UNKNOWN_HUMAN: "Staf",
            AGENT: "Agent",
            SYSTEM: "Sistem",
          },
          businessDeveloperHint: "BD",
          reviewer: "Peninjau: {{actor}}",
          sentBy: "Dikirim oleh {{actor}}",
        },
      },
    },
  },
  it: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "Account principale",
            DELETED_MEMBER: "Account eliminato",
            UNKNOWN_HUMAN: "Staff",
            AGENT: "Agent",
            SYSTEM: "Sistema",
          },
          businessDeveloperHint: "BD",
          reviewer: "Revisore: {{actor}}",
          sentBy: "Inviato da {{actor}}",
        },
      },
    },
  },
  th: {
    ecommerce: {
      affiliateWorkspace: {
        actor: {
          kinds: {
            OWNER: "บัญชีหลัก",
            DELETED_MEMBER: "บัญชีที่ถูกลบ",
            UNKNOWN_HUMAN: "พนักงาน",
            AGENT: "Agent",
            SYSTEM: "ระบบ",
          },
          businessDeveloperHint: "BD",
          reviewer: "ผู้ตรวจสอบ: {{actor}}",
          sentBy: "ส่งโดย {{actor}}",
        },
      },
    },
  },
} as const;
