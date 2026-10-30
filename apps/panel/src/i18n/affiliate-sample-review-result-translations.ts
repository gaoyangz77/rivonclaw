/**
 * Wording for the "review result" block of a Sample Application card: who
 * reviewed it and why it was rejected. A review the shop's Sample review rules
 * made (ADR-094) shows one general reason instead of the Provider reason code.
 * Merged into every locale in languages.ts.
 */
export const AFFILIATE_SAMPLE_REVIEW_RESULT_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "Review result",
          rejectReason: "Rejection reason: {{reason}}",
          shopRulesReason: "Does not meet the creator requirements in the shop's business prompt",
        },
      },
    },
  },
  zh: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "审核结果",
          rejectReason: "拒绝理由：{{reason}}",
          shopRulesReason: "不符合店铺达人业务提示词要求",
        },
      },
    },
  },
  de: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "Prüfergebnis",
          rejectReason: "Ablehnungsgrund: {{reason}}",
          shopRulesReason: "Erfüllt nicht die Creator-Anforderungen im Business-Prompt des Shops",
        },
      },
    },
  },
  es: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "Resultado de la revisión",
          rejectReason: "Motivo del rechazo: {{reason}}",
          shopRulesReason: "No cumple los requisitos de creadores del prompt de negocio de la tienda",
        },
      },
    },
  },
  fr: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "Résultat de la vérification",
          rejectReason: "Motif du refus : {{reason}}",
          shopRulesReason: "Ne répond pas aux exigences créateurs du prompt métier de la boutique",
        },
      },
    },
  },
  id: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "Hasil peninjauan",
          rejectReason: "Alasan penolakan: {{reason}}",
          shopRulesReason: "Tidak memenuhi persyaratan kreator dalam prompt bisnis toko",
        },
      },
    },
  },
  it: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "Esito della revisione",
          rejectReason: "Motivo del rifiuto: {{reason}}",
          shopRulesReason: "Non soddisfa i requisiti per i creator del prompt aziendale del negozio",
        },
      },
    },
  },
  th: {
    ecommerce: {
      affiliateWorkspace: {
        sampleReviewResult: {
          label: "ผลการตรวจสอบ",
          rejectReason: "เหตุผลที่ปฏิเสธ: {{reason}}",
          shopRulesReason: "ไม่ตรงตามข้อกำหนดครีเอเตอร์ในพรอมต์ธุรกิจของร้าน",
        },
      },
    },
  },
};
