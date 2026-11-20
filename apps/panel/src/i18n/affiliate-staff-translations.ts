/**
 * Copy for Affiliate staff logins (ADR-112): the team lead's read-only workspace
 * over their subtree and the region admin's Creator allocation. The sub-account
 * labels for the two new scopes and roles live with the rest of the sub-account
 * copy in sub-account-translations.ts.
 */

const en = {
  loadingAccess: "Checking your Affiliate access...",
  loadFailed: "Could not check your Affiliate access",
  retry: "Retry",
  notSetUpTitle: "Your Affiliate access is not set up yet",
  notSetUpDescription:
    "Your account can open Affiliate, but no team lead or region admin profile is linked to it yet. Ask your admin to set it up on the Team page.",
  unavailableTitle: "This page is not available for your role",
  unavailableDescription:
    "Team leads read the workbenches, collaborations and Creators of their team. Region admins work from the Creator list.",
  teamLeadNotice:
    "Team view. You can read everything the BDs on your team work on. Only the BD who owns a Creator, or a supervisor, can make changes.",
  regionAdminNotice:
    "Region admin view. You can assign, reassign or release the Creators of your shops. Messages, reviews and edits belong to the owning BD or a supervisor.",
  teamLeadAndRegionAdminNotice:
    "Team lead and region admin view. You can read your whole team's work, and assign, reassign or release the Creators of your shops. Other changes belong to the owning BD or a supervisor.",
  allMyTeam: "All of my team",
  creatorViewOnly:
    "You can view this Creator. Messages, reviews and edits belong to the owning BD or a supervisor.",
  escalationReadOnly:
    "Only the BD who owns this Creator, or a supervisor, can answer the Agent. You can read the question here.",
  assignBd: "Assign BD",
  changeBd: "Change BD",
  allocateTitle: "Assign a business developer",
  allocateDescription:
    "Choose the BD who will own this Creator. Only BDs whose shop access covers the Creator's shops are listed.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Choose a BD",
  allocateConfirm: "Assign",
  allocateEmpty:
    "No BD covers all of this Creator's shops yet. Ask an admin to extend a BD's shop access.",
  allocateLoadFailed: "Could not load the BDs for this Creator",
  allocated: "Creator assigned to {{name}}.",
  creatorOutsideRegionScope:
    "This Creator also works with shops outside your region, so only an admin can change who owns it.",
};

type Copy = typeof en;

const zh: Copy = {
  loadingAccess: "正在确认你的达人业务权限…",
  loadFailed: "无法确认你的达人业务权限",
  retry: "重试",
  notSetUpTitle: "你的达人业务权限尚未设置",
  notSetUpDescription:
    "你的账号可以进入达人业务，但还没有关联组长或站点管理员档案。请联系管理员在团队页面完成设置。",
  unavailableTitle: "你的角色无法打开此页面",
  unavailableDescription:
    "组长可以查看团队的工作台、合作记录和达人；站点管理员请在达人列表中操作。",
  teamLeadNotice:
    "团队视图。你可以查看团队内所有 BD 的工作内容；只有达人所属的 BD 或主管可以做出修改。",
  regionAdminNotice:
    "站点管理员视图。你可以为所辖店铺的达人分配、更换或退回公池；发消息、审核和编辑由所属 BD 或主管负责。",
  teamLeadAndRegionAdminNotice:
    "组长与站点管理员视图。你可以查看整个团队的工作，并为所辖店铺的达人分配、更换或退回公池；其他修改由所属 BD 或主管负责。",
  allMyTeam: "我的整个团队",
  creatorViewOnly: "你可以查看该达人。发消息、审核和编辑由所属 BD 或主管负责。",
  escalationReadOnly: "只有该达人所属的 BD 或主管可以回复 Agent。你可以在此查看问题。",
  assignBd: "分配 BD",
  changeBd: "更换 BD",
  allocateTitle: "分配 BD",
  allocateDescription: "选择负责该达人的 BD。仅列出店铺权限覆盖该达人所有店铺的 BD。",
  allocateLabel: "BD",
  allocatePlaceholder: "选择 BD",
  allocateConfirm: "分配",
  allocateEmpty: "目前没有 BD 覆盖该达人的全部店铺。请联系管理员扩大 BD 的店铺权限。",
  allocateLoadFailed: "无法加载该达人可分配的 BD",
  allocated: "已将该达人分配给 {{name}}。",
  creatorOutsideRegionScope: "该达人还与你所辖站点之外的店铺合作，只有管理员可以更改其归属。",
};

