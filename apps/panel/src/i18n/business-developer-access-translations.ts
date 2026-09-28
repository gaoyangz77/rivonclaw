/**
 * Copy for business developer (BD) access (ADR 085): the BD login panel on the
 * Affiliate Team & Channels page, and the read-only Product Knowledge notice a
 * BD-only member sees. Sub-account strings for the same change live with the
 * rest of the sub-account copy in sub-account-translations.ts.
 */

const en = {
  login: {
    tab: "Login",
    title: "Login account",
    subtitle: "How this BD signs in to TK Copilot",
    description:
      "The login is a sub-account that opens only the BD workspace: Needs Attention, Manual Workbench, Creators, History, Product Knowledge (read-only) and Analytics details.",
    statusNone: "No login",
    statusNoneDetail: "This BD cannot sign in yet.",
    statusActive: "Active",
    statusDisabled: "Disabled",
    archivedNoLoginHint: "An archived BD cannot get a login. Restore the BD first.",
    archivedHint:
      "Archiving disabled this login. Restoring the BD does not enable it again; restore the BD first, then enable the login here.",
    create: "Create login",
    createTitle: "Create a login for {{name}}",
    createHint:
      "The BD signs in with this email and password. Share the password with them directly; they cannot change the email later.",
    createSubmit: "Create login",
    email: "Sign-in email",
    emailPlaceholder: "bd@example.com",
    password: "Initial password",
    newPassword: "New password",
    passwordPlaceholder: "Set a sign-in password",
    resetPassword: "Reset password",
    resetTitle: "Reset the password of {{name}}",
    resetHint: "{{email}} is signed out on every device and must sign in with the new password.",
    resetSubmit: "Set new password",
    enable: "Enable",
    disable: "Disable",
    remove: "Remove login",
    removeTitle: "Remove login",
    removeMessage:
      "Remove the login {{email}}? {{name}} can no longer sign in. Their creators, outreach accounts and history stay, and you can create a new login later.",
    created: "Login created.",
    passwordReset: "Password reset.",
    disabledToast: "Login disabled.",
    enabledToast: "Login enabled.",
    removed: "Login removed.",
    errors: {
      archived: "This BD is archived. Restore it before giving it an active login.",
      loginExists: "This BD already has a login. Refresh to see it.",
      loginMissing: "This BD no longer has a login. Refresh to see its current state.",
    },
  },
  productKnowledgeReadOnly: "Read only",
};

type Copy = typeof en;

const zh: Copy = {
  login: {
    tab: "登录账号",
    title: "登录账号",
    subtitle: "该 BD 登录 TK匠 的方式",
    description:
      "登录账号是一个只开放 BD 工作台的子账号：待处理、人工工作台、达人、历史、产品知识（只读）和数据分析明细。",
    statusNone: "未创建登录账号",
    statusNoneDetail: "该 BD 目前还不能登录。",
    statusActive: "启用中",
    statusDisabled: "已停用",
    archivedNoLoginHint: "已归档的 BD 不能创建登录账号，请先恢复该 BD。",
    archivedHint:
      "归档时已停用该登录账号。恢复 BD 不会自动重新启用；请先恢复 BD，再在这里启用登录账号。",
    create: "创建登录账号",
    createTitle: "为 {{name}} 创建登录账号",
    createHint: "BD 使用此邮箱和密码登录。请直接把密码告知对方；登录邮箱创建后不可修改。",
    createSubmit: "创建登录账号",
    email: "登录邮箱",
    emailPlaceholder: "bd@example.com",
    password: "初始密码",
    newPassword: "新密码",
    passwordPlaceholder: "设置登录密码",
    resetPassword: "重置密码",
    resetTitle: "重置 {{name}} 的密码",
    resetHint: "{{email}} 会在所有设备上退出登录，需要使用新密码重新登录。",
    resetSubmit: "设置新密码",
    enable: "启用",
    disable: "停用",
    remove: "删除登录账号",
    removeTitle: "删除登录账号",
    removeMessage:
      "确定删除登录账号 {{email}}？{{name}} 将无法再登录。其名下的达人、联络账号和历史记录都会保留，之后可以重新创建登录账号。",
    created: "登录账号已创建。",
    passwordReset: "密码已重置。",
    disabledToast: "登录账号已停用。",
    enabledToast: "登录账号已启用。",
    removed: "登录账号已删除。",
    errors: {
      archived: "该 BD 已归档，请先恢复后再启用登录账号。",
      loginExists: "该 BD 已有登录账号，请刷新查看。",
      loginMissing: "该 BD 已没有登录账号，请刷新查看最新状态。",
    },
  },
  productKnowledgeReadOnly: "只读",
};

