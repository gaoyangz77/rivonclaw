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
        sampleApprovalRefused: "TikTok could not create the sample order for this application, so it is still pending review. Check the product's sample stock or sample settings and try again, or choose Reject.",
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
        sampleApprovalRefused: "TikTok 无法为这条申样创建样品订单，申样仍为待审核。可检查商品的样品库存或样品设置后重试，或选择拒绝。",
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
        sampleApprovalRefused: "TikTok konnte für diese Anfrage keine Musterbestellung erstellen, daher bleibt sie in Prüfung. Prüfe den Musterbestand oder die Mustereinstellungen des Produkts und versuche es erneut, oder wähle Ablehnen.",
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
        sampleApprovalRefused: "TikTok no pudo crear el pedido de muestra para esta solicitud, por lo que sigue pendiente de revisión. Revisa el stock o la configuración de muestras del producto y vuelve a intentarlo, o elige Rechazar.",
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
        sampleApprovalRefused: "TikTok n'a pas pu créer la commande d'échantillon pour cette demande, elle reste donc en attente de vérification. Vérifiez le stock d'échantillons ou les réglages d'échantillons du produit puis réessayez, ou choisissez Refuser.",
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
        sampleApprovalRefused: "TikTok tidak dapat membuat pesanan sampel untuk permintaan ini, sehingga statusnya masih menunggu peninjauan. Periksa stok sampel atau pengaturan sampel produk lalu coba lagi, atau pilih Tolak.",
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
        sampleApprovalRefused: "TikTok non è riuscito a creare l'ordine campione per questa richiesta, quindi resta in attesa di verifica. Controlla la disponibilità o le impostazioni dei campioni del prodotto e riprova, oppure scegli Rifiuta.",
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
        sampleApprovalRefused: "TikTok ไม่สามารถสร้างคำสั่งซื้อตัวอย่างสำหรับคำขอนี้ได้ คำขอจึงยังรอการตรวจสอบ โปรดตรวจสอบสต็อกหรือการตั้งค่าตัวอย่างของสินค้าแล้วลองอีกครั้ง หรือเลือกปฏิเสธ",
        sampleReviewResult: {
          label: "ผลการตรวจสอบ",
          rejectReason: "เหตุผลที่ปฏิเสธ: {{reason}}",
          shopRulesReason: "ไม่ตรงตามข้อกำหนดครีเอเตอร์ในพรอมต์ธุรกิจของร้าน",
        },
      },
    },
  },
};