const de: Copy = {
  loadingAccess: "Ihr Affiliate-Zugriff wird geprüft ...",
  loadFailed: "Ihr Affiliate-Zugriff konnte nicht geprüft werden",
  retry: "Erneut versuchen",
  notSetUpTitle: "Ihr Affiliate-Zugriff ist noch nicht eingerichtet",
  notSetUpDescription:
    "Ihr Konto kann Affiliate öffnen, ihm ist aber noch kein Teamleiter- oder Regionsadmin-Profil zugeordnet. Bitten Sie Ihren Admin, es auf der Team-Seite einzurichten.",
  unavailableTitle: "Diese Seite ist für Ihre Rolle nicht verfügbar",
  unavailableDescription:
    "Teamleiter lesen die Arbeitsbereiche, Kooperationen und Creator ihres Teams. Regionsadmins arbeiten in der Creator-Liste.",
  teamLeadNotice:
    "Teamansicht. Sie können alles lesen, woran die BDs Ihres Teams arbeiten. Änderungen darf nur der BD, dem ein Creator gehört, oder ein Supervisor vornehmen.",
  regionAdminNotice:
    "Ansicht als Regionsadmin. Sie können die Creator Ihrer Shops zuweisen, neu zuweisen oder in den öffentlichen Pool zurückgeben. Nachrichten, Prüfungen und Bearbeitungen liegen beim zuständigen BD oder einem Supervisor.",
  teamLeadAndRegionAdminNotice:
    "Ansicht als Teamleiter und Regionsadmin. Sie können die Arbeit Ihres gesamten Teams lesen und die Creator Ihrer Shops zuweisen, neu zuweisen oder zurückgeben. Alle anderen Änderungen liegen beim zuständigen BD oder einem Supervisor.",
  allMyTeam: "Mein gesamtes Team",
  creatorViewOnly:
    "Sie können diesen Creator ansehen. Nachrichten, Prüfungen und Bearbeitungen liegen beim zuständigen BD oder einem Supervisor.",
  escalationReadOnly:
    "Nur der BD, dem dieser Creator gehört, oder ein Supervisor kann dem Agent antworten. Sie können die Frage hier lesen.",
  assignBd: "BD zuweisen",
  changeBd: "BD ändern",
  allocateTitle: "Business Developer zuweisen",
  allocateDescription:
    "Wählen Sie den BD, dem dieser Creator gehören soll. Es werden nur BDs angezeigt, deren Shop-Zugriff alle Shops des Creators abdeckt.",
  allocateLabel: "Business Developer",
  allocatePlaceholder: "BD auswählen",
  allocateConfirm: "Zuweisen",
  allocateEmpty:
    "Noch kein BD deckt alle Shops dieses Creators ab. Bitten Sie einen Admin, den Shop-Zugriff eines BD zu erweitern.",
  allocateLoadFailed: "Die BDs für diesen Creator konnten nicht geladen werden",
  allocated: "Creator wurde {{name}} zugewiesen.",
  creatorOutsideRegionScope:
    "Dieser Creator arbeitet auch mit Shops außerhalb Ihrer Region zusammen, daher kann nur ein Admin seine Zuordnung ändern.",
};

const es: Copy = {
  loadingAccess: "Comprobando tu acceso a Affiliate...",
  loadFailed: "No se pudo comprobar tu acceso a Affiliate",
  retry: "Reintentar",
  notSetUpTitle: "Tu acceso a Affiliate aún no está configurado",
  notSetUpDescription:
    "Tu cuenta puede abrir Affiliate, pero todavía no tiene un perfil de líder de equipo o administrador de región. Pide a tu administrador que lo configure en la página Equipo.",
  unavailableTitle: "Esta página no está disponible para tu rol",
  unavailableDescription:
    "Los líderes de equipo consultan los espacios de trabajo, las colaboraciones y los creadores de su equipo. Los administradores de región trabajan desde la lista de creadores.",
  teamLeadNotice:
    "Vista de equipo. Puedes consultar todo lo que hacen los BD de tu equipo. Solo el BD propietario de un creador, o un supervisor, puede hacer cambios.",
  regionAdminNotice:
    "Vista de administrador de región. Puedes asignar, reasignar o devolver al grupo público los creadores de tus tiendas. Los mensajes, las revisiones y las ediciones corresponden al BD propietario o a un supervisor.",
  teamLeadAndRegionAdminNotice:
    "Vista de líder de equipo y administrador de región. Puedes consultar el trabajo de todo tu equipo y asignar, reasignar o devolver al grupo público los creadores de tus tiendas. Los demás cambios corresponden al BD propietario o a un supervisor.",
  allMyTeam: "Todo mi equipo",
  creatorViewOnly:
    "Puedes ver este creador. Los mensajes, las revisiones y las ediciones corresponden al BD propietario o a un supervisor.",
  escalationReadOnly:
    "Solo el BD propietario de este creador, o un supervisor, puede responder al Agent. Aquí puedes leer la pregunta.",
  assignBd: "Asignar BD",
  changeBd: "Cambiar BD",
  allocateTitle: "Asignar un business developer",
  allocateDescription:
    "Elige el BD que será propietario de este creador. Solo aparecen los BD cuyo acceso a tiendas cubre todas las tiendas del creador.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Elige un BD",
  allocateConfirm: "Asignar",
  allocateEmpty:
    "Ningún BD cubre todavía todas las tiendas de este creador. Pide a un administrador que amplíe el acceso a tiendas de un BD.",
  allocateLoadFailed: "No se pudieron cargar los BD de este creador",
  allocated: "Creador asignado a {{name}}.",
  creatorOutsideRegionScope:
    "Este creador también trabaja con tiendas fuera de tu región, así que solo un administrador puede cambiar su propietario.",
};

