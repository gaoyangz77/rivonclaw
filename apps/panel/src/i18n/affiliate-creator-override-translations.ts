/** Excel rows replace state. Manual add-protection remains an additive operation. */
const copy = {
  en: {
    hint: "Each Excel row replaces that Creator’s BD, protection and manual tags. Blank BD clears the assignment; blank protection removes protection; blank tags clear all manual tags. Blank protection notes are cleared. Creators absent from the file and system tags are unchanged.",
    bd: "Enter the BD’s internal name to assign or reassign. Blank clears the BD assignment (AI Team).",
    protection: "PROTECT enables protection; UNPROTECT or blank removes it.",
    note: "Only with PROTECT. Blank clears the previous protection note.",
    tags: "One manual tag per cell. These replace all existing manual tags; all blank clears them. Pick an existing tag from the dropdown: tags that do not exist are rejected. To use a new tag, create it in the system first, then download the template again. System tags are unchanged.",
    invalidTitle: "Invalid value",
    actionInvalid:
      "Choose PROTECT or UNPROTECT from the list, or leave the cell blank to remove protection.",
    tagInvalid:
      "Choose an existing manual tag from the list. Tags that do not exist are rejected. Create new tags in the system first, then download the template again.",
    noTags:
      "No manual tags exist yet, so this column must stay blank. Create tags in the system first, then download the template again.",
    unknownTags:
      "Unknown manual tags: {{names}}. Create them in the system first, or choose an existing tag.",
    clearBd: "Clear BD → AI Team",
    unprotect: "Not protected",
    replaceTags: "Target manual tags (empty = none)",
    unassignedEvent: "Creator BD assignment cleared",
    noBd: "No BD specified",
    summary: "{{assigned}} with a BD · {{unassigned}} without a BD",
    decision: "Create {{create}} · restore {{restore}} · no BD specified {{unassigned}}",
    timeout:
      "Batch {{batch}} / {{total}} timed out. Some rows may have been applied. Retrying the same file reapplies its target state.",
  },
  zh: {
    hint: "Excel 每行覆盖该达人的 BD、保护状态和人工标签。BD 留空会清除分配，保护留空会取消保护，标签全空会清除所有人工标签，保护备注留空会清除原备注。表格中未出现的达人及系统标签不受影响。",
    bd: "填写 BD 的内部名称以分配或改派；留空清除 BD 分配，回到 AI Team。",
    protection: "PROTECT 表示保护；UNPROTECT 或留空表示取消保护。",
    note: "仅用于 PROTECT；留空会清除原保护备注。",
    tags: "每格一个人工标签，整行标签替换现有人工标签；全空则全部清除。请从下拉列表选择已有标签，不存在的标签会被拒绝；如需新标签，请先在系统中创建，再重新下载模板。系统标签不变。",
    invalidTitle: "输入值无效",
    actionInvalid: "请从列表中选择 PROTECT 或 UNPROTECT；留空表示取消保护。",
    tagInvalid:
      "请从列表中选择已有的人工标签。不存在的标签会被拒绝；请先在系统中创建新标签，再重新下载模板。",
    noTags: "目前还没有人工标签，此列只能留空。请先在系统中创建标签，再重新下载模板。",
    unknownTags: "人工标签不存在：{{names}}。请先在系统中创建，或改选已有标签。",
    clearBd: "清除 BD → AI Team",
    unprotect: "不保护",
    replaceTags: "目标人工标签（空＝无）",
    unassignedEvent: "清除达人 BD 分配",
    noBd: "未指定 BD",
    summary: "{{assigned}} 行指定 BD · {{unassigned}} 行未指定 BD",
    decision: "创建 {{create}} 个 · 恢复 {{restore}} 个 · 未指定 BD {{unassigned}} 个",
    timeout:
      "第 {{batch}} / {{total}} 批超时，部分行可能已生效。重试同一文件会再次应用文件中的目标状态。",
  },
  de: {
    hint: "Jede Excel-Zeile ersetzt BD, Schutz und manuelle Tags dieses Creators. Leere BD-, Schutz-, Tag- oder Notizfelder löschen die jeweiligen Werte. Nicht aufgeführte Creator und System-Tags bleiben unverändert.",
    bd: "Internen BD-Namen für Zuweisung oder Wechsel eingeben. Leer entfernt die Zuweisung (AI Team).",
    protection: "PROTECT aktiviert den Schutz; UNPROTECT oder leer entfernt ihn.",
    note: "Nur mit PROTECT. Leer löscht die bisherige Schutznotiz.",
    tags: "Ein manueller Tag je Zelle. Ersetzt alle manuellen Tags; alle leer löscht sie. Wählen Sie einen vorhandenen Tag aus der Liste: Nicht vorhandene Tags werden abgelehnt. Neue Tags zuerst im System anlegen und die Vorlage erneut herunterladen. System-Tags bleiben unverändert.",
    invalidTitle: "Ungültiger Wert",
    actionInvalid:
      "Wählen Sie PROTECT oder UNPROTECT aus der Liste oder lassen Sie die Zelle leer, um den Schutz zu entfernen.",
    tagInvalid:
      "Wählen Sie einen vorhandenen manuellen Tag aus der Liste. Nicht vorhandene Tags werden abgelehnt. Legen Sie neue Tags zuerst im System an und laden Sie die Vorlage erneut herunter.",
    noTags:
      "Es gibt noch keine manuellen Tags, daher muss diese Spalte leer bleiben. Legen Sie Tags zuerst im System an und laden Sie die Vorlage erneut herunter.",
    unknownTags:
      "Unbekannte manuelle Tags: {{names}}. Legen Sie sie zuerst im System an oder wählen Sie einen vorhandenen Tag.",
    clearBd: "BD entfernen → AI Team",
    unprotect: "Nicht geschützt",
    replaceTags: "Ziel-Tags (leer = keine)",
    unassignedEvent: "BD-Zuweisung des Creators entfernt",
    noBd: "Kein BD angegeben",
    summary: "{{assigned}} mit BD · {{unassigned}} ohne BD",
    decision: "{{create}} erstellen · {{restore}} wiederherstellen · {{unassigned}} ohne BD",
    timeout:
      "Stapel {{batch}} / {{total}} hat das Zeitlimit erreicht. Einige Zeilen können bereits wirksam sein. Ein erneuter Import derselben Datei wendet den Zielzustand erneut an.",
  },
  es: {
    hint: "Cada fila de Excel reemplaza el BD, la protección y las etiquetas manuales del creador. Los campos vacíos eliminan la asignación, protección, etiquetas o nota correspondientes. No cambia los creadores ausentes ni las etiquetas del sistema.",
    bd: "Nombre interno del BD para asignar o reasignar. Vacío elimina la asignación (AI Team).",
    protection: "PROTECT activa la protección; UNPROTECT o vacío la elimina.",
    note: "Solo con PROTECT. Vacío elimina la nota anterior.",
    tags: "Una etiqueta manual por celda. Reemplazan todas las anteriores; todas vacías las eliminan. Elige una etiqueta existente de la lista: las que no existen se rechazan. Para usar una nueva, créala primero en el sistema y vuelve a descargar la plantilla. No cambia las etiquetas del sistema.",
    invalidTitle: "Valor no válido",
    actionInvalid:
      "Elige PROTECT o UNPROTECT de la lista, o deja la celda vacía para quitar la protección.",
    tagInvalid:
      "Elige una etiqueta manual existente de la lista. Las etiquetas que no existen se rechazan. Crea primero las nuevas en el sistema y vuelve a descargar la plantilla.",
    noTags:
      "Aún no hay etiquetas manuales, así que esta columna debe quedar vacía. Crea primero las etiquetas en el sistema y vuelve a descargar la plantilla.",
    unknownTags:
      "Etiquetas manuales desconocidas: {{names}}. Créalas primero en el sistema o elige una etiqueta existente.",
    clearBd: "Quitar BD → AI Team",
    unprotect: "Sin protección",
    replaceTags: "Etiquetas destino (vacío = ninguna)",
    unassignedEvent: "Asignación de BD del creador eliminada",
    noBd: "Sin BD indicado",
    summary: "{{assigned}} con BD · {{unassigned}} sin BD",
    decision: "Crear {{create}} · restaurar {{restore}} · sin BD {{unassigned}}",
    timeout:
      "El lote {{batch}} / {{total}} agotó el tiempo. Algunas filas pueden haberse aplicado. Reintentar el mismo archivo vuelve a aplicar su estado objetivo.",
  },
  fr: {
    hint: "Chaque ligne Excel remplace le BD, la protection et les tags manuels du créateur. Les champs vides effacent l’affectation, la protection, les tags ou la note correspondants. Les créateurs absents du fichier et les tags système restent inchangés.",
    bd: "Nom interne du BD pour affecter ou réaffecter. Vide supprime l’affectation (AI Team).",
    protection: "PROTECT active la protection ; UNPROTECT ou vide la supprime.",
    note: "Uniquement avec PROTECT. Vide efface la note précédente.",
    tags: "Un tag manuel par cellule. Remplace tous les tags manuels ; tous vides les efface. Choisissez un tag existant dans la liste : les tags inexistants sont refusés. Pour un nouveau tag, créez-le d’abord dans le système, puis retéléchargez le modèle. Les tags système restent inchangés.",
    invalidTitle: "Valeur non valide",
    actionInvalid:
      "Choisissez PROTECT ou UNPROTECT dans la liste, ou laissez la cellule vide pour retirer la protection.",
    tagInvalid:
      "Choisissez un tag manuel existant dans la liste. Les tags inexistants sont refusés. Créez d’abord les nouveaux tags dans le système, puis retéléchargez le modèle.",
    noTags:
      "Aucun tag manuel n’existe encore : cette colonne doit rester vide. Créez d’abord des tags dans le système, puis retéléchargez le modèle.",
    unknownTags:
      "Tags manuels inconnus : {{names}}. Créez-les d’abord dans le système ou choisissez un tag existant.",
    clearBd: "Retirer le BD → AI Team",
    unprotect: "Non protégé",
    replaceTags: "Tags cibles (vide = aucun)",
    unassignedEvent: "Affectation BD du créateur supprimée",
    noBd: "Aucun BD indiqué",
    summary: "{{assigned}} avec BD · {{unassigned}} sans BD",
    decision: "Créer {{create}} · restaurer {{restore}} · sans BD {{unassigned}}",
    timeout:
      "Le lot {{batch}} / {{total}} a expiré. Certaines lignes peuvent être appliquées. Réessayer le même fichier réapplique son état cible.",
  },
  id: {
    hint: "Setiap baris Excel mengganti BD, perlindungan, dan tag manual kreator tersebut. Kolom kosong menghapus penugasan, perlindungan, tag, atau catatan terkait. Kreator di luar file dan tag sistem tidak berubah.",
    bd: "Nama internal BD untuk menetapkan atau mengganti BD. Kosong menghapus penugasan (AI Team).",
    protection: "PROTECT mengaktifkan perlindungan; UNPROTECT atau kosong menghapusnya.",
    note: "Hanya dengan PROTECT. Kosong menghapus catatan sebelumnya.",
    tags: "Satu tag manual per sel. Mengganti semua tag manual; kosong semua menghapusnya. Pilih tag yang sudah ada dari daftar: tag yang belum ada akan ditolak. Untuk tag baru, buat dulu di sistem lalu unduh ulang template. Tag sistem tidak berubah.",
    invalidTitle: "Nilai tidak valid",
    actionInvalid:
      "Pilih PROTECT atau UNPROTECT dari daftar, atau kosongkan sel untuk menghapus perlindungan.",
    tagInvalid:
      "Pilih tag manual yang sudah ada dari daftar. Tag yang belum ada akan ditolak. Buat tag baru di sistem terlebih dahulu, lalu unduh ulang template.",
    noTags:
      "Belum ada tag manual, jadi kolom ini harus dikosongkan. Buat tag di sistem terlebih dahulu, lalu unduh ulang template.",
    unknownTags:
      "Tag manual tidak dikenal: {{names}}. Buat dulu di sistem, atau pilih tag yang sudah ada.",
    clearBd: "Hapus BD → AI Team",
    unprotect: "Tidak dilindungi",
    replaceTags: "Tag tujuan (kosong = tidak ada)",
    unassignedEvent: "Penugasan BD kreator dihapus",
    noBd: "BD tidak ditentukan",
    summary: "{{assigned}} dengan BD · {{unassigned}} tanpa BD",
    decision: "Buat {{create}} · pulihkan {{restore}} · tanpa BD {{unassigned}}",
    timeout:
      "Batch {{batch}} / {{total}} melewati batas waktu. Sebagian baris mungkin sudah diterapkan. Mengulangi file yang sama menerapkan kembali status tujuannya.",
  },
  it: {
    hint: "Ogni riga Excel sostituisce BD, protezione e tag manuali del creator. I campi vuoti cancellano assegnazione, protezione, tag o nota corrispondenti. I creator assenti dal file e i tag di sistema restano invariati.",
    bd: "Nome interno del BD per assegnare o riassegnare. Vuoto rimuove l’assegnazione (AI Team).",
    protection: "PROTECT attiva la protezione; UNPROTECT o vuoto la rimuove.",
    note: "Solo con PROTECT. Vuoto cancella la nota precedente.",
    tags: "Un tag manuale per cella. Sostituisce tutti i tag manuali; tutti vuoti li cancella. Scegli un tag esistente dall’elenco: i tag inesistenti vengono rifiutati. Per un nuovo tag, crealo prima nel sistema e scarica di nuovo il modello. I tag di sistema restano invariati.",
    invalidTitle: "Valore non valido",
    actionInvalid:
      "Scegli PROTECT o UNPROTECT dall’elenco, oppure lascia la cella vuota per rimuovere la protezione.",
    tagInvalid:
      "Scegli un tag manuale esistente dall’elenco. I tag inesistenti vengono rifiutati. Crea prima i nuovi tag nel sistema, poi scarica di nuovo il modello.",
    noTags:
      "Non esistono ancora tag manuali, quindi questa colonna deve restare vuota. Crea prima i tag nel sistema, poi scarica di nuovo il modello.",
    unknownTags:
      "Tag manuali sconosciuti: {{names}}. Creali prima nel sistema oppure scegli un tag esistente.",
    clearBd: "Rimuovi BD → AI Team",
    unprotect: "Non protetto",
    replaceTags: "Tag di destinazione (vuoto = nessuno)",
    unassignedEvent: "Assegnazione BD del creator rimossa",
    noBd: "Nessun BD indicato",
    summary: "{{assigned}} con BD · {{unassigned}} senza BD",
    decision: "Crea {{create}} · ripristina {{restore}} · senza BD {{unassigned}}",
    timeout:
      "Il lotto {{batch}} / {{total}} è scaduto. Alcune righe potrebbero essere già applicate. Riprovare lo stesso file riapplica il suo stato di destinazione.",
  },
  th: {
    hint: "แต่ละแถว Excel จะแทนที่ BD การปกป้อง และแท็กที่กำหนดเองของครีเอเตอร์ ช่องว่างจะล้างการมอบหมาย การปกป้อง แท็ก หรือหมายเหตุที่เกี่ยวข้อง ครีเอเตอร์ที่ไม่อยู่ในไฟล์และแท็กระบบจะไม่เปลี่ยน",
    bd: "ใช้ชื่อภายในของ BD เพื่อมอบหมายหรือเปลี่ยนผู้ดูแล เว้นว่างเพื่อล้างการมอบหมาย (AI Team)",
    protection: "PROTECT เปิดการปกป้อง ส่วน UNPROTECT หรือช่องว่างยกเลิกการปกป้อง",
    note: "ใช้กับ PROTECT เท่านั้น เว้นว่างเพื่อล้างหมายเหตุเดิม",
    tags: "หนึ่งแท็กต่อช่อง แทนที่แท็กที่กำหนดเองทั้งหมด หากว่างทั้งหมดจะล้างแท็ก เลือกแท็กที่มีอยู่จากรายการ แท็กที่ไม่มีอยู่จะถูกปฏิเสธ หากต้องการแท็กใหม่ ให้สร้างในระบบก่อนแล้วดาวน์โหลดเทมเพลตใหม่ แท็กระบบไม่เปลี่ยน",
    invalidTitle: "ค่าไม่ถูกต้อง",
    actionInvalid: "เลือก PROTECT หรือ UNPROTECT จากรายการ หรือเว้นว่างเพื่อยกเลิกการปกป้อง",
    tagInvalid:
      "เลือกแท็กที่กำหนดเองที่มีอยู่จากรายการ แท็กที่ไม่มีอยู่จะถูกปฏิเสธ ให้สร้างแท็กใหม่ในระบบก่อน แล้วดาวน์โหลดเทมเพลตใหม่",
    noTags: "ยังไม่มีแท็กที่กำหนดเอง คอลัมน์นี้จึงต้องเว้นว่าง ให้สร้างแท็กในระบบก่อน แล้วดาวน์โหลดเทมเพลตใหม่",
    unknownTags: "ไม่พบแท็กที่กำหนดเอง: {{names}} ให้สร้างในระบบก่อน หรือเลือกแท็กที่มีอยู่",
    clearBd: "ล้าง BD → AI Team",
    unprotect: "ไม่ปกป้อง",
    replaceTags: "แท็กเป้าหมาย (ว่าง = ไม่มี)",
    unassignedEvent: "ล้างการมอบหมาย BD ของครีเอเตอร์แล้ว",
    noBd: "ไม่ได้ระบุ BD",
    summary: "มี BD {{assigned}} · ไม่มี BD {{unassigned}}",
    decision: "สร้าง {{create}} · กู้คืน {{restore}} · ไม่มี BD {{unassigned}}",
    timeout: "ชุด {{batch}} / {{total}} หมดเวลา บางแถวอาจมีผลแล้ว การลองไฟล์เดิมอีกครั้งจะใช้สถานะเป้าหมายซ้ำ",
  },
} as const;