const de: Copy = {
  login: {
    tab: "Anmeldung",
    title: "Anmeldekonto",
    subtitle: "Wie sich dieser BD bei TK Copilot anmeldet",
    description:
      "Das Anmeldekonto ist ein Unterkonto, das nur den BD-Arbeitsbereich öffnet: Handlungsbedarf, manuelle Workbench, Creator, Verlauf, Produktwissen (nur lesen) und Analyse-Details.",
    statusNone: "Keine Anmeldung",
    statusNoneDetail: "Dieser BD kann sich noch nicht anmelden.",
    statusActive: "Aktiv",
    statusDisabled: "Deaktiviert",
    archivedNoLoginHint:
      "Ein archivierter BD kann keine Anmeldung erhalten. Stellen Sie den BD zuerst wieder her.",
    archivedHint:
      "Beim Archivieren wurde diese Anmeldung deaktiviert. Das Wiederherstellen des BD aktiviert sie nicht erneut; stellen Sie zuerst den BD wieder her und aktivieren Sie dann hier die Anmeldung.",
    create: "Anmeldung erstellen",
    createTitle: "Anmeldung für {{name}} erstellen",
    createHint:
      "Der BD meldet sich mit dieser E-Mail und diesem Passwort an. Teilen Sie das Passwort direkt mit; die E-Mail kann später nicht geändert werden.",
    createSubmit: "Anmeldung erstellen",
    email: "Anmelde-E-Mail",
    emailPlaceholder: "bd@example.com",
    password: "Erstes Passwort",
    newPassword: "Neues Passwort",
    passwordPlaceholder: "Anmeldepasswort festlegen",
    resetPassword: "Passwort zurücksetzen",
    resetTitle: "Passwort von {{name}} zurücksetzen",
    resetHint:
      "{{email}} wird auf allen Geräten abgemeldet und muss sich mit dem neuen Passwort anmelden.",
    resetSubmit: "Neues Passwort festlegen",
    enable: "Aktivieren",
    disable: "Deaktivieren",
    remove: "Anmeldung entfernen",
    removeTitle: "Anmeldung entfernen",
    removeMessage:
      "Anmeldung {{email}} entfernen? {{name}} kann sich dann nicht mehr anmelden. Creator, Outreach-Konten und Verlauf bleiben erhalten, und Sie können später eine neue Anmeldung erstellen.",
    created: "Anmeldung erstellt.",
    passwordReset: "Passwort zurückgesetzt.",
    disabledToast: "Anmeldung deaktiviert.",
    enabledToast: "Anmeldung aktiviert.",
    removed: "Anmeldung entfernt.",
    errors: {
      archived:
        "Dieser BD ist archiviert. Stellen Sie ihn wieder her, bevor Sie eine aktive Anmeldung vergeben.",
      loginExists: "Dieser BD hat bereits eine Anmeldung. Aktualisieren Sie die Ansicht.",
      loginMissing:
        "Dieser BD hat keine Anmeldung mehr. Aktualisieren Sie die Ansicht für den aktuellen Stand.",
    },
  },
  productKnowledgeReadOnly: "Nur lesen",
};

const es: Copy = {
  login: {
    tab: "Acceso",
    title: "Cuenta de acceso",
    subtitle: "Cómo inicia sesión este BD en TK Copilot",
    description:
      "La cuenta de acceso es una subcuenta que solo abre el espacio de trabajo del BD: Requiere atención, Mesa de trabajo manual, Creadores, Historial, Conocimiento del producto (solo lectura) y el detalle de Analítica.",
    statusNone: "Sin acceso",
    statusNoneDetail: "Este BD todavía no puede iniciar sesión.",
    statusActive: "Activa",
    statusDisabled: "Desactivada",
    archivedNoLoginHint:
      "Un BD archivado no puede tener una cuenta de acceso. Restaura primero el BD.",
    archivedHint:
      "Al archivar se desactivó esta cuenta de acceso. Restaurar el BD no la vuelve a activar; restaura primero el BD y luego activa aquí la cuenta.",
    create: "Crear acceso",
    createTitle: "Crear acceso para {{name}}",
    createHint:
      "El BD inicia sesión con este correo y contraseña. Comparte la contraseña directamente; el correo no se puede cambiar después.",
    createSubmit: "Crear acceso",
    email: "Correo de acceso",
    emailPlaceholder: "bd@example.com",
    password: "Contraseña inicial",
    newPassword: "Nueva contraseña",
    passwordPlaceholder: "Define una contraseña de acceso",
    resetPassword: "Restablecer contraseña",
    resetTitle: "Restablecer la contraseña de {{name}}",
    resetHint:
      "{{email}} cerrará sesión en todos los dispositivos y deberá entrar con la nueva contraseña.",
    resetSubmit: "Guardar nueva contraseña",
    enable: "Activar",
    disable: "Desactivar",
    remove: "Eliminar acceso",
    removeTitle: "Eliminar acceso",
    removeMessage:
      "¿Eliminar el acceso {{email}}? {{name}} ya no podrá iniciar sesión. Sus creadores, cuentas de contacto e historial se conservan, y podrás crear un nuevo acceso más adelante.",
    created: "Acceso creado.",
    passwordReset: "Contraseña restablecida.",
    disabledToast: "Acceso desactivado.",
    enabledToast: "Acceso activado.",
    removed: "Acceso eliminado.",
    errors: {
      archived: "Este BD está archivado. Restáuralo antes de darle un acceso activo.",
      loginExists: "Este BD ya tiene un acceso. Actualiza para verlo.",
      loginMissing: "Este BD ya no tiene acceso. Actualiza para ver su estado actual.",
    },
  },
  productKnowledgeReadOnly: "Solo lectura",
};