const fr: Copy = {
  loadingAccess: "Vérification de votre accès Affiliate...",
  loadFailed: "Impossible de vérifier votre accès Affiliate",
  retry: "Réessayer",
  notSetUpTitle: "Votre accès Affiliate n’est pas encore configuré",
  notSetUpDescription:
    "Votre compte peut ouvrir Affiliate, mais aucun profil de chef d’équipe ou d’administrateur de région ne lui est encore associé. Demandez à votre administrateur de le configurer sur la page Équipe.",
  unavailableTitle: "Cette page n’est pas disponible pour votre rôle",
  unavailableDescription:
    "Les chefs d’équipe consultent les espaces de travail, les collaborations et les créateurs de leur équipe. Les administrateurs de région travaillent depuis la liste des créateurs.",
  teamLeadNotice:
    "Vue d’équipe. Vous pouvez consulter tout ce que font les BD de votre équipe. Seul le BD propriétaire d’un créateur, ou un superviseur, peut faire des modifications.",
  regionAdminNotice:
    "Vue d’administrateur de région. Vous pouvez attribuer, réattribuer ou remettre au pool public les créateurs de vos boutiques. Les messages, les revues et les modifications relèvent du BD propriétaire ou d’un superviseur.",
  teamLeadAndRegionAdminNotice:
    "Vue de chef d’équipe et d’administrateur de région. Vous pouvez consulter le travail de toute votre équipe, et attribuer, réattribuer ou remettre au pool public les créateurs de vos boutiques. Les autres modifications relèvent du BD propriétaire ou d’un superviseur.",
  allMyTeam: "Toute mon équipe",
  creatorViewOnly:
    "Vous pouvez consulter ce créateur. Les messages, les revues et les modifications relèvent du BD propriétaire ou d’un superviseur.",
  escalationReadOnly:
    "Seul le BD propriétaire de ce créateur, ou un superviseur, peut répondre à l’Agent. Vous pouvez lire la question ici.",
  assignBd: "Attribuer un BD",
  changeBd: "Changer de BD",
  allocateTitle: "Attribuer un business developer",
  allocateDescription:
    "Choisissez le BD qui sera propriétaire de ce créateur. Seuls les BD dont l’accès aux boutiques couvre toutes les boutiques du créateur sont listés.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Choisir un BD",
  allocateConfirm: "Attribuer",
  allocateEmpty:
    "Aucun BD ne couvre encore toutes les boutiques de ce créateur. Demandez à un administrateur d’étendre l’accès aux boutiques d’un BD.",
  allocateLoadFailed: "Impossible de charger les BD de ce créateur",
  allocated: "Créateur attribué à {{name}}.",
  creatorOutsideRegionScope:
    "Ce créateur travaille aussi avec des boutiques hors de votre région : seul un administrateur peut changer son propriétaire.",
};