export function creatorOverrideCopy(locale: keyof typeof copy) {
  const c = copy[locale];
  return {
    creatorOverrideHint: c.hint,
    creatorBulkUpdateHint: c.hint,
    protectionTemplateHint: c.hint,
    templateDeveloperHint: c.bd,
    templateProtectionActionHint: c.protection,
    creatorUpdateInvalidProtectionAction: c.protection,
    templateProtectionNoteHint: c.note,
    templateManualTagHint: c.tags,
    templateInvalidValueTitle: c.invalidTitle,
    templateProtectionActionInvalid: c.actionInvalid,
    templateManualTagInvalid: c.tagInvalid,
    templateNoManualTags: c.noTags,
    creatorUpdateUnknownManualTags: c.unknownTags,
    creatorOverrideClearBd: c.clearBd,
    creatorOverrideUnprotect: c.unprotect,
    creatorOverrideTags: c.replaceTags,
    protectionPreviewOnly: c.noBd,
    protectionImportUnassigned: c.noBd,
    importProtectionOnly: c.noBd,
    confirmedAssignmentSummary: c.summary,
    importDecisionSummary: c.decision,
    protectionImportBatchTimeout: c.timeout,
  };
}

export function creatorOverrideUnassignedEvent(locale: keyof typeof copy) {
  return copy[locale].unassignedEvent;
}
