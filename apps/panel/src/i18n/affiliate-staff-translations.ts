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
    "This page needs the View business status permission. Ask your admin to enable it on the Team page. You can still work from the Creator list.",
  allMyTeam: "All of my team",
  creatorViewOnly:
    "You can view this Creator but not change it. Messages, reviews and edits need the Operate permission for this Creator, or belong to the owning BD or a supervisor.",
  escalationReadOnly:
    "Answering the Agent needs the Operate permission, or belongs to the owning BD or a supervisor. You can read the question here.",
  assignBd: "Assign BD",
  changeBd: "Change BD",
  allocateTitle: "Assign a business developer",
  allocateDescription:
    "Choose the BD who will own this Creator. Only BDs you may assign, whose shop access covers at least one of the Creator's shops, are listed.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Choose a BD",
  allocateConfirm: "Assign",
  allocateEmpty:
    "No BD you may assign covers any of this Creator's shops yet. Ask an admin to extend a BD's shop access.",
  allocateLoadFailed: "Could not load the BDs for this Creator",
  allocated: "Creator assigned to {{name}}.",
  creatorOutsideRegionScope:
    "None of this Creator's shops is in your region scope, so only an admin can change who owns it.",
  noticeCreatorsOnly:
    "Your profile can open the Creator list only. Ask your admin on the Team page for View business status, Operate business status or Allocate Creators.",
  noticeView:
    "You can view the work of the teams and shops you cover. Changes are not enabled for your profile.",
  noticeViewOperate:
    "You can view and operate the work of the teams and shops you cover: review samples, message Creators and decide proposals.",
  noticeAllocate:
    "You can assign, reassign or release the Creators you cover. Viewing and operating their work is not enabled for your profile.",
  noticeViewAllocate:
    "You can view the work of the teams and shops you cover, and assign, reassign or release their Creators. Other changes are not enabled for your profile.",
  noticeViewOperateAllocate:
    "You can view and operate the work of the teams and shops you cover, and assign, reassign or release their Creators.",
  allocateUncoveredWarning:
    "This Creator also works with {{shops}}. The new BD will not see the samples and messages of those shops.",
  ownerChanged:
    "Someone else has changed this Creator's BD. The latest owner is shown now; check it and try again.",
  targetOutsideRegionOverlap:
    "The BD must cover at least one of this Creator's shops that is in your region scope.",
  creatorOutsideTeamLeadScope:
    "This Creator is outside your team: it is owned by a BD outside your team, or it is public without a shop of your team.",
  targetOutsideTeamLeadScope:
    "The BD must belong to your team and cover at least one of this Creator's shops.",
  operatorOutsideScope:
    "This work is outside the Creators and shops your Operate permission reaches.",
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
    "此页面需要“查看业务状态”权限。请联系管理员在团队页面开启；你仍可在达人列表中工作。",
  allMyTeam: "我的整个团队",
  creatorViewOnly:
    "你可以查看该达人，但不能修改。发消息、审核和编辑需要对该达人的“操作业务状态”权限，或由所属 BD 或主管负责。",
  escalationReadOnly:
    "回复 Agent 需要“操作业务状态”权限，或由所属 BD 或主管负责。你可以在此查看问题。",
  assignBd: "分配 BD",
  changeBd: "更换 BD",
  allocateTitle: "分配 BD",
  allocateDescription:
    "选择负责该达人的 BD。仅列出你可以分配、且店铺权限覆盖该达人至少一个店铺的 BD。",
  allocateLabel: "BD",
  allocatePlaceholder: "选择 BD",
  allocateConfirm: "分配",
  allocateEmpty: "目前没有你可分配的 BD 覆盖该达人的任何店铺。请联系管理员扩大 BD 的店铺权限。",
  allocateLoadFailed: "无法加载该达人可分配的 BD",
  allocated: "已将该达人分配给 {{name}}。",
  creatorOutsideRegionScope: "该达人的店铺都不在你所辖站点内，只有管理员可以更改其归属。",
  noticeCreatorsOnly:
    "你的档案目前只能打开达人列表。请联系管理员在团队页面开启“查看业务状态”“操作业务状态”或“分配达人”。",
  noticeView: "你可以查看所辖团队和店铺的业务状态；你的档案未开启修改权限。",
  noticeViewOperate: "你可以查看并操作所辖团队和店铺的业务：审核申样、给达人发消息、处理提案等。",
  noticeAllocate: "你可以为所辖达人分配、更换 BD 或退回公池；你的档案未开启查看和操作业务状态。",
  noticeViewAllocate:
    "你可以查看所辖团队和店铺的业务状态，并为所辖达人分配、更换 BD 或退回公池；其他修改未开启。",
  noticeViewOperateAllocate:
    "你可以查看并操作所辖团队和店铺的业务，并为所辖达人分配、更换 BD 或退回公池。",
  allocateUncoveredWarning: "该达人还和 {{shops}} 合作，新 BD 看不到这些店铺的申样和消息",
  ownerChanged: "其他人已更改该达人的 BD，已为你显示最新归属，请确认后重试。",
  targetOutsideRegionOverlap: "该 BD 必须覆盖该达人在你所辖站点内的至少一个店铺。",
  creatorOutsideTeamLeadScope:
    "该达人不在你的团队范围内：由团队外的 BD 负责，或是没有你团队店铺的公池达人。",
  targetOutsideTeamLeadScope: "该 BD 必须属于你的团队，并覆盖该达人的至少一个店铺。",
  operatorOutsideScope: "该工作不在你的“操作业务状态”权限所覆盖的达人和店铺范围内。",
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
    "Diese Seite erfordert die Berechtigung „Geschäftsstatus ansehen“. Bitten Sie Ihren Admin, sie auf der Team-Seite zu aktivieren. In der Creator-Liste können Sie weiterhin arbeiten.",
  allMyTeam: "Mein gesamtes Team",
  creatorViewOnly:
    "Sie können diesen Creator ansehen, aber nicht ändern. Nachrichten, Prüfungen und Bearbeitungen erfordern die Berechtigung „Geschäftsstatus bearbeiten“ für diesen Creator oder liegen beim zuständigen BD oder einem Supervisor.",
  escalationReadOnly:
    "Dem Agent zu antworten erfordert die Berechtigung „Geschäftsstatus bearbeiten“ oder liegt beim zuständigen BD oder einem Supervisor. Sie können die Frage hier lesen.",
  assignBd: "BD zuweisen",
  changeBd: "BD ändern",
  allocateTitle: "Business Developer zuweisen",
  allocateDescription:
    "Wählen Sie den BD, dem dieser Creator gehören soll. Es werden nur BDs angezeigt, die Sie zuweisen dürfen und deren Shop-Zugriff mindestens einen Shop des Creators abdeckt.",
  allocateLabel: "Business Developer",
  allocatePlaceholder: "BD auswählen",
  allocateConfirm: "Zuweisen",
  allocateEmpty:
    "Kein BD, den Sie zuweisen dürfen, deckt bisher einen Shop dieses Creators ab. Bitten Sie einen Admin, den Shop-Zugriff eines BD zu erweitern.",
  allocateLoadFailed: "Die BDs für diesen Creator konnten nicht geladen werden",
  allocated: "Creator wurde {{name}} zugewiesen.",
  creatorOutsideRegionScope:
    "Keiner der Shops dieses Creators liegt in Ihrer Region, daher kann nur ein Admin seine Zuordnung ändern.",
  noticeCreatorsOnly:
    "Ihr Profil kann nur die Creator-Liste öffnen. Bitten Sie Ihren Admin auf der Team-Seite um „Geschäftsstatus ansehen“, „Geschäftsstatus bearbeiten“ oder „Creator zuweisen“.",
  noticeView:
    "Sie können die Arbeit der Teams und Shops ansehen, die Sie abdecken. Änderungen sind für Ihr Profil nicht aktiviert.",
  noticeViewOperate:
    "Sie können die Arbeit der Teams und Shops, die Sie abdecken, ansehen und bearbeiten: Sample-Anfragen prüfen, Nachrichten an Creator senden und Vorschläge entscheiden.",
  noticeAllocate:
    "Sie können die Creator, die Sie abdecken, zuweisen, neu zuweisen oder in den öffentlichen Pool zurückgeben. Ansehen und Bearbeiten ihrer Arbeit ist für Ihr Profil nicht aktiviert.",
  noticeViewAllocate:
    "Sie können die Arbeit der Teams und Shops, die Sie abdecken, ansehen und deren Creator zuweisen, neu zuweisen oder zurückgeben. Andere Änderungen sind für Ihr Profil nicht aktiviert.",
  noticeViewOperateAllocate:
    "Sie können die Arbeit der Teams und Shops, die Sie abdecken, ansehen und bearbeiten sowie deren Creator zuweisen, neu zuweisen oder zurückgeben.",
  allocateUncoveredWarning:
    "Dieser Creator arbeitet auch mit {{shops}} zusammen. Der neue BD sieht die Sample-Anfragen und Nachrichten dieser Shops nicht.",
  ownerChanged:
    "Jemand anderes hat den BD dieses Creators geändert. Der aktuelle Besitzer wird jetzt angezeigt; bitte prüfen und erneut versuchen.",
  targetOutsideRegionOverlap:
    "Der BD muss mindestens einen Shop dieses Creators abdecken, der in Ihrer Region liegt.",
  creatorOutsideTeamLeadScope:
    "Dieser Creator gehört nicht zu Ihrem Team: Er gehört einem BD außerhalb Ihres Teams oder ist öffentlich und hat keinen Shop Ihres Teams.",
  targetOutsideTeamLeadScope:
    "Der BD muss zu Ihrem Team gehören und mindestens einen Shop dieses Creators abdecken.",
  operatorOutsideScope:
    "Diese Arbeit liegt außerhalb der Creator und Shops, die Ihre Berechtigung „Geschäftsstatus bearbeiten“ abdeckt.",
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
    "Esta página requiere el permiso «Ver el estado del negocio». Pide a tu administrador que lo active en la página Equipo. Puedes seguir trabajando desde la lista de creadores.",
  allMyTeam: "Todo mi equipo",
  creatorViewOnly:
    "Puedes ver este creador, pero no cambiarlo. Los mensajes, las revisiones y las ediciones requieren el permiso «Operar el estado del negocio» para este creador, o corresponden al BD propietario o a un supervisor.",
  escalationReadOnly:
    "Responder al Agent requiere el permiso «Operar el estado del negocio», o corresponde al BD propietario o a un supervisor. Aquí puedes leer la pregunta.",
  assignBd: "Asignar BD",
  changeBd: "Cambiar BD",
  allocateTitle: "Asignar un business developer",
  allocateDescription:
    "Elige el BD que será propietario de este creador. Solo aparecen los BD que puedes asignar y cuyo acceso a tiendas cubre al menos una tienda del creador.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Elige un BD",
  allocateConfirm: "Asignar",
  allocateEmpty:
    "Ningún BD que puedas asignar cubre todavía alguna tienda de este creador. Pide a un administrador que amplíe el acceso a tiendas de un BD.",
  allocateLoadFailed: "No se pudieron cargar los BD de este creador",
  allocated: "Creador asignado a {{name}}.",
  creatorOutsideRegionScope:
    "Ninguna de las tiendas de este creador está en tu región, así que solo un administrador puede cambiar su propietario.",
  noticeCreatorsOnly:
    "Tu perfil solo puede abrir la lista de creadores. Pide a tu administrador, en la página Equipo, «Ver el estado del negocio», «Operar el estado del negocio» o «Asignar creadores».",
  noticeView:
    "Puedes ver el trabajo de los equipos y tiendas que cubres. Los cambios no están activados para tu perfil.",
  noticeViewOperate:
    "Puedes ver y operar el trabajo de los equipos y tiendas que cubres: revisar muestras, enviar mensajes a creadores y decidir propuestas.",
  noticeAllocate:
    "Puedes asignar, reasignar o devolver al grupo público los creadores que cubres. Ver y operar su trabajo no está activado para tu perfil.",
  noticeViewAllocate:
    "Puedes ver el trabajo de los equipos y tiendas que cubres, y asignar, reasignar o devolver sus creadores. Los demás cambios no están activados para tu perfil.",
  noticeViewOperateAllocate:
    "Puedes ver y operar el trabajo de los equipos y tiendas que cubres, y asignar, reasignar o devolver sus creadores.",
  allocateUncoveredWarning:
    "Este creador también trabaja con {{shops}}. El nuevo BD no verá las solicitudes de muestras ni los mensajes de esas tiendas.",
  ownerChanged:
    "Otra persona ha cambiado el BD de este creador. Ahora se muestra el propietario actual; compruébalo e inténtalo de nuevo.",
  targetOutsideRegionOverlap:
    "El BD debe cubrir al menos una de las tiendas de este creador que están en tu región.",
  creatorOutsideTeamLeadScope:
    "Este creador queda fuera de tu equipo: pertenece a un BD ajeno a tu equipo o es público y no tiene ninguna tienda de tu equipo.",
  targetOutsideTeamLeadScope:
    "El BD debe pertenecer a tu equipo y cubrir al menos una tienda de este creador.",
  operatorOutsideScope:
    "Este trabajo queda fuera de los creadores y tiendas que cubre tu permiso «Operar el estado del negocio».",
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
    "Cette page nécessite l’autorisation « Consulter l’état de l’activité ». Demandez à votre administrateur de l’activer sur la page Équipe. Vous pouvez toujours travailler depuis la liste des créateurs.",
  allMyTeam: "Toute mon équipe",
  creatorViewOnly:
    "Vous pouvez consulter ce créateur, mais pas le modifier. Les messages, les revues et les modifications nécessitent l’autorisation « Gérer l’état de l’activité » pour ce créateur, ou relèvent du BD propriétaire ou d’un superviseur.",
  escalationReadOnly:
    "Répondre à l’Agent nécessite l’autorisation « Gérer l’état de l’activité », ou relève du BD propriétaire ou d’un superviseur. Vous pouvez lire la question ici.",
  assignBd: "Attribuer un BD",
  changeBd: "Changer de BD",
  allocateTitle: "Attribuer un business developer",
  allocateDescription:
    "Choisissez le BD qui sera propriétaire de ce créateur. Seuls les BD que vous pouvez attribuer et dont l’accès aux boutiques couvre au moins une boutique du créateur sont listés.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Choisir un BD",
  allocateConfirm: "Attribuer",
  allocateEmpty:
    "Aucun BD que vous pouvez attribuer ne couvre encore une boutique de ce créateur. Demandez à un administrateur d’étendre l’accès aux boutiques d’un BD.",
  allocateLoadFailed: "Impossible de charger les BD de ce créateur",
  allocated: "Créateur attribué à {{name}}.",
  creatorOutsideRegionScope:
    "Aucune boutique de ce créateur n’est dans votre région : seul un administrateur peut changer son propriétaire.",
  noticeCreatorsOnly:
    "Votre profil ne peut ouvrir que la liste des créateurs. Demandez à votre administrateur, sur la page Équipe, « Consulter l’état de l’activité », « Gérer l’état de l’activité » ou « Attribuer des créateurs ».",
  noticeView:
    "Vous pouvez consulter le travail des équipes et des boutiques que vous couvrez. Les modifications ne sont pas activées pour votre profil.",
  noticeViewOperate:
    "Vous pouvez consulter et gérer le travail des équipes et des boutiques que vous couvrez : examiner les échantillons, écrire aux créateurs et décider des propositions.",
  noticeAllocate:
    "Vous pouvez attribuer, réattribuer ou remettre au pool public les créateurs que vous couvrez. Consulter et gérer leur travail n’est pas activé pour votre profil.",
  noticeViewAllocate:
    "Vous pouvez consulter le travail des équipes et des boutiques que vous couvrez, et attribuer, réattribuer ou remettre au pool public leurs créateurs. Les autres modifications ne sont pas activées pour votre profil.",
  noticeViewOperateAllocate:
    "Vous pouvez consulter et gérer le travail des équipes et des boutiques que vous couvrez, et attribuer, réattribuer ou remettre au pool public leurs créateurs.",
  allocateUncoveredWarning:
    "Ce créateur travaille aussi avec {{shops}}. Le nouveau BD ne verra pas les demandes d’échantillons ni les messages de ces boutiques.",
  ownerChanged:
    "Quelqu’un d’autre a changé le BD de ce créateur. Le propriétaire actuel est affiché ; vérifiez puis réessayez.",
  targetOutsideRegionOverlap:
    "Le BD doit couvrir au moins une des boutiques de ce créateur situées dans votre région.",
  creatorOutsideTeamLeadScope:
    "Ce créateur est hors de votre équipe : il appartient à un BD extérieur à votre équipe, ou il est public sans boutique de votre équipe.",
  targetOutsideTeamLeadScope:
    "Le BD doit faire partie de votre équipe et couvrir au moins une boutique de ce créateur.",
  operatorOutsideScope:
    "Ce travail est hors des créateurs et boutiques couverts par votre autorisation « Gérer l’état de l’activité ».",
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
    "Halaman ini memerlukan izin “Lihat status bisnis”. Minta admin Anda mengaktifkannya di halaman Tim. Anda tetap dapat bekerja dari daftar Creator.",
  allMyTeam: "Seluruh tim saya",
  creatorViewOnly:
    "Anda dapat melihat Creator ini, tetapi tidak dapat mengubahnya. Pesan, peninjauan, dan pengeditan memerlukan izin “Operasikan status bisnis” untuk Creator ini, atau menjadi tugas BD pemilik atau supervisor.",
  escalationReadOnly:
    "Menjawab Agent memerlukan izin “Operasikan status bisnis”, atau menjadi tugas BD pemilik atau supervisor. Anda dapat membaca pertanyaannya di sini.",
  assignBd: "Tugaskan BD",
  changeBd: "Ganti BD",
  allocateTitle: "Tugaskan business developer",
  allocateDescription:
    "Pilih BD yang akan memiliki Creator ini. Hanya BD yang boleh Anda tugaskan dan yang akses tokonya mencakup minimal satu toko Creator yang ditampilkan.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Pilih BD",
  allocateConfirm: "Tugaskan",
  allocateEmpty:
    "Belum ada BD yang boleh Anda tugaskan yang mencakup toko Creator ini. Minta admin memperluas akses toko BD.",
  allocateLoadFailed: "BD untuk Creator ini tidak dapat dimuat",
  allocated: "Creator ditugaskan ke {{name}}.",
  creatorOutsideRegionScope:
    "Tidak ada toko Creator ini yang berada di wilayah Anda, sehingga hanya admin yang dapat mengubah pemiliknya.",
  noticeCreatorsOnly:
    "Profil Anda hanya dapat membuka daftar Creator. Minta admin Anda di halaman Tim untuk “Lihat status bisnis”, “Operasikan status bisnis”, atau “Alokasikan Creator”.",
  noticeView:
    "Anda dapat melihat pekerjaan tim dan toko yang Anda cakup. Perubahan belum diaktifkan untuk profil Anda.",
  noticeViewOperate:
    "Anda dapat melihat dan mengoperasikan pekerjaan tim dan toko yang Anda cakup: meninjau sampel, mengirim pesan ke Creator, dan memutuskan proposal.",
  noticeAllocate:
    "Anda dapat menugaskan, menugaskan ulang, atau mengembalikan Creator yang Anda cakup ke kolam publik. Melihat dan mengoperasikan pekerjaannya belum diaktifkan untuk profil Anda.",
  noticeViewAllocate:
    "Anda dapat melihat pekerjaan tim dan toko yang Anda cakup, serta menugaskan, menugaskan ulang, atau mengembalikan Creator-nya. Perubahan lain belum diaktifkan untuk profil Anda.",
  noticeViewOperateAllocate:
    "Anda dapat melihat dan mengoperasikan pekerjaan tim dan toko yang Anda cakup, serta menugaskan, menugaskan ulang, atau mengembalikan Creator-nya.",
  allocateUncoveredWarning:
    "Creator ini juga bekerja sama dengan {{shops}}. BD baru tidak akan melihat permintaan sampel dan pesan dari toko tersebut.",
  ownerChanged:
    "Orang lain telah mengubah BD Creator ini. Pemilik terbaru ditampilkan sekarang; periksa lalu coba lagi.",
  targetOutsideRegionOverlap:
    "BD harus mencakup minimal satu toko Creator ini yang berada di wilayah Anda.",
  creatorOutsideTeamLeadScope:
    "Creator ini berada di luar tim Anda: dimiliki BD di luar tim Anda, atau publik tanpa toko dari tim Anda.",
  targetOutsideTeamLeadScope:
    "BD harus anggota tim Anda dan mencakup minimal satu toko Creator ini.",
  operatorOutsideScope:
    "Pekerjaan ini berada di luar Creator dan toko yang dicakup izin “Operasikan status bisnis” Anda.",
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
    "Questa pagina richiede il permesso «Visualizzare lo stato dell’attività». Chiedi al tuo amministratore di attivarlo nella pagina Team. Puoi comunque lavorare dall’elenco dei creator.",
  allMyTeam: "Tutto il mio team",
  creatorViewOnly:
    "Puoi visualizzare questo creator ma non modificarlo. Messaggi, revisioni e modifiche richiedono il permesso «Gestire lo stato dell’attività» per questo creator, oppure spettano al BD proprietario o a un supervisore.",
  escalationReadOnly:
    "Rispondere all’Agent richiede il permesso «Gestire lo stato dell’attività», oppure spetta al BD proprietario o a un supervisore. Qui puoi leggere la domanda.",
  assignBd: "Assegna BD",
  changeBd: "Cambia BD",
  allocateTitle: "Assegna un business developer",
  allocateDescription:
    "Scegli il BD che sarà proprietario di questo creator. Sono elencati solo i BD che puoi assegnare e il cui accesso ai negozi copre almeno un negozio del creator.",
  allocateLabel: "Business developer",
  allocatePlaceholder: "Scegli un BD",
  allocateConfirm: "Assegna",
  allocateEmpty:
    "Nessun BD che puoi assegnare copre ancora un negozio di questo creator. Chiedi a un amministratore di estendere l’accesso ai negozi di un BD.",
  allocateLoadFailed: "Impossibile caricare i BD per questo creator",
  allocated: "Creator assegnato a {{name}}.",
  creatorOutsideRegionScope:
    "Nessun negozio di questo creator è nella tua area, quindi solo un amministratore può cambiarne il proprietario.",
  noticeCreatorsOnly:
    "Il tuo profilo può aprire solo l’elenco dei creator. Chiedi al tuo amministratore, nella pagina Team, «Visualizzare lo stato dell’attività», «Gestire lo stato dell’attività» o «Assegnare i creator».",
  noticeView:
    "Puoi visualizzare il lavoro dei team e dei negozi che copri. Le modifiche non sono attivate per il tuo profilo.",
  noticeViewOperate:
    "Puoi visualizzare e gestire il lavoro dei team e dei negozi che copri: rivedere i campioni, scrivere ai creator e decidere le proposte.",
  noticeAllocate:
    "Puoi assegnare, riassegnare o restituire al pool pubblico i creator che copri. Visualizzare e gestire il loro lavoro non è attivato per il tuo profilo.",
  noticeViewAllocate:
    "Puoi visualizzare il lavoro dei team e dei negozi che copri, e assegnare, riassegnare o restituire i loro creator. Le altre modifiche non sono attivate per il tuo profilo.",
  noticeViewOperateAllocate:
    "Puoi visualizzare e gestire il lavoro dei team e dei negozi che copri, e assegnare, riassegnare o restituire i loro creator.",
  allocateUncoveredWarning:
    "Questo creator collabora anche con {{shops}}. Il nuovo BD non vedrà le richieste di campioni e i messaggi di quei negozi.",
  ownerChanged:
    "Qualcun altro ha cambiato il BD di questo creator. Ora è mostrato il proprietario attuale; controlla e riprova.",
  targetOutsideRegionOverlap:
    "Il BD deve coprire almeno uno dei negozi di questo creator che sono nella tua area.",
  creatorOutsideTeamLeadScope:
    "Questo creator è fuori dal tuo team: appartiene a un BD esterno al tuo team, oppure è pubblico senza negozi del tuo team.",
  targetOutsideTeamLeadScope:
    "Il BD deve appartenere al tuo team e coprire almeno un negozio di questo creator.",
  operatorOutsideScope:
    "Questo lavoro è fuori dai creator e dai negozi coperti dal tuo permesso «Gestire lo stato dell’attività».",
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
    "หน้านี้ต้องมีสิทธิ์ “ดูสถานะธุรกิจ” โปรดให้แอดมินเปิดให้ในหน้าทีม คุณยังทำงานจากรายการ Creator ได้",
  allMyTeam: "ทั้งทีมของฉัน",
  creatorViewOnly:
    "คุณดู Creator รายนี้ได้แต่แก้ไขไม่ได้ การส่งข้อความ การตรวจสอบ และการแก้ไขต้องมีสิทธิ์ “ดำเนินการสถานะธุรกิจ” สำหรับ Creator รายนี้ หรือเป็นหน้าที่ของ BD เจ้าของหรือหัวหน้างาน",
  escalationReadOnly:
    "การตอบ Agent ต้องมีสิทธิ์ “ดำเนินการสถานะธุรกิจ” หรือเป็นหน้าที่ของ BD เจ้าของหรือหัวหน้างาน คุณอ่านคำถามได้ที่นี่",
  assignBd: "มอบหมาย BD",
  changeBd: "เปลี่ยน BD",
  allocateTitle: "มอบหมาย Business Developer",
  allocateDescription:
    "เลือก BD ที่จะเป็นเจ้าของ Creator รายนี้ ระบบแสดงเฉพาะ BD ที่คุณมอบหมายได้และมีสิทธิ์เข้าถึงร้านค้าครอบคลุมอย่างน้อยหนึ่งร้านของ Creator",
  allocateLabel: "Business Developer",
  allocatePlaceholder: "เลือก BD",
  allocateConfirm: "มอบหมาย",
  allocateEmpty:
    "ยังไม่มี BD ที่คุณมอบหมายได้ซึ่งครอบคลุมร้านค้าใดของ Creator รายนี้ โปรดให้แอดมินขยายสิทธิ์เข้าถึงร้านค้าของ BD",
  allocateLoadFailed: "ไม่สามารถโหลด BD สำหรับ Creator รายนี้ได้",
  allocated: "มอบหมาย Creator ให้ {{name}} แล้ว",
  creatorOutsideRegionScope:
    "ไม่มีร้านค้าของ Creator รายนี้อยู่ในภูมิภาคของคุณ จึงมีเพียงแอดมินเท่านั้นที่เปลี่ยนเจ้าของได้",
  noticeCreatorsOnly:
    "โปรไฟล์ของคุณเปิดได้เฉพาะรายการ Creator โปรดขอแอดมินในหน้าทีมให้เปิดสิทธิ์ “ดูสถานะธุรกิจ” “ดำเนินการสถานะธุรกิจ” หรือ “จัดสรร Creator”",
  noticeView: "คุณดูงานของทีมและร้านค้าที่อยู่ในความดูแลได้ โปรไฟล์ของคุณยังไม่เปิดสิทธิ์การแก้ไข",
  noticeViewOperate:
    "คุณดูและดำเนินการงานของทีมและร้านค้าที่อยู่ในความดูแลได้ เช่น ตรวจคำขอตัวอย่าง ส่งข้อความหา Creator และตัดสินข้อเสนอ",
  noticeAllocate:
    "คุณมอบหมาย เปลี่ยนผู้รับผิดชอบ หรือคืน Creator ที่อยู่ในความดูแลเข้าพูลสาธารณะได้ โปรไฟล์ของคุณยังไม่เปิดสิทธิ์ดูและดำเนินการงานของ Creator เหล่านั้น",
  noticeViewAllocate:
    "คุณดูงานของทีมและร้านค้าที่อยู่ในความดูแลได้ และมอบหมาย เปลี่ยนผู้รับผิดชอบ หรือคืน Creator ของทีมและร้านค้าเหล่านั้นได้ การเปลี่ยนแปลงอื่นยังไม่เปิดสิทธิ์",
  noticeViewOperateAllocate:
    "คุณดูและดำเนินการงานของทีมและร้านค้าที่อยู่ในความดูแลได้ รวมถึงมอบหมาย เปลี่ยนผู้รับผิดชอบ หรือคืน Creator ของทีมและร้านค้าเหล่านั้นได้",
  allocateUncoveredWarning:
    "Creator รายนี้ยังร่วมงานกับ {{shops}} ด้วย BD คนใหม่จะไม่เห็นคำขอตัวอย่างและข้อความของร้านค้าเหล่านั้น",
  ownerChanged: "มีผู้อื่นเปลี่ยน BD ของ Creator รายนี้แล้ว ตอนนี้แสดงเจ้าของล่าสุด โปรดตรวจสอบแล้วลองอีกครั้ง",
  targetOutsideRegionOverlap: "BD ต้องครอบคลุมอย่างน้อยหนึ่งร้านของ Creator รายนี้ที่อยู่ในภูมิภาคของคุณ",
  creatorOutsideTeamLeadScope:
    "Creator รายนี้อยู่นอกทีมของคุณ: เป็นของ BD นอกทีม หรือเป็น Creator สาธารณะที่ไม่มีร้านค้าของทีมคุณ",
  targetOutsideTeamLeadScope: "BD ต้องอยู่ในทีมของคุณและครอบคลุมอย่างน้อยหนึ่งร้านของ Creator รายนี้",
  operatorOutsideScope: "งานนี้อยู่นอกขอบเขต Creator และร้านค้าที่สิทธิ์ “ดำเนินการสถานะธุรกิจ” ของคุณครอบคลุม",
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
