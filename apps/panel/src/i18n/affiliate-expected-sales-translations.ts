export const AFFILIATE_EXPECTED_SALES_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateWorkspace: {
        productionModel: "Production model",
        bestAvailableModel: "Best-available model",
        bestAvailableExplanation:
          "One progressive model that prefers decision-time features and uses eligible current-state proxies only when needed.",
        bestAvailableCurrentReview:
          "Best-available model · used for current sample review",
        bestAvailableNoEvaluation:
          "The best-available model is ready; this version has no backtest report yet.",
        bootstrapModel: "Bootstrap model",
        bootstrapApproximation: "Cold-start approximation using CURRENT_STATE_PROXY features.",
        modelDataAccumulating: "Data accumulating",
        productionCurrentReview: "Production model · used for current sample review",
        bootstrapCurrentReview: "Bootstrap model · used for current sample review",
        bootstrapBackup: "Backup model",
        evaluationSamples: "Evaluation samples",
        evaluationLift: "Expected lift",
        evaluationBalancedAccuracy: "Balanced accuracy",
        evaluationTrainedAt: "Trained",
        bootstrapNoEvaluation: "Bootstrap is available for sample review; this version has no backtest report yet.",
        productionNoEvaluation: "Production model is ready; this version has no backtest report yet.",
        modelAvailabilityUnavailable: "No READY artifact matches this scope and contract.",
        modelAvailabilityEmpty: "Live model availability could not be loaded.",
        modelCombinationsReady: "Production model ready",
        predictionComparison: {
          bootstrapEstimate: "Bootstrap estimate",
          bootstrapBadge: "Bootstrap",
          humanDecision: "Human decision",
          modelUnavailable: "Model unavailable",
          humanBootstrapEstimate: "Bootstrap human-decision estimate",
          humanBootstrapExplanation:
            "Built from current-state proxy features and historical staff decisions. Used until enough decision-time Human Decision examples accumulate.",
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
        productionModel: "正式模型",
        bestAvailableModel: "当前最佳模型",
        bestAvailableExplanation:
          "同一套渐进模型优先使用决策时点特征，仅在缺失时采用符合条件的当前状态近似特征。",
        bestAvailableCurrentReview: "当前最佳模型 · 当前审样使用",
        bestAvailableNoEvaluation:
          "当前最佳模型已就绪，当前版本尚无回测报告。",
        bootstrapModel: "冷启动模型",
        bootstrapApproximation: "使用 CURRENT_STATE_PROXY 特征的冷启动近似。",
        modelDataAccumulating: "数据积累中",
        productionCurrentReview: "正式模型 · 当前审样使用",
        bootstrapCurrentReview: "冷启动模型 · 当前审样使用",
        bootstrapBackup: "备用模型",
        evaluationSamples: "回测样本",
        evaluationLift: "预期提升",
        evaluationBalancedAccuracy: "平衡准确率",
        evaluationTrainedAt: "训练时间",
        bootstrapNoEvaluation: "冷启动模型可用于审样，当前版本尚无回测报告",
        productionNoEvaluation: "正式模型已就绪，当前版本尚无回测报告",
        modelAvailabilityUnavailable: "当前范围与契约下没有 READY artifact。",
        modelAvailabilityEmpty: "无法读取实时模型可用性。",
        modelCombinationsReady: "Production 模型已就绪",
        predictionComparison: {
          bootstrapEstimate: "冷启动估算",
          bootstrapBadge: "冷启动",
          humanDecision: "人工决策",
          modelUnavailable: "模型不可用",
          humanBootstrapEstimate: "人工决策冷启动估算",
          humanBootstrapExplanation:
            "基于当前状态近似特征和历史真实人工审核构建。在积累足够的决策时点人工审核样本前使用。",
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
        productionModel: "Produktionsmodell",
        bestAvailableModel: "Bestverfügbares Modell",
        bestAvailableExplanation:
          "Ein progressives Modell bevorzugt Entscheidungszeit-Merkmale und nutzt nur bei Bedarf zulässige aktuelle Näherungen.",
        bestAvailableCurrentReview:
          "Bestverfügbares Modell · für die aktuelle Prüfung",
        bestAvailableNoEvaluation:
          "Das bestverfügbare Modell ist bereit; für diese Version liegt noch kein Backtest vor.",
        bootstrapModel: "Kaltstartmodell",
        bootstrapApproximation: "Kaltstart-Näherung mit CURRENT_STATE_PROXY-Merkmalen.",
        modelDataAccumulating: "Daten werden gesammelt",
        productionCurrentReview: "Produktionsmodell · aktuell für Musterprüfungen",
        bootstrapCurrentReview: "Kaltstartmodell · aktuell für Musterprüfungen",
        bootstrapBackup: "Ersatzmodell",
        evaluationSamples: "Evaluierungsbeispiele",
        evaluationLift: "Erwarteter Uplift",
        evaluationBalancedAccuracy: "Ausgewogene Genauigkeit",
        evaluationTrainedAt: "Trainiert",
        bootstrapNoEvaluation: "Das Kaltstartmodell ist für Musterprüfungen verfügbar; für diese Version liegt noch kein Backtest vor.",
        productionNoEvaluation: "Das Produktionsmodell ist bereit; für diese Version liegt noch kein Backtest vor.",
        modelAvailabilityUnavailable: "Kein READY-Artefakt entspricht diesem Bereich und Vertrag.",
        modelAvailabilityEmpty: "Die Live-Modellverfügbarkeit konnte nicht geladen werden.",
        modelCombinationsReady: "Produktionsmodell bereit",
        predictionComparison: {
          bootstrapEstimate: "Kaltstart-Schätzung",
          bootstrapBadge: "Kaltstart",
          humanDecision: "Menschliche Entscheidung",
          modelUnavailable: "Modell nicht verfügbar",
          humanBootstrapEstimate: "Kaltstart-Schätzung der menschlichen Entscheidung",
          humanBootstrapExplanation:
            "Basiert auf aktuellen Proxy-Merkmalen und historischen Teamentscheidungen. Wird genutzt, bis genügend Human-Decision-Beispiele zum Entscheidungszeitpunkt vorliegen.",
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
        productionModel: "Modelo de producción",
        bestAvailableModel: "Mejor modelo disponible",
        bestAvailableExplanation:
          "Un modelo progresivo prioriza datos del momento de decisión y usa aproximaciones actuales válidas solo cuando hacen falta.",
        bestAvailableCurrentReview:
          "Mejor modelo disponible · usado en la revisión actual",
        bestAvailableNoEvaluation:
          "El mejor modelo disponible está listo; esta versión aún no tiene informe de backtest.",
        bootstrapModel: "Modelo de arranque",
        bootstrapApproximation: "Aproximación de arranque con características CURRENT_STATE_PROXY.",
        modelDataAccumulating: "Acumulando datos",
        productionCurrentReview: "Modelo de producción · usado en la revisión actual",
        bootstrapCurrentReview: "Modelo de arranque · usado en la revisión actual",
        bootstrapBackup: "Modelo de respaldo",
        evaluationSamples: "Muestras de evaluación",
        evaluationLift: "Mejora esperada",
        evaluationBalancedAccuracy: "Exactitud equilibrada",
        evaluationTrainedAt: "Entrenado",
        bootstrapNoEvaluation: "El modelo de arranque está disponible para revisar muestras; esta versión aún no tiene informe retrospectivo.",
        productionNoEvaluation: "El modelo de producción está listo; esta versión aún no tiene informe retrospectivo.",
        modelAvailabilityUnavailable: "Ningún artefacto READY coincide con este ámbito y contrato.",
        modelAvailabilityEmpty: "No se pudo cargar la disponibilidad del modelo en vivo.",
        modelCombinationsReady: "Modelo de producción listo",
        predictionComparison: {
          bootstrapEstimate: "Estimación de arranque",
          bootstrapBadge: "Arranque",
          humanDecision: "Decisión humana",
          modelUnavailable: "Modelo no disponible",
          humanBootstrapEstimate: "Estimación inicial de decisión humana",
          humanBootstrapExplanation:
            "Se basa en características proxy del estado actual y decisiones históricas reales. Se usa hasta reunir suficientes ejemplos de decisión humana en el momento de decidir.",
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
        productionModel: "Modèle de production",
        bestAvailableModel: "Meilleur modèle disponible",
        bestAvailableExplanation:
          "Un modèle progressif privilégie les variables au moment de la décision et utilise une approximation actuelle admissible si nécessaire.",
        bestAvailableCurrentReview:
          "Meilleur modèle disponible · utilisé pour la revue actuelle",
        bestAvailableNoEvaluation:
          "Le meilleur modèle disponible est prêt ; cette version n’a pas encore de rapport de backtest.",
        bootstrapModel: "Modèle de démarrage",
        bootstrapApproximation: "Approximation de démarrage avec des variables CURRENT_STATE_PROXY.",
        modelDataAccumulating: "Données en cours d’accumulation",
        productionCurrentReview: "Modèle de production · utilisé pour la revue actuelle",
        bootstrapCurrentReview: "Modèle de démarrage · utilisé pour la revue actuelle",
        bootstrapBackup: "Modèle de secours",
        evaluationSamples: "Échantillons d’évaluation",
        evaluationLift: "Gain attendu",
        evaluationBalancedAccuracy: "Exactitude équilibrée",
        evaluationTrainedAt: "Entraîné",
        bootstrapNoEvaluation: "Le modèle de démarrage peut revoir les échantillons ; cette version n’a pas encore de rapport de backtest.",
        productionNoEvaluation: "Le modèle de production est prêt ; cette version n’a pas encore de rapport de backtest.",
        modelAvailabilityUnavailable: "Aucun artefact READY ne correspond à ce périmètre et à ce contrat.",
        modelAvailabilityEmpty: "La disponibilité en direct des modèles n’a pas pu être chargée.",
        modelCombinationsReady: "Modèle de production prêt",
        predictionComparison: {
          bootstrapEstimate: "Estimation de démarrage",
          bootstrapBadge: "Démarrage",
          humanDecision: "Décision humaine",
          modelUnavailable: "Modèle indisponible",
          humanBootstrapEstimate: "Estimation de démarrage de la décision humaine",
          humanBootstrapExplanation:
            "Fondée sur des caractéristiques proxy actuelles et des décisions humaines historiques. Utilisée jusqu’à disposer de suffisamment d’exemples au moment de la décision.",
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
        productionModel: "Model produksi",
        bestAvailableModel: "Model terbaik yang tersedia",
        bestAvailableExplanation:
          "Satu model progresif mengutamakan fitur saat keputusan dan memakai proksi kondisi kini yang valid hanya bila diperlukan.",
        bestAvailableCurrentReview:
          "Model terbaik yang tersedia · dipakai untuk tinjauan saat ini",
        bestAvailableNoEvaluation:
          "Model terbaik yang tersedia sudah siap; versi ini belum memiliki laporan backtest.",
        bootstrapModel: "Model bootstrap",
        bootstrapApproximation: "Perkiraan awal dengan fitur CURRENT_STATE_PROXY.",
        modelDataAccumulating: "Data sedang dikumpulkan",
        productionCurrentReview: "Model produksi · digunakan untuk tinjauan sampel saat ini",
        bootstrapCurrentReview: "Model bootstrap · digunakan untuk tinjauan sampel saat ini",
        bootstrapBackup: "Model cadangan",
        evaluationSamples: "Sampel evaluasi",
        evaluationLift: "Peningkatan yang diharapkan",
        evaluationBalancedAccuracy: "Akurasi seimbang",
        evaluationTrainedAt: "Dilatih",
        bootstrapNoEvaluation: "Model bootstrap tersedia untuk tinjauan sampel; versi ini belum memiliki laporan backtest.",
        productionNoEvaluation: "Model produksi siap; versi ini belum memiliki laporan backtest.",
        modelAvailabilityUnavailable: "Tidak ada artefak READY yang cocok dengan cakupan dan kontrak ini.",
        modelAvailabilityEmpty: "Ketersediaan model langsung tidak dapat dimuat.",
        modelCombinationsReady: "Model produksi siap",
        predictionComparison: {
          bootstrapEstimate: "Estimasi bootstrap",
          bootstrapBadge: "Bootstrap",
          humanDecision: "Keputusan manusia",
          modelUnavailable: "Model tidak tersedia",
          humanBootstrapEstimate: "Estimasi bootstrap keputusan manusia",
          humanBootstrapExplanation:
            "Dibangun dari fitur proxy keadaan saat ini dan keputusan staf historis. Digunakan sampai contoh Human Decision pada waktu keputusan mencukupi.",
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
        productionModel: "Modello di produzione",
        bestAvailableModel: "Miglior modello disponibile",
        bestAvailableExplanation:
          "Un unico modello progressivo preferisce le feature al momento della decisione e usa proxy attuali idonei solo quando necessario.",
        bestAvailableCurrentReview:
          "Miglior modello disponibile · usato per la revisione attuale",
        bestAvailableNoEvaluation:
          "Il miglior modello disponibile è pronto; questa versione non ha ancora un report di backtest.",
        bootstrapModel: "Modello di avvio",
        bootstrapApproximation: "Approssimazione iniziale con feature CURRENT_STATE_PROXY.",
        modelDataAccumulating: "Raccolta dati in corso",
        productionCurrentReview: "Modello di produzione · usato per la revisione corrente",
        bootstrapCurrentReview: "Modello di avvio · usato per la revisione corrente",
        bootstrapBackup: "Modello di riserva",
        evaluationSamples: "Campioni di valutazione",
        evaluationLift: "Incremento atteso",
        evaluationBalancedAccuracy: "Accuratezza bilanciata",
        evaluationTrainedAt: "Addestrato",
        bootstrapNoEvaluation: "Il modello di avvio è disponibile per la revisione; questa versione non ha ancora un report di backtest.",
        productionNoEvaluation: "Il modello di produzione è pronto; questa versione non ha ancora un report di backtest.",
        modelAvailabilityUnavailable: "Nessun artefatto READY corrisponde a questo ambito e contratto.",
        modelAvailabilityEmpty: "Impossibile caricare la disponibilità live dei modelli.",
        modelCombinationsReady: "Modello di produzione pronto",
        predictionComparison: {
          bootstrapEstimate: "Stima di avvio",
          bootstrapBadge: "Avvio",
          humanDecision: "Decisione umana",
          modelUnavailable: "Modello non disponibile",
          humanBootstrapEstimate: "Stima iniziale della decisione umana",
          humanBootstrapExplanation:
            "Basata su feature proxy dello stato attuale e decisioni storiche reali. Usata finché non sono disponibili esempi sufficienti al momento della decisione.",
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
        productionModel: "โมเดลใช้งานจริง",
        bestAvailableModel: "โมเดลที่ดีที่สุดในขณะนี้",
        bestAvailableExplanation:
          "โมเดลแบบค่อยเป็นค่อยไปจะใช้ข้อมูล ณ เวลาตัดสินใจก่อน และใช้ข้อมูลสถานะปัจจุบันที่ผ่านเกณฑ์เมื่อจำเป็นเท่านั้น",
        bestAvailableCurrentReview:
          "โมเดลที่ดีที่สุดในขณะนี้ · ใช้กับการตรวจสอบปัจจุบัน",
        bestAvailableNoEvaluation:
          "โมเดลที่ดีที่สุดในขณะนี้พร้อมใช้งาน แต่เวอร์ชันนี้ยังไม่มีรายงาน backtest",
        bootstrapModel: "โมเดลเริ่มต้น",
        bootstrapApproximation: "การประมาณช่วงเริ่มต้นด้วยฟีเจอร์ CURRENT_STATE_PROXY",
        modelDataAccumulating: "กำลังสะสมข้อมูล",
        productionCurrentReview: "โมเดลใช้งานจริง · ใช้ตรวจตัวอย่างปัจจุบัน",
        bootstrapCurrentReview: "โมเดลเริ่มต้น · ใช้ตรวจตัวอย่างปัจจุบัน",
        bootstrapBackup: "โมเดลสำรอง",
        evaluationSamples: "ตัวอย่างการประเมิน",
        evaluationLift: "ผลเพิ่มที่คาดหวัง",
        evaluationBalancedAccuracy: "ความแม่นยำแบบสมดุล",
        evaluationTrainedAt: "ฝึกเมื่อ",
        bootstrapNoEvaluation: "โมเดลเริ่มต้นพร้อมตรวจตัวอย่าง แต่เวอร์ชันนี้ยังไม่มีรายงาน backtest",
        productionNoEvaluation: "โมเดลใช้งานจริงพร้อมแล้ว แต่เวอร์ชันนี้ยังไม่มีรายงาน backtest",
        modelAvailabilityUnavailable: "ไม่มี artifact สถานะ READY ที่ตรงกับขอบเขตและสัญญานี้",
        modelAvailabilityEmpty: "ไม่สามารถโหลดสถานะโมเดลแบบสดได้",
        modelCombinationsReady: "โมเดล Production พร้อมใช้งาน",
        predictionComparison: {
          bootstrapEstimate: "ค่าประมาณช่วงเริ่มต้น",
          bootstrapBadge: "ช่วงเริ่มต้น",
          humanDecision: "การตัดสินใจของพนักงาน",
          modelUnavailable: "โมเดลไม่พร้อมใช้งาน",
          humanBootstrapEstimate: "ค่าประมาณช่วงเริ่มต้นของการตัดสินใจ",
          humanBootstrapExplanation:
            "สร้างจากฟีเจอร์ตัวแทนของสถานะปัจจุบันและการตัดสินใจจริงในอดีต ใช้จนกว่าจะมีตัวอย่าง Human Decision ณ เวลาตัดสินใจเพียงพอ",
          bootstrapExplanation:
            "สร้างจากผลงานปัจจุบันของ Creator และความร่วมมือที่เพิ่งเสร็จสิ้น ใช้เป็น fallback ของ Expected Sales จนกว่าจะมีข้อมูล ณ เวลาตัดสินใจเพียงพอ",
          effectiveScope: "ขอบเขตโมเดลที่ใช้จริง: {{scope}}",
        },
      },
    },
  },
} as const;