const fr: Copy = {
  login: {
    tab: "Connexion",
    title: "Compte de connexion",
    subtitle: "Comment ce BD se connecte à TK Copilot",
    description:
      "Le compte de connexion est un sous-compte qui n'ouvre que l'espace de travail du BD : À traiter, Atelier manuel, Créateurs, Historique, Connaissances produit (lecture seule) et le détail des Analyses.",
    statusNone: "Aucune connexion",
    statusNoneDetail: "Ce BD ne peut pas encore se connecter.",
    statusActive: "Active",
    statusDisabled: "Désactivée",
    archivedNoLoginHint:
      "Un BD archivé ne peut pas recevoir de connexion. Restaurez d'abord le BD.",
    archivedHint:
      "L'archivage a désactivé cette connexion. Restaurer le BD ne la réactive pas ; restaurez d'abord le BD, puis activez la connexion ici.",
    create: "Créer une connexion",
    createTitle: "Créer une connexion pour {{name}}",
    createHint:
      "Le BD se connecte avec cet e-mail et ce mot de passe. Communiquez-lui le mot de passe directement ; l'e-mail ne pourra plus être modifié.",
    createSubmit: "Créer la connexion",
    email: "E-mail de connexion",
    emailPlaceholder: "bd@example.com",
    password: "Mot de passe initial",
    newPassword: "Nouveau mot de passe",
    passwordPlaceholder: "Définir un mot de passe de connexion",
    resetPassword: "Réinitialiser le mot de passe",
    resetTitle: "Réinitialiser le mot de passe de {{name}}",
    resetHint:
      "{{email}} est déconnecté de tous les appareils et devra se connecter avec le nouveau mot de passe.",
    resetSubmit: "Enregistrer le mot de passe",
    enable: "Activer",
    disable: "Désactiver",
    remove: "Supprimer la connexion",
    removeTitle: "Supprimer la connexion",
    removeMessage:
      "Supprimer la connexion {{email}} ? {{name}} ne pourra plus se connecter. Ses créateurs, comptes de prospection et historique sont conservés, et vous pourrez créer une nouvelle connexion plus tard.",
    created: "Connexion créée.",
    passwordReset: "Mot de passe réinitialisé.",
    disabledToast: "Connexion désactivée.",
    enabledToast: "Connexion activée.",
    removed: "Connexion supprimée.",
    errors: {
      archived: "Ce BD est archivé. Restaurez-le avant de lui donner une connexion active.",
      loginExists: "Ce BD a déjà une connexion. Actualisez pour la voir.",
      loginMissing: "Ce BD n'a plus de connexion. Actualisez pour voir son état actuel.",
    },
  },
  productKnowledgeReadOnly: "Lecture seule",
};

