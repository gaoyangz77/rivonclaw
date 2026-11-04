/**
 * Wording for the "review result" block of a Sample Application card: who
 * reviewed it and why it was rejected. A review the shop's Sample review rules
 * made (ADR-094) shows one general reason instead of the Provider reason code.
 * Also holds the message shown when TikTok refuses a person's approval and the
 * application stays pending.
 * Merged into every locale in languages.ts.
 */
export const AFFILIATE_SAMPLE_REVIEW_RESULT_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        sampleApprovalRefused: "TikTok refused this approval: \"{{message}}\" ({{code}}), without giving a reason. The application is still pending review. Try again later, or approve it directly in TikTok Seller Center to see the specific reason.",
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
        sampleApprovalRefused: "TikTok 拒绝了这次审批：“{{message}}”（{{code}}），未说明具体原因。申样仍为待审核，可以稍后重试，或在 TikTok 卖家中心直接审批这条申样以查看具体原因。",
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
        sampleApprovalRefused: "TikTok hat diese Genehmigung abgelehnt: „{{message}}“ ({{code}}), ohne Angabe eines Grundes. Die Anfrage bleibt in Prüfung. Versuche es später erneut oder genehmige sie direkt im TikTok Seller Center, um den genauen Grund zu sehen.",
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
        sampleApprovalRefused: "TikTok rechazó esta aprobación: \"{{message}}\" ({{code}}), sin indicar el motivo. La solicitud sigue pendiente de revisión. Vuelve a intentarlo más tarde o apruébala directamente en TikTok Seller Center para ver el motivo concreto.",
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
        sampleApprovalRefused: "TikTok a refusé cette approbation : « {{message}} » ({{code}}), sans en préciser la raison. La demande reste en attente de vérification. Réessayez plus tard ou approuvez-la directement dans TikTok Seller Center pour voir la raison exacte.",
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
        sampleApprovalRefused: "TikTok menolak persetujuan ini: \"{{message}}\" ({{code}}), tanpa menyebutkan alasannya. Permintaan masih menunggu peninjauan. Coba lagi nanti, atau setujui langsung di TikTok Seller Center untuk melihat alasan spesifiknya.",
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
        sampleApprovalRefused: "TikTok ha rifiutato questa approvazione: \"{{message}}\" ({{code}}), senza indicarne il motivo. La richiesta resta in attesa di verifica. Riprova più tardi oppure approvala direttamente in TikTok Seller Center per vedere il motivo preciso.",
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
        sampleApprovalRefused: "TikTok ปฏิเสธการอนุมัตินี้: \"{{message}}\" ({{code}}) โดยไม่ระบุสาเหตุ คำขอยังรอการตรวจสอบ โปรดลองอีกครั้งภายหลัง หรืออนุมัติโดยตรงใน TikTok Seller Center เพื่อดูสาเหตุที่แน่ชัด",
        sampleReviewResult: {
          label: "ผลการตรวจสอบ",
          rejectReason: "เหตุผลที่ปฏิเสธ: {{reason}}",
          shopRulesReason: "ไม่ตรงตามข้อกำหนดครีเอเตอร์ในพรอมต์ธุรกิจของร้าน",
        },
      },
    },
  },
};
