const translations = (affiliate: Record<string, string>) => ({
  ecommerce: { shopDrawer: { affiliate } },
});

export const AFFILIATE_PERFORMANCE_FOLLOW_UP_TRANSLATIONS = {
  de: translations({
    performanceFollowUp: "Verkaufsnachverfolgung nach Erfüllung",
    performanceFollowUpEnabled: "Nachverfolgung für Samples mit wenigen Verkäufen aktivieren",
    performanceFollowUpHint:
      "An jedem Prüfpunkt bewertet der Agent das konkrete Sample, den Snapshot der zugeordneten Verkäufe und den aktuellen Dialog. Ein laufendes Gespräch zum selben Sample kann ohne weitere Nachricht abgeschlossen werden.",
    performanceFollowUpThreshold: "Schwellenwert für wenige zugeordnete Bestellungen",
    performanceFollowUpThresholdHint:
      "Ein Sample ist nur berechtigt, solange seine zugeordnete Bestellzahl strikt unter dieser ganzen Zahl liegt. Attribution ist keine kausale Verkaufsschätzung.",
    performanceFollowUpStages: "Nachverfolgungsprüfpunkte",
    performanceFollowUpStagesHint:
      "Konfigurieren Sie 1–3 Tagesabstände ab dem neuesten veröffentlichten Inhalt. Zwischen Prüfpunkten müssen mindestens 3 Tage liegen; jeder gilt 48 Stunden und die Folge endet innerhalb von 90 Tagen.",
    performanceFollowUpStageLabel: "Prüfpunkt {{index}} (Tage nach dem neuesten Inhalt)",
    performanceFollowUpAddStage: "Prüfpunkt hinzufügen",
    performanceFollowUpRemoveStage: "Prüfpunkt {{index}} entfernen",
    performanceFollowUpThresholdInvalid:
      "Der Schwellenwert muss eine ganze Zahl von mindestens 1 sein.",
    performanceFollowUpStagesRequired: "Aktivieren Sie die Nachverfolgung mit 1–3 Prüfpunkten.",
    performanceFollowUpDelayInvalid:
      "Prüfpunkttage müssen ganze Zahlen von 1 bis 88 sein, aufsteigend mit mindestens 3 Tagen Abstand.",
    performanceFollowUpSaved: "Verkaufsnachverfolgung nach Erfüllung gespeichert.",
    performanceFollowUpSaveFailed: "Die Verkaufsnachverfolgung konnte nicht gespeichert werden.",
  }),
  es: translations({
    performanceFollowUp: "Seguimiento de ventas tras el cumplimiento",
    performanceFollowUpEnabled: "Activar seguimiento de Samples con pocas ventas",
    performanceFollowUpHint:
      "En cada punto, el Agent revisa el Sample exacto, su snapshot de ventas atribuidas y la conversación actual. Una conversación en curso sobre el mismo Sample puede cerrarse sin enviar otro mensaje.",
    performanceFollowUpThreshold: "Umbral de pocos pedidos atribuidos",
    performanceFollowUpThresholdHint:
      "Un Sample solo es elegible mientras sus pedidos atribuidos sean estrictamente menores que este entero. La atribución no estima causalmente las ventas del Sample.",
    performanceFollowUpStages: "Puntos de seguimiento",
    performanceFollowUpStagesHint:
      "Configura 1–3 días desde el contenido publicado más reciente. Deben separarse al menos 3 días; cada punto dura 48 horas y la secuencia termina en 90 días.",
    performanceFollowUpStageLabel: "Punto {{index}} (días tras el contenido más reciente)",
    performanceFollowUpAddStage: "Añadir punto",
    performanceFollowUpRemoveStage: "Eliminar punto {{index}}",
    performanceFollowUpThresholdInvalid: "El umbral debe ser un entero de al menos 1.",
    performanceFollowUpStagesRequired: "Activa el seguimiento con 1–3 puntos.",
    performanceFollowUpDelayInvalid:
      "Los días deben ser enteros de 1 a 88, crecientes y separados al menos 3 días.",
    performanceFollowUpSaved: "Seguimiento de ventas guardado.",
    performanceFollowUpSaveFailed: "No se pudo guardar el seguimiento de ventas.",
  }),
  fr: translations({
    performanceFollowUp: "Suivi des ventes après réalisation",
    performanceFollowUpEnabled: "Activer le suivi des Samples à faibles ventes",
    performanceFollowUpHint:
      "À chaque échéance, l’Agent examine le Sample concerné, son snapshot de ventes attribuées et la conversation actuelle. Une discussion en cours sur le même Sample peut être clôturée sans nouveau message.",
    performanceFollowUpThreshold: "Seuil de commandes attribuées faibles",
    performanceFollowUpThresholdHint:
      "Un Sample est éligible uniquement si ses commandes attribuées sont strictement inférieures à cet entier. L’attribution n’est pas une estimation causale des ventes.",
    performanceFollowUpStages: "Échéances de suivi",
    performanceFollowUpStagesHint:
      "Configurez 1 à 3 décalages en jours depuis le dernier contenu publié. Ils doivent être espacés d’au moins 3 jours ; chacun reste valable 48 heures et la séquence se termine sous 90 jours.",
    performanceFollowUpStageLabel: "Échéance {{index}} (jours après le dernier contenu)",
    performanceFollowUpAddStage: "Ajouter une échéance",
    performanceFollowUpRemoveStage: "Supprimer l’échéance {{index}}",
    performanceFollowUpThresholdInvalid: "Le seuil doit être un entier supérieur ou égal à 1.",
    performanceFollowUpStagesRequired: "Activez le suivi avec 1 à 3 échéances.",
    performanceFollowUpDelayInvalid:
      "Les jours doivent être des entiers de 1 à 88, croissants et espacés d’au moins 3 jours.",
    performanceFollowUpSaved: "Suivi des ventes enregistré.",
    performanceFollowUpSaveFailed: "Impossible d’enregistrer le suivi des ventes.",
  }),
  id: translations({
    performanceFollowUp: "Tindak lanjut penjualan setelah pemenuhan",
    performanceFollowUpEnabled: "Aktifkan tindak lanjut Sample dengan penjualan rendah",
    performanceFollowUpHint:
      "Pada setiap checkpoint, Agent meninjau Sample yang tepat, snapshot penjualan teratribusi, dan percakapan saat ini. Topik aktif untuk Sample yang sama dapat diselesaikan tanpa pesan tambahan.",
    performanceFollowUpThreshold: "Ambang pesanan teratribusi rendah",
    performanceFollowUpThresholdHint:
      "Sample hanya memenuhi syarat saat jumlah pesanan teratribusi benar-benar di bawah bilangan bulat ini. Atribusi bukan estimasi penjualan kausal.",
    performanceFollowUpStages: "Checkpoint tindak lanjut",
    performanceFollowUpStagesHint:
      "Atur 1–3 jarak hari dari konten terbaru. Jarak antar-checkpoint minimal 3 hari; masing-masing berlaku 48 jam dan rangkaian berakhir dalam 90 hari.",
    performanceFollowUpStageLabel: "Checkpoint {{index}} (hari setelah konten terbaru)",
    performanceFollowUpAddStage: "Tambah checkpoint",
    performanceFollowUpRemoveStage: "Hapus checkpoint {{index}}",
    performanceFollowUpThresholdInvalid: "Ambang harus berupa bilangan bulat minimal 1.",
    performanceFollowUpStagesRequired: "Aktifkan tindak lanjut dengan 1–3 checkpoint.",
    performanceFollowUpDelayInvalid:
      "Hari checkpoint harus berupa bilangan bulat 1–88, meningkat, dengan jarak minimal 3 hari.",
    performanceFollowUpSaved: "Tindak lanjut penjualan disimpan.",
    performanceFollowUpSaveFailed: "Tindak lanjut penjualan tidak dapat disimpan.",
  }),
  it: translations({
    performanceFollowUp: "Follow-up vendite dopo l’adempimento",
    performanceFollowUpEnabled: "Attiva il follow-up per Sample con poche vendite",
    performanceFollowUpHint:
      "A ogni checkpoint, l’Agent esamina il Sample specifico, lo snapshot delle vendite attribuite e la conversazione corrente. Una discussione attiva sullo stesso Sample può essere chiusa senza un altro messaggio.",
    performanceFollowUpThreshold: "Soglia di ordini attribuiti bassi",
    performanceFollowUpThresholdHint:
      "Un Sample è idoneo solo se gli ordini attribuiti sono strettamente inferiori a questo numero intero. L’attribuzione non è una stima causale delle vendite.",
    performanceFollowUpStages: "Checkpoint di follow-up",
    performanceFollowUpStagesHint:
      "Configura 1–3 intervalli in giorni dall’ultimo contenuto pubblicato. Devono distare almeno 3 giorni; ciascuno vale 48 ore e la sequenza termina entro 90 giorni.",
    performanceFollowUpStageLabel: "Checkpoint {{index}} (giorni dopo l’ultimo contenuto)",
    performanceFollowUpAddStage: "Aggiungi checkpoint",
    performanceFollowUpRemoveStage: "Rimuovi checkpoint {{index}}",
    performanceFollowUpThresholdInvalid: "La soglia deve essere un intero di almeno 1.",
    performanceFollowUpStagesRequired: "Attiva il follow-up con 1–3 checkpoint.",
    performanceFollowUpDelayInvalid:
      "I giorni devono essere interi da 1 a 88, crescenti e distanti almeno 3 giorni.",
    performanceFollowUpSaved: "Follow-up vendite salvato.",
    performanceFollowUpSaveFailed: "Impossibile salvare il follow-up vendite.",
  }),
  th: translations({
    performanceFollowUp: "ติดตามยอดขายหลังส่งมอบงาน",
    performanceFollowUpEnabled: "เปิดการติดตาม Sample ที่มียอดขายต่ำ",
    performanceFollowUpHint:
      "ในแต่ละจุดตรวจ Agent จะตรวจ Sample ที่เกี่ยวข้อง snapshot ยอดขายที่ระบุแหล่งที่มา และบทสนทนาปัจจุบัน หากกำลังคุยเรื่อง Sample เดียวกันอยู่ สามารถจบจุดตรวจได้โดยไม่ส่งข้อความเพิ่ม",
    performanceFollowUpThreshold: "เกณฑ์คำสั่งซื้อที่ระบุแหล่งที่มาต่ำ",
    performanceFollowUpThresholdHint:
      "Sample เข้าเกณฑ์เฉพาะเมื่อจำนวนคำสั่งซื้อที่ระบุแหล่งที่มาต่ำกว่าจำนวนเต็มนี้อย่างเคร่งครัด การระบุแหล่งที่มาไม่ใช่การประเมินยอดขายเชิงเหตุผล",
    performanceFollowUpStages: "จุดตรวจการติดตาม",
    performanceFollowUpStagesHint:
      "ตั้งค่า 1–3 ช่วงวันหลังเนื้อหาล่าสุด แต่ละจุดห่างกันอย่างน้อย 3 วัน มีผล 48 ชั่วโมง และลำดับสิ้นสุดภายใน 90 วัน",
    performanceFollowUpStageLabel: "จุดตรวจ {{index}} (วันหลังเนื้อหาล่าสุด)",
    performanceFollowUpAddStage: "เพิ่มจุดตรวจ",
    performanceFollowUpRemoveStage: "ลบจุดตรวจ {{index}}",
    performanceFollowUpThresholdInvalid: "เกณฑ์ต้องเป็นจำนวนเต็มอย่างน้อย 1",
    performanceFollowUpStagesRequired: "เปิดการติดตามโดยตั้งค่า 1–3 จุดตรวจ",
    performanceFollowUpDelayInvalid:
      "วันของจุดตรวจต้องเป็นจำนวนเต็ม 1–88 เรียงจากน้อยไปมาก และห่างกันอย่างน้อย 3 วัน",
    performanceFollowUpSaved: "บันทึกการติดตามยอดขายแล้ว",
    performanceFollowUpSaveFailed: "ไม่สามารถบันทึกการติดตามยอดขายได้",
  }),
} as const;