const id: Copy = {
  login: {
    tab: "Login",
    title: "Akun login",
    subtitle: "Cara BD ini masuk ke TK Copilot",
    description:
      "Akun login adalah sub-akun yang hanya membuka ruang kerja BD: Perlu Perhatian, Meja Kerja Manual, Kreator, Riwayat, Pengetahuan Produk (hanya baca) dan detail Analitik.",
    statusNone: "Belum ada login",
    statusNoneDetail: "BD ini belum bisa masuk.",
    statusActive: "Aktif",
    statusDisabled: "Nonaktif",
    archivedNoLoginHint: "BD yang diarsipkan tidak bisa diberi login. Pulihkan BD terlebih dahulu.",
    archivedHint:
      "Pengarsipan menonaktifkan login ini. Memulihkan BD tidak mengaktifkannya kembali; pulihkan BD terlebih dahulu, lalu aktifkan login di sini.",
    create: "Buat login",
    createTitle: "Buat login untuk {{name}}",
    createHint:
      "BD masuk dengan email dan kata sandi ini. Bagikan kata sandi secara langsung; email tidak dapat diubah nanti.",
    createSubmit: "Buat login",
    email: "Email login",
    emailPlaceholder: "bd@example.com",
    password: "Kata sandi awal",
    newPassword: "Kata sandi baru",
    passwordPlaceholder: "Tetapkan kata sandi login",
    resetPassword: "Atur ulang kata sandi",
    resetTitle: "Atur ulang kata sandi {{name}}",
    resetHint: "{{email}} akan keluar dari semua perangkat dan harus masuk dengan kata sandi baru.",
    resetSubmit: "Simpan kata sandi baru",
    enable: "Aktifkan",
    disable: "Nonaktifkan",
    remove: "Hapus login",
    removeTitle: "Hapus login",
    removeMessage:
      "Hapus login {{email}}? {{name}} tidak bisa masuk lagi. Kreator, akun outreach, dan riwayatnya tetap disimpan, dan Anda dapat membuat login baru nanti.",
    created: "Login dibuat.",
    passwordReset: "Kata sandi diatur ulang.",
    disabledToast: "Login dinonaktifkan.",
    enabledToast: "Login diaktifkan.",
    removed: "Login dihapus.",
    errors: {
      archived: "BD ini diarsipkan. Pulihkan terlebih dahulu sebelum memberinya login aktif.",
      loginExists: "BD ini sudah memiliki login. Muat ulang untuk melihatnya.",
      loginMissing: "BD ini tidak lagi memiliki login. Muat ulang untuk melihat status terbarunya.",
    },
  },
  productKnowledgeReadOnly: "Hanya baca",
};

const it: Copy = {
  login: {
    tab: "Accesso",
    title: "Account di accesso",
    subtitle: "Come questo BD accede a TK Copilot",
    description:
      "L'account di accesso è un sottoaccount che apre solo lo spazio di lavoro del BD: Da gestire, Banco di lavoro manuale, Creator, Cronologia, Conoscenza prodotto (sola lettura) e il dettaglio di Analisi.",
    statusNone: "Nessun accesso",
    statusNoneDetail: "Questo BD non può ancora accedere.",
    statusActive: "Attivo",
    statusDisabled: "Disattivato",
    archivedNoLoginHint: "Un BD archiviato non può ricevere un accesso. Ripristina prima il BD.",
    archivedHint:
      "L'archiviazione ha disattivato questo accesso. Ripristinare il BD non lo riattiva; ripristina prima il BD, poi attiva qui l'accesso.",
    create: "Crea accesso",
    createTitle: "Crea un accesso per {{name}}",
    createHint:
      "Il BD accede con questa email e questa password. Comunica la password direttamente; l'email non potrà essere modificata in seguito.",
    createSubmit: "Crea accesso",
    email: "Email di accesso",
    emailPlaceholder: "bd@example.com",
    password: "Password iniziale",
    newPassword: "Nuova password",
    passwordPlaceholder: "Imposta una password di accesso",
    resetPassword: "Reimposta password",
    resetTitle: "Reimposta la password di {{name}}",
    resetHint:
      "{{email}} viene disconnesso da tutti i dispositivi e dovrà accedere con la nuova password.",
    resetSubmit: "Imposta nuova password",
    enable: "Attiva",
    disable: "Disattiva",
    remove: "Rimuovi accesso",
    removeTitle: "Rimuovi accesso",
    removeMessage:
      "Rimuovere l'accesso {{email}}? {{name}} non potrà più accedere. Creator, account di outreach e cronologia restano, e potrai creare un nuovo accesso in seguito.",
    created: "Accesso creato.",
    passwordReset: "Password reimpostata.",
    disabledToast: "Accesso disattivato.",
    enabledToast: "Accesso attivato.",
    removed: "Accesso rimosso.",
    errors: {
      archived: "Questo BD è archiviato. Ripristinalo prima di assegnargli un accesso attivo.",
      loginExists: "Questo BD ha già un accesso. Aggiorna per vederlo.",
      loginMissing: "Questo BD non ha più un accesso. Aggiorna per vedere lo stato attuale.",
    },
  },
  productKnowledgeReadOnly: "Sola lettura",
};