const id: Copy = {
  loadingAccess: "Memeriksa akses Affiliate Anda...",
  loadFailed: "Akses Affiliate Anda tidak dapat diperiksa",
  retry: "Coba lagi",
  notSetUpTitle: "Akses Affiliate Anda belum diatur",
  notSetUpDescription:
    "Akun Anda dapat membuka Affiliate, tetapi belum ada profil ketua tim atau admin wilayah yang terhubung. Minta admin Anda mengaturnya di halaman Tim.",
  unavailableTitle: "Halaman ini tidak tersedia untuk peran Anda",
  unavailableDescription:
    "Ketua tim membaca meja kerja, kolaborasi, dan Creator timnya. Admin wilayah bekerja dari daftar Creator.",
  teamLeadNotice:
    "Tampilan tim. Anda dapat membaca semua yang dikerjakan BD di tim Anda. Hanya BD pemilik Creator, atau supervisor, yang dapat membuat perubahan.",
  regionAdminNotice:
    "Tampilan admin wilayah. Anda dapat menugaskan, menugaskan ulang, atau mengembalikan Creator dari toko Anda ke kolam publik. Pesan, peninjauan, dan pengeditan menjadi tugas BD pemilik atau supervisor.",
  teamLeadAndRegionAdminNotice:
    "Tampilan ketua tim dan admin wilayah. Anda dapat membaca pekerjaan seluruh tim dan menugaskan, menugaskan ulang, atau mengembalikan Creator dari toko Anda ke kolam publik. Perubahan lain menjadi tugas BD pemilik atau supervisor.",
  allMyTeam: "Seluruh tim saya",
  creatorViewOnly:
    "Anda dapat melihat Creator ini. Pesan, peninjauan, dan pengeditan menjadi tugas BD pemilik atau supervisor.",
  escalationReadOnly:
    "Hanya BD pemilik Creator ini, atau supervisor, yang dapat menjawab Agent. Anda dapat membaca pertanyaannya di sini.",
  assignBd: "Tugaskan BD",
  changeBd: "Ganti BD",
  allocateTitle: "Tugaskan business developer",
  allocateDescription:
    "Pilih BD yang akan memiliki Creator ini. Hanya BD yang akses tokonya mencakup semua toko Creator yang ditampilkan.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Pilih BD",
  allocateConfirm: "Tugaskan",
  allocateEmpty:
    "Belum ada BD yang mencakup semua toko Creator ini. Minta admin memperluas akses toko BD.",
  allocateLoadFailed: "BD untuk Creator ini tidak dapat dimuat",
  allocated: "Creator ditugaskan ke {{name}}.",
  creatorOutsideRegionScope:
    "Creator ini juga bekerja sama dengan toko di luar wilayah Anda, sehingga hanya admin yang dapat mengubah pemiliknya.",
};

const it: Copy = {
  loadingAccess: "Verifica dell’accesso Affiliate in corso...",
  loadFailed: "Impossibile verificare il tuo accesso Affiliate",
  retry: "Riprova",
  notSetUpTitle: "Il tuo accesso Affiliate non è ancora configurato",
  notSetUpDescription:
    "Il tuo account può aprire Affiliate, ma non ha ancora un profilo di capo team o di amministratore di area collegato. Chiedi al tuo amministratore di configurarlo nella pagina Team.",
  unavailableTitle: "Questa pagina non è disponibile per il tuo ruolo",
  unavailableDescription:
    "I capi team consultano le aree di lavoro, le collaborazioni e i creator del proprio team. Gli amministratori di area lavorano dall’elenco dei creator.",
  teamLeadNotice:
    "Vista team. Puoi consultare tutto ciò su cui lavorano i BD del tuo team. Solo il BD proprietario di un creator, o un supervisore, può apportare modifiche.",
  regionAdminNotice:
    "Vista amministratore di area. Puoi assegnare, riassegnare o restituire al pool pubblico i creator dei tuoi negozi. Messaggi, revisioni e modifiche spettano al BD proprietario o a un supervisore.",
  teamLeadAndRegionAdminNotice:
    "Vista capo team e amministratore di area. Puoi consultare il lavoro di tutto il tuo team e assegnare, riassegnare o restituire al pool pubblico i creator dei tuoi negozi. Le altre modifiche spettano al BD proprietario o a un supervisore.",
  allMyTeam: "Tutto il mio team",
  creatorViewOnly:
    "Puoi visualizzare questo creator. Messaggi, revisioni e modifiche spettano al BD proprietario o a un supervisore.",
  escalationReadOnly:
    "Solo il BD proprietario di questo creator, o un supervisore, può rispondere all’Agent. Qui puoi leggere la domanda.",
  assignBd: "Assegna BD",
  changeBd: "Cambia BD",
  allocateTitle: "Assegna un business developer",
  allocateDescription:
    "Scegli il BD che sarà proprietario di questo creator. Sono elencati solo i BD il cui accesso ai negozi copre tutti i negozi del creator.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Scegli un BD",
  allocateConfirm: "Assegna",
  allocateEmpty:
    "Nessun BD copre ancora tutti i negozi di questo creator. Chiedi a un amministratore di estendere l’accesso ai negozi di un BD.",
  allocateLoadFailed: "Impossibile caricare i BD per questo creator",
  allocated: "Creator assegnato a {{name}}.",
  creatorOutsideRegionScope:
    "Questo creator collabora anche con negozi fuori dalla tua area, quindi solo un amministratore può cambiarne il proprietario.",
};

