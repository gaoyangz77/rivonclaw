import { normalizeAppLocale, type AppLocale } from "../i18n/locale.js";

export type CsEscalationCardMessages = {
  title: string;
  escalationId: string;
  shop: string;
  conversation: string;
  buyer: string;
  order: string;
  reason: string;
  context: string;
  decisionLabel: string;
  decisionPlaceholder: string;
  resolutionLabel: string;
  unresolved: string;
  resolved: string;
  submit: string;
  submitting: string;
  unauthorized: string;
  failed: string;
  succeeded: string;
  alreadyProcessed: string;
  feedbackHistory: string;
  finalResult: string;
  olderFeedbackOmitted: string;
  stillOpen: string;
};

const MESSAGES: Record<AppLocale, CsEscalationCardMessages> = {
  en: {
    title: "CS escalation",
    escalationId: "Escalation ID",
    shop: "Shop",
    conversation: "Conversation",
    buyer: "Buyer",
    order: "Order",
    reason: "Reason",
    context: "Context",
    decisionLabel: "Decision",
    decisionPlaceholder: "Enter the action Customer Service should take",
    resolutionLabel: "Status",
    unresolved: "Unresolved",
    resolved: "Resolved",
    submit: "Submit",
    submitting: "Submitting your response…",
    unauthorized: "You are not authorized to respond to this escalation.",
    failed: "Could not submit the response. Please try again.",
    succeeded: "Response submitted successfully.",
    alreadyProcessed: "This escalation has already been processed.",
    feedbackHistory: "Feedback history",
    finalResult: "Resolution",
    olderFeedbackOmitted: "{count} earlier responses are not shown.",
    stillOpen: "This escalation is still open. You can submit another update or mark it resolved.",
  },
  zh: {
    title: "客服升级请求",
    escalationId: "升级请求 ID",
    shop: "店铺",
    conversation: "会话",
    buyer: "买家",
    order: "订单",
    reason: "原因",
    context: "上下文",
    decisionLabel: "处理意见",
    decisionPlaceholder: "请输入客服应执行的处理意见",
    resolutionLabel: "状态",
    unresolved: "未解决",
    resolved: "已解决",
    submit: "提交",
    submitting: "正在提交处理意见…",
    unauthorized: "你没有权限处理此升级请求。",
    failed: "提交失败，请重试。",
    succeeded: "处理意见已成功提交。",
    alreadyProcessed: "此升级请求已经处理。",
    feedbackHistory: "处理记录",
    finalResult: "处理结果",
    olderFeedbackOmitted: "另有 {count} 条较早记录未显示。",
    stillOpen: "此升级请求仍未解决。你可以继续提交处理意见，或将其标记为已解决。",
  },
  de: {
    title: "Kundenservice-Eskalation",
    escalationId: "Eskalations-ID",
    shop: "Shop",
    conversation: "Konversation",
    buyer: "Käufer",
    order: "Bestellung",
    reason: "Grund",
    context: "Kontext",
    decisionLabel: "Entscheidung",
    decisionPlaceholder: "Maßnahme für den Kundenservice eingeben",
    resolutionLabel: "Status",
    unresolved: "Ungelöst",
    resolved: "Gelöst",
    submit: "Senden",
    submitting: "Antwort wird gesendet…",
    unauthorized: "Sie dürfen diese Eskalation nicht bearbeiten.",
    failed: "Antwort konnte nicht gesendet werden. Bitte erneut versuchen.",
    succeeded: "Antwort erfolgreich gesendet.",
    alreadyProcessed: "Diese Eskalation wurde bereits bearbeitet.",
    feedbackHistory: "Feedbackverlauf",
    finalResult: "Ergebnis",
    olderFeedbackOmitted: "{count} frühere Antworten werden nicht angezeigt.",
    stillOpen:
      "Diese Eskalation ist noch offen. Sie können eine weitere Aktualisierung senden oder sie als gelöst markieren.",
  },
  es: {
    title: "Escalación de atención al cliente",
    escalationId: "ID de escalación",
    shop: "Tienda",
    conversation: "Conversación",
    buyer: "Comprador",
    order: "Pedido",
    reason: "Motivo",
    context: "Contexto",
    decisionLabel: "Decisión",
    decisionPlaceholder: "Indica la acción que debe realizar Atención al cliente",
    resolutionLabel: "Estado",
    unresolved: "Sin resolver",
    resolved: "Resuelto",
    submit: "Enviar",
    submitting: "Enviando la respuesta…",
    unauthorized: "No tienes permiso para responder a esta escalación.",
    failed: "No se pudo enviar la respuesta. Inténtalo de nuevo.",
    succeeded: "Respuesta enviada correctamente.",
    alreadyProcessed: "Esta escalación ya fue procesada.",
    feedbackHistory: "Historial de respuestas",
    finalResult: "Resultado",
    olderFeedbackOmitted: "No se muestran {count} respuestas anteriores.",
    stillOpen:
      "Esta escalación sigue abierta. Puedes enviar otra actualización o marcarla como resuelta.",
  },
  fr: {
    title: "Escalade du service client",
    escalationId: "ID d’escalade",
    shop: "Boutique",
    conversation: "Conversation",
    buyer: "Acheteur",
    order: "Commande",
    reason: "Motif",
    context: "Contexte",
    decisionLabel: "Décision",
    decisionPlaceholder: "Saisissez l’action à effectuer par le service client",
    resolutionLabel: "Statut",
    unresolved: "Non résolu",
    resolved: "Résolu",
    submit: "Envoyer",
    submitting: "Envoi de la réponse…",
    unauthorized: "Vous n’êtes pas autorisé à traiter cette escalade.",
    failed: "Impossible d’envoyer la réponse. Réessayez.",
    succeeded: "Réponse envoyée avec succès.",
    alreadyProcessed: "Cette escalade a déjà été traitée.",
    feedbackHistory: "Historique des réponses",
    finalResult: "Résultat",
    olderFeedbackOmitted: "{count} réponses antérieures ne sont pas affichées.",
    stillOpen:
      "Cette escalade est toujours ouverte. Vous pouvez envoyer une autre mise à jour ou la marquer comme résolue.",
  },
  id: {
    title: "Eskalasi layanan pelanggan",
    escalationId: "ID eskalasi",
    shop: "Toko",
    conversation: "Percakapan",
    buyer: "Pembeli",
    order: "Pesanan",
    reason: "Alasan",
    context: "Konteks",
    decisionLabel: "Keputusan",
    decisionPlaceholder: "Masukkan tindakan yang harus dilakukan Layanan Pelanggan",
    resolutionLabel: "Status",
    unresolved: "Belum selesai",
    resolved: "Selesai",
    submit: "Kirim",
    submitting: "Mengirim respons…",
    unauthorized: "Anda tidak berwenang menangani eskalasi ini.",
    failed: "Respons tidak dapat dikirim. Coba lagi.",
    succeeded: "Respons berhasil dikirim.",
    alreadyProcessed: "Eskalasi ini sudah diproses.",
    feedbackHistory: "Riwayat tanggapan",
    finalResult: "Hasil",
    olderFeedbackOmitted: "{count} tanggapan sebelumnya tidak ditampilkan.",
    stillOpen:
      "Eskalasi ini masih terbuka. Anda dapat mengirim pembaruan lain atau menandainya selesai.",
  },
  it: {
    title: "Escalation assistenza clienti",
    escalationId: "ID escalation",
    shop: "Negozio",
    conversation: "Conversazione",
    buyer: "Acquirente",
    order: "Ordine",
    reason: "Motivo",
    context: "Contesto",
    decisionLabel: "Decisione",
    decisionPlaceholder: "Inserisci l’azione che deve eseguire l’assistenza clienti",
    resolutionLabel: "Stato",
    unresolved: "Non risolto",
    resolved: "Risolto",
    submit: "Invia",
    submitting: "Invio della risposta…",
    unauthorized: "Non sei autorizzato a gestire questa escalation.",
    failed: "Impossibile inviare la risposta. Riprova.",
    succeeded: "Risposta inviata correttamente.",
    alreadyProcessed: "Questa escalation è già stata elaborata.",
    feedbackHistory: "Cronologia dei feedback",
    finalResult: "Esito",
    olderFeedbackOmitted: "{count} risposte precedenti non sono visualizzate.",
    stillOpen:
      "Questa escalation è ancora aperta. Puoi inviare un altro aggiornamento o contrassegnarla come risolta.",
  },
  th: {
    title: "การส่งต่อเคสฝ่ายบริการลูกค้า",
    escalationId: "รหัสการส่งต่อเคส",
    shop: "ร้านค้า",
    conversation: "การสนทนา",
    buyer: "ผู้ซื้อ",
    order: "คำสั่งซื้อ",
    reason: "เหตุผล",
    context: "บริบท",
    decisionLabel: "คำตัดสิน",
    decisionPlaceholder: "ระบุสิ่งที่ฝ่ายบริการลูกค้าควรดำเนินการ",
    resolutionLabel: "สถานะ",
    unresolved: "ยังไม่แก้ไข",
    resolved: "แก้ไขแล้ว",
    submit: "ส่ง",
    submitting: "กำลังส่งคำตอบ…",
    unauthorized: "คุณไม่มีสิทธิ์จัดการเคสนี้",
    failed: "ส่งคำตอบไม่สำเร็จ โปรดลองอีกครั้ง",
    succeeded: "ส่งคำตอบสำเร็จแล้ว",
    alreadyProcessed: "เคสนี้ได้รับการจัดการแล้ว",
    feedbackHistory: "ประวัติความคิดเห็น",
    finalResult: "ผลการดำเนินการ",
    olderFeedbackOmitted: "ไม่ได้แสดงคำตอบก่อนหน้าอีก {count} รายการ",
    stillOpen: "เคสนี้ยังเปิดอยู่ คุณสามารถส่งข้อมูลเพิ่มเติมหรือทำเครื่องหมายว่าแก้ไขแล้วได้",
  },
};

export function getCsEscalationCardMessages(locale?: string | null): CsEscalationCardMessages {
  return MESSAGES[normalizeAppLocale(locale)];
}

export function getCsEscalationCardLocales(): readonly AppLocale[] {
  return Object.keys(MESSAGES) as AppLocale[];
}