const th: Copy = {
  login: {
    tab: "การเข้าสู่ระบบ",
    title: "บัญชีเข้าสู่ระบบ",
    subtitle: "วิธีที่ BD นี้เข้าสู่ระบบ TK Copilot",
    description:
      "บัญชีเข้าสู่ระบบคือบัญชีย่อยที่เปิดได้เฉพาะพื้นที่ทำงานของ BD: ต้องดำเนินการ, โต๊ะทำงานแบบแมนนวล, ครีเอเตอร์, ประวัติ, ความรู้ผลิตภัณฑ์ (อ่านอย่างเดียว) และรายละเอียดการวิเคราะห์",
    statusNone: "ยังไม่มีบัญชีเข้าสู่ระบบ",
    statusNoneDetail: "BD นี้ยังเข้าสู่ระบบไม่ได้",
    statusActive: "ใช้งานอยู่",
    statusDisabled: "ปิดใช้งาน",
    archivedNoLoginHint: "BD ที่เก็บถาวรแล้วสร้างบัญชีเข้าสู่ระบบไม่ได้ กรุณากู้คืน BD ก่อน",
    archivedHint:
      "การเก็บถาวรได้ปิดใช้งานบัญชีเข้าสู่ระบบนี้แล้ว การกู้คืน BD จะไม่เปิดใช้งานให้อีกครั้ง กรุณากู้คืน BD ก่อน แล้วจึงเปิดใช้งานที่นี่",
    create: "สร้างบัญชีเข้าสู่ระบบ",
    createTitle: "สร้างบัญชีเข้าสู่ระบบให้ {{name}}",
    createHint: "BD จะเข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้ แจ้งรหัสผ่านให้ BD โดยตรง อีเมลจะเปลี่ยนภายหลังไม่ได้",
    createSubmit: "สร้างบัญชีเข้าสู่ระบบ",
    email: "อีเมลเข้าสู่ระบบ",
    emailPlaceholder: "bd@example.com",
    password: "รหัสผ่านเริ่มต้น",
    newPassword: "รหัสผ่านใหม่",
    passwordPlaceholder: "ตั้งรหัสผ่านเข้าสู่ระบบ",
    resetPassword: "รีเซ็ตรหัสผ่าน",
    resetTitle: "รีเซ็ตรหัสผ่านของ {{name}}",
    resetHint: "{{email}} จะออกจากระบบในทุกอุปกรณ์ และต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่",
    resetSubmit: "ตั้งรหัสผ่านใหม่",
    enable: "เปิดใช้งาน",
    disable: "ปิดใช้งาน",
    remove: "ลบบัญชีเข้าสู่ระบบ",
    removeTitle: "ลบบัญชีเข้าสู่ระบบ",
    removeMessage:
      "ลบบัญชีเข้าสู่ระบบ {{email}} หรือไม่ {{name}} จะเข้าสู่ระบบไม่ได้อีก ครีเอเตอร์ บัญชีติดต่อ และประวัติจะยังอยู่ และคุณสร้างบัญชีเข้าสู่ระบบใหม่ได้ภายหลัง",
    created: "สร้างบัญชีเข้าสู่ระบบแล้ว",
    passwordReset: "รีเซ็ตรหัสผ่านแล้ว",
    disabledToast: "ปิดใช้งานบัญชีเข้าสู่ระบบแล้ว",
    enabledToast: "เปิดใช้งานบัญชีเข้าสู่ระบบแล้ว",
    removed: "ลบบัญชีเข้าสู่ระบบแล้ว",
    errors: {
      archived: "BD นี้ถูกเก็บถาวรแล้ว กรุณากู้คืนก่อนเปิดใช้งานบัญชีเข้าสู่ระบบ",
      loginExists: "BD นี้มีบัญชีเข้าสู่ระบบอยู่แล้ว รีเฟรชเพื่อดู",
      loginMissing: "BD นี้ไม่มีบัญชีเข้าสู่ระบบแล้ว รีเฟรชเพื่อดูสถานะล่าสุด",
    },
  },
  productKnowledgeReadOnly: "อ่านอย่างเดียว",
};

function resource(copy: Copy) {
  return {
    ecommerce: {
      affiliateTeam: { login: copy.login },
      productKnowledge: { readOnly: copy.productKnowledgeReadOnly },
    },
  };
}

export const BUSINESS_DEVELOPER_ACCESS_TRANSLATIONS = {
  en: resource(en),
  zh: resource(zh),
  de: resource(de),
  es: resource(es),
  fr: resource(fr),
  id: resource(id),
  it: resource(it),
  th: resource(th),
} as const;
