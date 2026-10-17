function translation(copy: {
  title: string;
  historyRefreshing: string;
  historyFailed: string;
  doNotResend: string;
  attachmentTooLarge: string;
  tiktokRestrictionTitle: string;
  tiktokRestrictionReason: string;
  tiktokRestrictionAction: string;
  details: string;
}) {
  return { ecommerce: { affiliateWorkspace: { messageSendError: copy } } };
}

export const AFFILIATE_MESSAGE_SEND_ERROR_TRANSLATIONS = {
  en: translation({
    historyRefreshing: "Message submitted; refreshing conversation",
    historyFailed: "Message submitted; conversation refresh failed",
    doNotResend: "Do not resend. Refresh the conversation to check the latest messages.",
    attachmentTooLarge: "The image or attachment exceeds the upload size limit. Compress it or choose a smaller file.",
    title: "Message could not be sent",
    tiktokRestrictionTitle: "TikTok restricted this message (16030101)",
    tiktokRestrictionReason:
      "TikTok rejected the message because the seller account is in an abnormal state or the shop has not met the GMV requirement for contacting this creator. This is a TikTok shop eligibility restriction, unrelated to BD sub-account permissions.",
    tiktokRestrictionAction:
      "Check account health and Affiliate messaging eligibility in TikTok Seller Center. TikTok did not specify which condition failed or the required GMV threshold. If messaging works in Seller Center, contact TikTok support with the request ID below.",
    details: "Original error and request ID",
  }),
  zh: translation({
    historyRefreshing: "消息已提交，正在更新记录",
    historyFailed: "消息已提交，但记录刷新失败",
    doNotResend: "请勿重复发送；可刷新记录确认最新消息。",
    attachmentTooLarge: "图片或附件超过上传大小限制，请压缩或选择较小的文件后重试。",
    title: "消息发送失败",
    tiktokRestrictionTitle: "TikTok 平台限制发送（16030101）",
    tiktokRestrictionReason:
      "TikTok 拒绝了这次发送：卖家账号状态异常，或店铺未达到联系这位达人所需的 GMV 门槛。这是店铺在 TikTok 平台上的联系资格限制，与 BD 子账号权限无关。",
    tiktokRestrictionAction:
      "请在 TikTok 店铺后台检查账号健康状态和联盟消息联系资格。TikTok 未说明具体是哪项条件不满足，也未提供 GMV 门槛数值。如果原生后台可以发送，请携带下方请求编号联系 TikTok 支持排查。",
    details: "原始错误与请求编号",
  }),
  de: translation({
    historyRefreshing: "Nachricht übermittelt; Verlauf wird aktualisiert",
    historyFailed: "Nachricht übermittelt; Verlauf konnte nicht aktualisiert werden",
    doNotResend: "Nicht erneut senden. Aktualisiere den Verlauf, um die neuesten Nachrichten zu sehen.",
    attachmentTooLarge: "Das Bild oder der Anhang überschreitet das Upload-Limit. Komprimiere die Datei oder wähle eine kleinere.",
    title: "Nachricht konnte nicht gesendet werden",
    tiktokRestrictionTitle: "TikTok hat diese Nachricht eingeschränkt (16030101)",
    tiktokRestrictionReason:
      "TikTok hat die Nachricht abgelehnt: Das Verkäuferkonto hat einen ungewöhnlichen Status oder der Shop erfüllt die GMV-Anforderung für die Kontaktaufnahme mit diesem Creator nicht. Dies betrifft die TikTok-Kontaktberechtigung des Shops, nicht die Rechte des BD-Unterkontos.",
    tiktokRestrictionAction:
      "Prüfen Sie Kontostatus und Affiliate-Nachrichtenberechtigung im TikTok Seller Center. TikTok nennt weder die betroffene Bedingung noch den GMV-Grenzwert. Funktioniert das Senden dort, wenden Sie sich mit der untenstehenden Anfrage-ID an den TikTok-Support.",
    details: "Ursprünglicher Fehler und Anfrage-ID",
  }),
  es: translation({
    historyRefreshing: "Mensaje enviado; actualizando la conversación",
    historyFailed: "Mensaje enviado; no se pudo actualizar la conversación",
    doNotResend: "No lo envíes de nuevo. Actualiza la conversación para ver los últimos mensajes.",
    attachmentTooLarge: "La imagen o el archivo supera el límite de carga. Comprímelo o elige un archivo más pequeño.",
    title: "No se pudo enviar el mensaje",
    tiktokRestrictionTitle: "TikTok restringió este mensaje (16030101)",
    tiktokRestrictionReason:
      "TikTok rechazó el mensaje porque la cuenta del vendedor tiene un estado anómalo o la tienda no cumple el requisito de GMV para contactar a este creador. Es una restricción de elegibilidad de la tienda en TikTok, ajena a los permisos de la subcuenta BD.",
    tiktokRestrictionAction:
      "Revisa el estado de la cuenta y los requisitos de mensajería de afiliados en TikTok Seller Center. TikTok no especificó qué condición falló ni el umbral de GMV. Si puedes enviar desde Seller Center, contacta al soporte de TikTok con el ID de solicitud indicado abajo.",
    details: "Error original e ID de solicitud",
  }),
  fr: translation({
    historyRefreshing: "Message transmis ; actualisation de la conversation",
    historyFailed: "Message transmis ; actualisation de la conversation impossible",
    doNotResend: "Ne renvoyez pas le message. Actualisez la conversation pour voir les derniers messages.",
    attachmentTooLarge: "L’image ou la pièce jointe dépasse la limite de téléversement. Compressez-la ou choisissez un fichier plus petit.",
    title: "Impossible d’envoyer le message",
    tiktokRestrictionTitle: "TikTok a restreint ce message (16030101)",
    tiktokRestrictionReason:
      "TikTok a refusé le message : le compte vendeur présente un état anormal ou la boutique ne remplit pas le critère de GMV pour contacter ce créateur. Cette restriction concerne l’éligibilité de la boutique sur TikTok, pas les autorisations du sous-compte BD.",
    tiktokRestrictionAction:
      "Vérifiez l’état du compte et l’éligibilité à la messagerie d’affiliation dans TikTok Seller Center. TikTok ne précise ni la condition concernée ni le seuil de GMV. Si l’envoi y fonctionne, contactez l’assistance TikTok avec l’identifiant de requête ci-dessous.",
    details: "Erreur d’origine et identifiant de requête",
  }),
  id: translation({
    historyRefreshing: "Pesan terkirim; memperbarui percakapan",
    historyFailed: "Pesan terkirim; pembaruan percakapan gagal",
    doNotResend: "Jangan kirim ulang. Segarkan percakapan untuk melihat pesan terbaru.",
    attachmentTooLarge: "Gambar atau lampiran melebihi batas unggahan. Kompres atau pilih berkas yang lebih kecil.",
    title: "Pesan gagal dikirim",
    tiktokRestrictionTitle: "TikTok membatasi pesan ini (16030101)",
    tiktokRestrictionReason:
      "TikTok menolak pesan karena status akun penjual bermasalah atau toko belum memenuhi persyaratan GMV untuk menghubungi kreator ini. Ini merupakan pembatasan kelayakan toko di TikTok, bukan masalah izin subakun BD.",
    tiktokRestrictionAction:
      "Periksa kesehatan akun dan kelayakan pesan afiliasi di TikTok Seller Center. TikTok tidak menyebutkan syarat yang gagal atau ambang GMV. Jika pesan dapat dikirim dari Seller Center, hubungi dukungan TikTok dengan ID permintaan di bawah.",
    details: "Kesalahan asli dan ID permintaan",
  }),
  it: translation({
    historyRefreshing: "Messaggio inviato; aggiornamento della conversazione",
    historyFailed: "Messaggio inviato; aggiornamento della conversazione non riuscito",
    doNotResend: "Non inviare di nuovo. Aggiorna la conversazione per vedere gli ultimi messaggi.",
    attachmentTooLarge: "L’immagine o l’allegato supera il limite di caricamento. Comprimilo o scegli un file più piccolo.",
    title: "Impossibile inviare il messaggio",
    tiktokRestrictionTitle: "TikTok ha limitato questo messaggio (16030101)",
    tiktokRestrictionReason:
      "TikTok ha rifiutato il messaggio: l’account venditore presenta uno stato anomalo oppure il negozio non soddisfa il requisito GMV per contattare questo creator. È una restrizione di idoneità del negozio su TikTok, non un problema di permessi del sottoaccount BD.",
    tiktokRestrictionAction:
      "Controlla lo stato dell’account e l’idoneità ai messaggi di affiliazione in TikTok Seller Center. TikTok non specifica la condizione non soddisfatta né la soglia GMV. Se l’invio funziona da Seller Center, contatta l’assistenza TikTok con l’ID richiesta riportato sotto.",
    details: "Errore originale e ID richiesta",
  }),
  th: translation({
    historyRefreshing: "ส่งข้อความแล้ว กำลังอัปเดตประวัติ",
    historyFailed: "ส่งข้อความแล้ว แต่อัปเดตประวัติไม่สำเร็จ",
    doNotResend: "อย่าส่งซ้ำ โปรดรีเฟรชการสนทนาเพื่อตรวจสอบข้อความล่าสุด",
    attachmentTooLarge: "รูปภาพหรือไฟล์แนบมีขนาดเกินกำหนด โปรดบีบอัดหรือเลือกไฟล์ที่เล็กกว่า",
    title: "ส่งข้อความไม่สำเร็จ",
    tiktokRestrictionTitle: "TikTok จำกัดการส่งข้อความนี้ (16030101)",
    tiktokRestrictionReason:
      "TikTok ปฏิเสธข้อความเนื่องจากสถานะบัญชีผู้ขายผิดปกติ หรือร้านค้ายังไม่ผ่านเกณฑ์ GMV สำหรับติดต่อครีเอเตอร์รายนี้ นี่คือข้อจำกัดคุณสมบัติของร้านค้าบน TikTok ไม่เกี่ยวกับสิทธิ์บัญชีย่อย BD",
    tiktokRestrictionAction:
      "ตรวจสอบสถานะบัญชีและคุณสมบัติการส่งข้อความ Affiliate ใน TikTok Seller Center โดย TikTok ไม่ระบุว่าเงื่อนไขใดไม่ผ่านหรือค่าเกณฑ์ GMV หากส่งจาก Seller Center ได้ ให้ติดต่อฝ่ายสนับสนุน TikTok พร้อมรหัสคำขอด้านล่าง",
    details: "ข้อผิดพลาดต้นฉบับและรหัสคำขอ",
  }),
};