const th: Copy = {
  loadingAccess: "กำลังตรวจสอบสิทธิ์ Affiliate ของคุณ...",
  loadFailed: "ไม่สามารถตรวจสอบสิทธิ์ Affiliate ของคุณได้",
  retry: "ลองอีกครั้ง",
  notSetUpTitle: "ยังไม่ได้ตั้งค่าสิทธิ์ Affiliate ของคุณ",
  notSetUpDescription:
    "บัญชีของคุณเปิด Affiliate ได้ แต่ยังไม่มีโปรไฟล์หัวหน้าทีมหรือผู้ดูแลภูมิภาคเชื่อมกับบัญชี โปรดให้แอดมินตั้งค่าในหน้าทีม",
  unavailableTitle: "หน้านี้ไม่พร้อมใช้งานสำหรับบทบาทของคุณ",
  unavailableDescription:
    "หัวหน้าทีมดูพื้นที่ทำงาน ความร่วมมือ และ Creator ของทีมตนเองได้ ส่วนผู้ดูแลภูมิภาคทำงานจากรายการ Creator",
  teamLeadNotice:
    "มุมมองทีม คุณดูงานทั้งหมดของ BD ในทีมได้ แต่มีเพียง BD ที่เป็นเจ้าของ Creator หรือหัวหน้างานเท่านั้นที่แก้ไขได้",
  regionAdminNotice:
    "มุมมองผู้ดูแลภูมิภาค คุณมอบหมาย เปลี่ยนผู้รับผิดชอบ หรือคืน Creator ของร้านค้าในความดูแลเข้าพูลสาธารณะได้ ส่วนการส่งข้อความ การตรวจสอบ และการแก้ไขเป็นหน้าที่ของ BD เจ้าของหรือหัวหน้างาน",
  teamLeadAndRegionAdminNotice:
    "มุมมองหัวหน้าทีมและผู้ดูแลภูมิภาค คุณดูงานของทั้งทีมได้ และมอบหมาย เปลี่ยนผู้รับผิดชอบ หรือคืน Creator ของร้านค้าในความดูแลเข้าพูลสาธารณะได้ การเปลี่ยนแปลงอื่นเป็นหน้าที่ของ BD เจ้าของหรือหัวหน้างาน",
  allMyTeam: "ทั้งทีมของฉัน",
  creatorViewOnly:
    "คุณดู Creator รายนี้ได้ ส่วนการส่งข้อความ การตรวจสอบ และการแก้ไขเป็นหน้าที่ของ BD เจ้าของหรือหัวหน้างาน",
  escalationReadOnly:
    "มีเพียง BD เจ้าของ Creator รายนี้หรือหัวหน้างานเท่านั้นที่ตอบ Agent ได้ คุณอ่านคำถามได้ที่นี่",
  assignBd: "มอบหมาย BD",
  changeBd: "เปลี่ยน BD",
  allocateTitle: "มอบหมาย Business Developer",
  allocateDescription:
    "เลือก BD ที่จะเป็นเจ้าของ Creator รายนี้ ระบบแสดงเฉพาะ BD ที่สิทธิ์เข้าถึงร้านค้าครอบคลุมทุกร้านของ Creator",
  allocateLabel: "Business Developer",
  allocatePlaceholder: "เลือก BD",
  allocateConfirm: "มอบหมาย",
  allocateEmpty:
    "ยังไม่มี BD ที่ครอบคลุมทุกร้านค้าของ Creator รายนี้ โปรดให้แอดมินขยายสิทธิ์เข้าถึงร้านค้าของ BD",
  allocateLoadFailed: "ไม่สามารถโหลด BD สำหรับ Creator รายนี้ได้",
  allocated: "มอบหมาย Creator ให้ {{name}} แล้ว",
  creatorOutsideRegionScope:
    "Creator รายนี้ยังร่วมงานกับร้านค้านอกภูมิภาคของคุณ จึงมีเพียงแอดมินเท่านั้นที่เปลี่ยนเจ้าของได้",
};

export const AFFILIATE_STAFF_TRANSLATIONS = {
  en: { ecommerce: { affiliateStaff: en } },
  zh: { ecommerce: { affiliateStaff: zh } },
  de: { ecommerce: { affiliateStaff: de } },
  es: { ecommerce: { affiliateStaff: es } },
  fr: { ecommerce: { affiliateStaff: fr } },
  id: { ecommerce: { affiliateStaff: id } },
  it: { ecommerce: { affiliateStaff: it } },
  th: { ecommerce: { affiliateStaff: th } },
} as const;
