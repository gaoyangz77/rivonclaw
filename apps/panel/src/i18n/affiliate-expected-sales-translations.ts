export const AFFILIATE_EXPECTED_SALES_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Expected sales",
          bootstrapEstimate: "Bootstrap estimate",
          bootstrapBadge: "Bootstrap",
          bootstrapExplanation:
            "Built from creators’ current performance and recently completed collaborations. Used as the Expected Sales fallback until enough decision-time data accumulates.",
          effectiveScope: "Effective model scope: {{scope}}",
        },
      },
    },
  },
  zh: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Expected sales",
          bootstrapEstimate: "冷启动估算",
          bootstrapBadge: "冷启动",
          bootstrapExplanation:
            "基于 Creator 当前表现和近期已完成合作构建。在积累足够的决策时点数据前，作为 Expected Sales 的 fallback。",
          effectiveScope: "实际模型范围：{{scope}}",
        },
      },
    },
  },
  de: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Erwartete Verkäufe",
          bootstrapEstimate: "Kaltstart-Schätzung",
          bootstrapBadge: "Kaltstart",
          bootstrapExplanation:
            "Basiert auf der aktuellen Creator-Leistung und kürzlich abgeschlossenen Kooperationen. Dient als Expected-Sales-Fallback, bis genügend Daten zum Entscheidungszeitpunkt vorliegen.",
          effectiveScope: "Effektiver Modellbereich: {{scope}}",
        },
      },
    },
  },
  es: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Ventas esperadas",
          bootstrapEstimate: "Estimación de arranque",
          bootstrapBadge: "Arranque",
          bootstrapExplanation:
            "Se basa en el rendimiento actual de los creadores y en colaboraciones finalizadas recientemente. Se usa como respaldo de Expected Sales hasta reunir suficientes datos del momento de decisión.",
          effectiveScope: "Ámbito efectivo del modelo: {{scope}}",
        },
      },
    },
  },
  fr: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Ventes attendues",
          bootstrapEstimate: "Estimation de démarrage",
          bootstrapBadge: "Démarrage",
          bootstrapExplanation:
            "Fondée sur les performances actuelles des créateurs et les collaborations récemment terminées. Sert de solution de repli pour Expected Sales jusqu’à disposer de suffisamment de données au moment de la décision.",
          effectiveScope: "Périmètre effectif du modèle : {{scope}}",
        },
      },
    },
  },
  id: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Perkiraan penjualan",
          bootstrapEstimate: "Estimasi bootstrap",
          bootstrapBadge: "Bootstrap",
          bootstrapExplanation:
            "Dibangun dari performa kreator saat ini dan kolaborasi yang baru selesai. Digunakan sebagai fallback Expected Sales sampai data pada waktu keputusan mencukupi.",
          effectiveScope: "Cakupan model efektif: {{scope}}",
        },
      },
    },
  },
  it: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "Vendite attese",
          bootstrapEstimate: "Stima di avvio",
          bootstrapBadge: "Avvio",
          bootstrapExplanation:
            "Basata sulle prestazioni attuali dei creator e sulle collaborazioni concluse di recente. Viene usata come fallback di Expected Sales finché non sono disponibili dati sufficienti al momento della decisione.",
          effectiveScope: "Ambito effettivo del modello: {{scope}}",
        },
      },
    },
  },
  th: {
    ecommerce: {
      affiliateWorkspace: {
        predictionComparison: {
          expectedSales: "ยอดขายที่คาดไว้",
          bootstrapEstimate: "ค่าประมาณช่วงเริ่มต้น",
          bootstrapBadge: "ช่วงเริ่มต้น",
          bootstrapExplanation:
            "สร้างจากผลงานปัจจุบันของ Creator และความร่วมมือที่เพิ่งเสร็จสิ้น ใช้เป็น fallback ของ Expected Sales จนกว่าจะมีข้อมูล ณ เวลาตัดสินใจเพียงพอ",
          effectiveScope: "ขอบเขตโมเดลที่ใช้จริง: {{scope}}",
        },
      },
    },
  },
} as const;
