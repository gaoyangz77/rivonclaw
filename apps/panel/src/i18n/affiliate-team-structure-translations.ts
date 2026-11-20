/**
 * Admin team structure (ADR-112): the hierarchy tree, team lead and region
 * admin editors, and the refusals the Backend can return. Merged into
 * `ecommerce.affiliateTeam` for every supported locale. The region admin scope
 * editor reuses the ADR-110 copy in `affiliate-bd-shop-scope-translations.ts`.
 */
const en = {
  structureTab: "Team structure",
  structureTabSummary: "Team leads, region admins, reporting lines",
  teamStructureTitle: "Team structure",
  teamStructureDescription:
    "Place BDs under team leads, at any depth. A team lead sees what the BDs below them see, read-only.",
  teamLeadAdd: "Add team lead",
  teamLeadAddTitle: "Add team lead",
  teamLeadEditTitle: "Edit team lead",
  teamLeadRole: "Team lead",
  teamStructureBdRole: "BD",
  regionAdminRole: "Region admin",
  teamStructureMember: "Member",
  teamStructureMemberSearch: "Search members",
  teamStructureMemberPlaceholder: "Choose a member",
  teamStructureMemberIneligible:
    "This member no longer holds the matching role, so this profile is ignored until the role is restored.",
  teamStructureMemberIneligibleShort: "Role missing",
  teamStructureOpenMembers: "Open members",
  teamLeadNoEligibleMembers:
    "No free member holds the Affiliate Team Lead role. Create a member with that role on the members page first.",
  teamLeadMemberHint:
    "Only members with the Affiliate Team Lead role are listed. The member cannot be changed later.",
  regionAdminNoEligibleMembers:
    "No free member holds the Affiliate Region Admin role. Create a member with that role on the members page first.",
  regionAdminMemberHint:
    "Only members with the Affiliate Region Admin role are listed. The member cannot be changed later.",
  teamStructureDisplayName: "Display name",
  teamStructureDisplayNameHint: "Shown in the team structure.",
  teamStructureReportsTo: "Reports to",
  teamStructureReportsToFor: "{{name}} reports to",
  teamStructureNoParent: "No team lead",
  teamStructureLeadCount: "Team leads: {{count}}",
  teamStructureBusinessDeveloperCount: "BDs: {{count}}",
  teamStructureNoLeads: "No team leads yet. Add one, then place BDs and other leads under it.",
  teamStructureUnparentedTitle: "Not in any team",
  teamStructureUnparentedEmpty: "Every BD reports to a team lead.",
  teamStructureCycle: "Reporting loop",
  teamStructureArchive: "Archive",
  teamStructureArchivedTitle: "Archived ({{count}})",
  teamLeadArchiveTitle: "Archive team lead",
  teamLeadArchiveMessage:
    'Archive {{name}}? Their team stops counting for any lead above them. BDs and leads below stay listed under "Not in any team" until you assign a new team lead.',
  regionAdminArchiveTitle: "Archive region admin",
  regionAdminArchiveMessage: "Archive {{name}}? They can no longer allocate Creators.",
  regionAdminsTitle: "Region admins",
  regionAdminsDescription:
    "Region admins assign, reassign and release the Creators of their regions and shops. They do no daily work.",
  regionAdminAdd: "Add region admin",
  regionAdminAddTitle: "Add region admin",
  regionAdminEditTitle: "Edit region admin",
  regionAdminsEmpty: "No region admins yet.",
  regionAdminScopeAllHint:
    "This region admin can allocate Creators of every shop, including shops connected later.",
  regionAdminScopeSpecificHint:
    "This region admin only allocates Creators of the regions and shops selected below.",
  teamStructureErrorMemberInvalid:
    "This member cannot be used: they were not found, are disabled, or their role lacks the matching Affiliate scope.",
  teamStructureErrorProfileExists: "This member already has a live profile.",
  teamStructureErrorProfileNotFound: "The profile was not found. Refresh and try again.",
  teamStructureErrorProfileArchived: "This profile is archived.",
  teamStructureErrorBusinessDeveloperNotFound: "The BD was not found or is archived.",
  teamStructureErrorParentInvalid: "The chosen team lead was not found or is archived.",
  teamStructureErrorParentCycle:
    "A team lead cannot report to itself or to anyone in its own team.",
  teamStructureErrorShopNotFound:
    "One of the selected shops no longer exists. Reopen the editor and choose again.",
  teamStructureErrorInputInvalid: "Check the name and the selection, then try again.",
};

type Copy = typeof en;

const zh: Copy = {
  structureTab: "团队架构",
  structureTabSummary: "组长、站点管理员、上下级关系",
  teamStructureTitle: "团队架构",
  teamStructureDescription: "把 BD 放到组长名下，层级不限。组长只读查看名下 BD 能看到的内容。",
  teamLeadAdd: "添加组长",
  teamLeadAddTitle: "添加组长",
  teamLeadEditTitle: "编辑组长",
  teamLeadRole: "组长",
  teamStructureBdRole: "BD",
  regionAdminRole: "站点管理员",
  teamStructureMember: "成员",
  teamStructureMemberSearch: "搜索成员",
  teamStructureMemberPlaceholder: "选择成员",
  teamStructureMemberIneligible: "该成员已不再拥有对应角色，在角色恢复前此档案不会生效。",
  teamStructureMemberIneligibleShort: "角色缺失",
  teamStructureOpenMembers: "前往成员页",
  teamLeadNoEligibleMembers:
    "没有可用的成员拥有“Affiliate Team Lead”角色。请先在成员页创建一个该角色的成员。",
  teamLeadMemberHint: "只列出拥有“Affiliate Team Lead”角色的成员，选定后不能更换。",
  regionAdminNoEligibleMembers:
    "没有可用的成员拥有“Affiliate Region Admin”角色。请先在成员页创建一个该角色的成员。",
  regionAdminMemberHint: "只列出拥有“Affiliate Region Admin”角色的成员，选定后不能更换。",
  teamStructureDisplayName: "显示名称",
  teamStructureDisplayNameHint: "显示在团队架构中。",
  teamStructureReportsTo: "上级组长",
  teamStructureReportsToFor: "{{name}} 的上级组长",
  teamStructureNoParent: "无上级组长",
  teamStructureLeadCount: "下级组长：{{count}}",
  teamStructureBusinessDeveloperCount: "BD：{{count}}",
  teamStructureNoLeads: "还没有组长。先添加一位，再把 BD 和其他组长放到其名下。",
  teamStructureUnparentedTitle: "未归属任何组长",
  teamStructureUnparentedEmpty: "所有 BD 都已归属组长。",
  teamStructureCycle: "上下级成环",
  teamStructureArchive: "归档",
  teamStructureArchivedTitle: "已归档（{{count}}）",
  teamLeadArchiveTitle: "归档组长",
  teamLeadArchiveMessage:
    "归档 {{name}}?其团队不再计入上级组长的范围。名下的 BD 和组长会列在「未归属任何组长」下，直到你指定新的组长。",
  regionAdminArchiveTitle: "归档站点管理员",
  regionAdminArchiveMessage: "归档 {{name}}?此后其不能再分配达人。",
  regionAdminsTitle: "站点管理员",
  regionAdminsDescription: "站点管理员可以为所属站点和店铺的达人分配、改派和释放，不做日常运营。",
  regionAdminAdd: "添加站点管理员",
  regionAdminAddTitle: "添加站点管理员",
  regionAdminEditTitle: "编辑站点管理员",
  regionAdminsEmpty: "还没有站点管理员。",
  regionAdminScopeAllHint: "该站点管理员可以分配所有店铺的达人，包括之后接入的店铺。",
  regionAdminScopeSpecificHint: "该站点管理员只分配下方所选站点和店铺的达人。",
  teamStructureErrorMemberInvalid:
    "无法使用该成员：成员不存在、已被停用，或其角色没有对应的联盟权限。",
  teamStructureErrorProfileExists: "该成员已有一个生效的档案。",
  teamStructureErrorProfileNotFound: "找不到该档案，请刷新后重试。",
  teamStructureErrorProfileArchived: "该档案已归档。",
  teamStructureErrorBusinessDeveloperNotFound: "找不到该 BD，或其已归档。",
  teamStructureErrorParentInvalid: "所选组长不存在或已归档。",
  teamStructureErrorParentCycle: "组长不能汇报给自己或自己团队里的人。",
  teamStructureErrorShopNotFound: "所选店铺中有已不存在的店铺，请重新打开编辑器再选择。",
  teamStructureErrorInputInvalid: "请检查名称和所选内容后重试。",
};

const de: Copy = {
  structureTab: "Teamstruktur",
  structureTabSummary: "Teamleiter, Regionsadmins, Berichtslinien",
  teamStructureTitle: "Teamstruktur",
  teamStructureDescription:
    "Ordnen Sie BDs beliebig tief unter Teamleitern ein. Ein Teamleiter sieht schreibgeschützt, was die BDs unter ihm sehen.",
  teamLeadAdd: "Teamleiter hinzufügen",
  teamLeadAddTitle: "Teamleiter hinzufügen",
  teamLeadEditTitle: "Teamleiter bearbeiten",
  teamLeadRole: "Teamleiter",
  teamStructureBdRole: "BD",
  regionAdminRole: "Regionsadmin",
  teamStructureMember: "Mitglied",
  teamStructureMemberSearch: "Mitglieder suchen",
  teamStructureMemberPlaceholder: "Mitglied auswählen",
  teamStructureMemberIneligible:
    "Dieses Mitglied hat die passende Rolle nicht mehr. Das Profil wird ignoriert, bis die Rolle wiederhergestellt ist.",
  teamStructureMemberIneligibleShort: "Rolle fehlt",
  teamStructureOpenMembers: "Mitglieder öffnen",
  teamLeadNoEligibleMembers:
    "Kein freies Mitglied hat die Rolle “Affiliate Team Lead”. Legen Sie zuerst auf der Mitgliederseite ein Mitglied mit dieser Rolle an.",
  teamLeadMemberHint:
    "Es werden nur Mitglieder mit der Rolle “Affiliate Team Lead” angezeigt. Das Mitglied kann später nicht geändert werden.",
  regionAdminNoEligibleMembers:
    "Kein freies Mitglied hat die Rolle “Affiliate Region Admin”. Legen Sie zuerst auf der Mitgliederseite ein Mitglied mit dieser Rolle an.",
  regionAdminMemberHint:
    "Es werden nur Mitglieder mit der Rolle “Affiliate Region Admin” angezeigt. Das Mitglied kann später nicht geändert werden.",
  teamStructureDisplayName: "Anzeigename",
  teamStructureDisplayNameHint: "Wird in der Teamstruktur angezeigt.",
  teamStructureReportsTo: "Berichtet an",
  teamStructureReportsToFor: "{{name}} berichtet an",
  teamStructureNoParent: "Kein Teamleiter",
  teamStructureLeadCount: "Teamleiter: {{count}}",
  teamStructureBusinessDeveloperCount: "BDs: {{count}}",
  teamStructureNoLeads:
    "Noch keine Teamleiter. Fügen Sie einen hinzu und ordnen Sie dann BDs und weitere Teamleiter darunter ein.",
  teamStructureUnparentedTitle: "In keinem Team",
  teamStructureUnparentedEmpty: "Jeder BD berichtet an einen Teamleiter.",
  teamStructureCycle: "Berichtsschleife",
  teamStructureArchive: "Archivieren",
  teamStructureArchivedTitle: "Archiviert ({{count}})",
  teamLeadArchiveTitle: "Teamleiter archivieren",
  teamLeadArchiveMessage:
    "{{name}} archivieren? Das Team zählt dann für übergeordnete Teamleiter nicht mehr mit. BDs und Teamleiter darunter erscheinen unter „In keinem Team“, bis Sie einen neuen Teamleiter zuweisen.",
  regionAdminArchiveTitle: "Regionsadmin archivieren",
  regionAdminArchiveMessage: "{{name}} archivieren? Er kann dann keine Creator mehr zuweisen.",
  regionAdminsTitle: "Regionsadmins",
  regionAdminsDescription:
    "Regionsadmins weisen die Creator ihrer Regionen und Shops zu, ordnen sie neu zu und geben sie frei. Das Tagesgeschäft übernehmen sie nicht.",
  regionAdminAdd: "Regionsadmin hinzufügen",
  regionAdminAddTitle: "Regionsadmin hinzufügen",
  regionAdminEditTitle: "Regionsadmin bearbeiten",
  regionAdminsEmpty: "Noch keine Regionsadmins.",
  regionAdminScopeAllHint:
    "Dieser Regionsadmin kann Creator aller Shops zuweisen, auch später verbundener Shops.",
  regionAdminScopeSpecificHint:
    "Dieser Regionsadmin weist nur Creator der unten gewählten Regionen und Shops zu.",
  teamStructureErrorMemberInvalid:
    "Dieses Mitglied kann nicht verwendet werden: Es wurde nicht gefunden, ist deaktiviert oder seine Rolle hat nicht den passenden Affiliate-Bereich.",
  teamStructureErrorProfileExists: "Dieses Mitglied hat bereits ein aktives Profil.",
  teamStructureErrorProfileNotFound:
    "Das Profil wurde nicht gefunden. Aktualisieren und erneut versuchen.",
  teamStructureErrorProfileArchived: "Dieses Profil ist archiviert.",
  teamStructureErrorBusinessDeveloperNotFound: "Der BD wurde nicht gefunden oder ist archiviert.",
  teamStructureErrorParentInvalid:
    "Der gewählte Teamleiter wurde nicht gefunden oder ist archiviert.",
  teamStructureErrorParentCycle:
    "Ein Teamleiter kann nicht an sich selbst oder an jemanden aus dem eigenen Team berichten.",
  teamStructureErrorShopNotFound:
    "Einer der gewählten Shops existiert nicht mehr. Öffnen Sie den Editor erneut und wählen Sie neu.",
  teamStructureErrorInputInvalid: "Prüfen Sie Name und Auswahl und versuchen Sie es erneut.",
};

const es: Copy = {
  structureTab: "Estructura del equipo",
  structureTabSummary: "Líderes de equipo, administradores de región, líneas de dependencia",
  teamStructureTitle: "Estructura del equipo",
  teamStructureDescription:
    "Coloque BDs bajo líderes de equipo, a cualquier profundidad. Un líder de equipo ve, solo en lectura, lo que ven los BDs de su equipo.",
  teamLeadAdd: "Añadir líder de equipo",
  teamLeadAddTitle: "Añadir líder de equipo",
  teamLeadEditTitle: "Editar líder de equipo",
  teamLeadRole: "Líder de equipo",
  teamStructureBdRole: "BD",
  regionAdminRole: "Administrador de región",
  teamStructureMember: "Miembro",
  teamStructureMemberSearch: "Buscar miembros",
  teamStructureMemberPlaceholder: "Elija un miembro",
  teamStructureMemberIneligible:
    "Este miembro ya no tiene el rol correspondiente, así que este perfil se ignora hasta que se restablezca el rol.",
  teamStructureMemberIneligibleShort: "Falta el rol",
  teamStructureOpenMembers: "Abrir miembros",
  teamLeadNoEligibleMembers:
    "Ningún miembro libre tiene el rol “Affiliate Team Lead”. Cree antes en la página de miembros un miembro con ese rol.",
  teamLeadMemberHint:
    "Solo se listan los miembros con el rol “Affiliate Team Lead”. El miembro no se puede cambiar después.",
  regionAdminNoEligibleMembers:
    "Ningún miembro libre tiene el rol “Affiliate Region Admin”. Cree antes en la página de miembros un miembro con ese rol.",
  regionAdminMemberHint:
    "Solo se listan los miembros con el rol “Affiliate Region Admin”. El miembro no se puede cambiar después.",
  teamStructureDisplayName: "Nombre visible",
  teamStructureDisplayNameHint: "Se muestra en la estructura del equipo.",
  teamStructureReportsTo: "Depende de",
  teamStructureReportsToFor: "{{name}} depende de",
  teamStructureNoParent: "Sin líder de equipo",
  teamStructureLeadCount: "Líderes de equipo: {{count}}",
  teamStructureBusinessDeveloperCount: "BDs: {{count}}",
  teamStructureNoLeads:
    "Aún no hay líderes de equipo. Añada uno y coloque debajo BDs y otros líderes.",
  teamStructureUnparentedTitle: "Sin equipo",
  teamStructureUnparentedEmpty: "Todos los BDs dependen de un líder de equipo.",
  teamStructureCycle: "Bucle de dependencia",
  teamStructureArchive: "Archivar",
  teamStructureArchivedTitle: "Archivados ({{count}})",
  teamLeadArchiveTitle: "Archivar líder de equipo",
  teamLeadArchiveMessage:
    "¿Archivar a {{name}}? Su equipo deja de contar para los líderes superiores. Los BDs y líderes de su equipo quedan en «Sin equipo» hasta que asigne un nuevo líder.",
  regionAdminArchiveTitle: "Archivar administrador de región",
  regionAdminArchiveMessage: "¿Archivar a {{name}}? Ya no podrá asignar creadores.",
  regionAdminsTitle: "Administradores de región",
  regionAdminsDescription:
    "Los administradores de región asignan, reasignan y liberan los creadores de sus regiones y tiendas. No hacen trabajo diario.",
  regionAdminAdd: "Añadir administrador de región",
  regionAdminAddTitle: "Añadir administrador de región",
  regionAdminEditTitle: "Editar administrador de región",
  regionAdminsEmpty: "Aún no hay administradores de región.",
  regionAdminScopeAllHint:
    "Este administrador puede asignar creadores de todas las tiendas, incluidas las conectadas más adelante.",
  regionAdminScopeSpecificHint:
    "Este administrador solo asigna creadores de las regiones y tiendas seleccionadas abajo.",
  teamStructureErrorMemberInvalid:
    "No se puede usar este miembro: no se encontró, está desactivado o su rol no tiene el permiso de afiliados correspondiente.",
  teamStructureErrorProfileExists: "Este miembro ya tiene un perfil activo.",
  teamStructureErrorProfileNotFound: "No se encontró el perfil. Actualice e inténtelo de nuevo.",
  teamStructureErrorProfileArchived: "Este perfil está archivado.",
  teamStructureErrorBusinessDeveloperNotFound: "No se encontró el BD o está archivado.",
  teamStructureErrorParentInvalid: "El líder de equipo elegido no se encontró o está archivado.",
  teamStructureErrorParentCycle:
    "Un líder de equipo no puede depender de sí mismo ni de alguien de su propio equipo.",
  teamStructureErrorShopNotFound:
    "Una de las tiendas seleccionadas ya no existe. Vuelva a abrir el editor y elija de nuevo.",
  teamStructureErrorInputInvalid: "Revise el nombre y la selección e inténtelo de nuevo.",
};

const fr: Copy = {
  structureTab: "Structure de l'équipe",
  structureTabSummary: "Chefs d'équipe, administrateurs de région, liens hiérarchiques",
  teamStructureTitle: "Structure de l'équipe",
  teamStructureDescription:
    "Placez les BD sous des chefs d'équipe, à n'importe quelle profondeur. Un chef d'équipe voit, en lecture seule, ce que voient les BD de son équipe.",
  teamLeadAdd: "Ajouter un chef d'équipe",
  teamLeadAddTitle: "Ajouter un chef d'équipe",
  teamLeadEditTitle: "Modifier le chef d'équipe",
  teamLeadRole: "Chef d'équipe",
  teamStructureBdRole: "BD",
  regionAdminRole: "Administrateur de région",
  teamStructureMember: "Membre",
  teamStructureMemberSearch: "Rechercher des membres",
  teamStructureMemberPlaceholder: "Choisir un membre",
  teamStructureMemberIneligible:
    "Ce membre n'a plus le rôle correspondant ; ce profil est ignoré tant que le rôle n'est pas rétabli.",
  teamStructureMemberIneligibleShort: "Rôle manquant",
  teamStructureOpenMembers: "Ouvrir les membres",
  teamLeadNoEligibleMembers:
    "Aucun membre disponible n'a le rôle “Affiliate Team Lead”. Créez d'abord, sur la page des membres, un membre avec ce rôle.",
  teamLeadMemberHint:
    "Seuls les membres ayant le rôle “Affiliate Team Lead” sont listés. Le membre ne pourra plus être changé.",
  regionAdminNoEligibleMembers:
    "Aucun membre disponible n'a le rôle “Affiliate Region Admin”. Créez d'abord, sur la page des membres, un membre avec ce rôle.",
  regionAdminMemberHint:
    "Seuls les membres ayant le rôle “Affiliate Region Admin” sont listés. Le membre ne pourra plus être changé.",
  teamStructureDisplayName: "Nom affiché",
  teamStructureDisplayNameHint: "Affiché dans la structure de l'équipe.",
  teamStructureReportsTo: "Rattaché à",
  teamStructureReportsToFor: "{{name}} est rattaché à",
  teamStructureNoParent: "Aucun chef d'équipe",
  teamStructureLeadCount: "Chefs d'équipe : {{count}}",
  teamStructureBusinessDeveloperCount: "BD : {{count}}",
  teamStructureNoLeads:
    "Aucun chef d'équipe pour l'instant. Ajoutez-en un, puis placez dessous des BD et d'autres chefs.",
  teamStructureUnparentedTitle: "Dans aucune équipe",
  teamStructureUnparentedEmpty: "Chaque BD est rattaché à un chef d'équipe.",
  teamStructureCycle: "Boucle hiérarchique",
  teamStructureArchive: "Archiver",
  teamStructureArchivedTitle: "Archivés ({{count}})",
  teamLeadArchiveTitle: "Archiver le chef d'équipe",
  teamLeadArchiveMessage:
    "Archiver {{name}} ? Son équipe ne compte plus pour les chefs au-dessus. Les BD et chefs en dessous restent sous « Dans aucune équipe » jusqu'à l'attribution d'un nouveau chef.",
  regionAdminArchiveTitle: "Archiver l'administrateur de région",
  regionAdminArchiveMessage: "Archiver {{name}} ? Il ne pourra plus attribuer de créateurs.",
  regionAdminsTitle: "Administrateurs de région",
  regionAdminsDescription:
    "Les administrateurs de région attribuent, réattribuent et libèrent les créateurs de leurs régions et boutiques. Ils ne font pas le travail quotidien.",
  regionAdminAdd: "Ajouter un administrateur de région",
  regionAdminAddTitle: "Ajouter un administrateur de région",
  regionAdminEditTitle: "Modifier l'administrateur de région",
  regionAdminsEmpty: "Aucun administrateur de région pour l'instant.",
  regionAdminScopeAllHint:
    "Cet administrateur peut attribuer les créateurs de toutes les boutiques, y compris celles connectées plus tard.",
  regionAdminScopeSpecificHint:
    "Cet administrateur n'attribue que les créateurs des régions et boutiques sélectionnées ci-dessous.",
  teamStructureErrorMemberInvalid:
    "Ce membre ne peut pas être utilisé : introuvable, désactivé, ou son rôle n'a pas la permission d'affiliation correspondante.",
  teamStructureErrorProfileExists: "Ce membre a déjà un profil actif.",
  teamStructureErrorProfileNotFound: "Profil introuvable. Actualisez et réessayez.",
  teamStructureErrorProfileArchived: "Ce profil est archivé.",
  teamStructureErrorBusinessDeveloperNotFound: "BD introuvable ou archivé.",
  teamStructureErrorParentInvalid: "Le chef d'équipe choisi est introuvable ou archivé.",
  teamStructureErrorParentCycle:
    "Un chef d'équipe ne peut pas être rattaché à lui-même ni à quelqu'un de sa propre équipe.",
  teamStructureErrorShopNotFound:
    "Une des boutiques sélectionnées n'existe plus. Rouvrez l'éditeur et choisissez à nouveau.",
  teamStructureErrorInputInvalid: "Vérifiez le nom et la sélection, puis réessayez.",
};

const id: Copy = {
  structureTab: "Struktur tim",
  structureTabSummary: "Ketua tim, admin wilayah, garis pelaporan",
  teamStructureTitle: "Struktur tim",
  teamStructureDescription:
    "Tempatkan BD di bawah ketua tim, dengan kedalaman berapa pun. Ketua tim melihat, hanya-baca, apa yang dilihat BD di bawahnya.",
  teamLeadAdd: "Tambah ketua tim",
  teamLeadAddTitle: "Tambah ketua tim",
  teamLeadEditTitle: "Ubah ketua tim",
  teamLeadRole: "Ketua tim",
  teamStructureBdRole: "BD",
  regionAdminRole: "Admin wilayah",
  teamStructureMember: "Anggota",
  teamStructureMemberSearch: "Cari anggota",
  teamStructureMemberPlaceholder: "Pilih anggota",
  teamStructureMemberIneligible:
    "Anggota ini tidak lagi memiliki peran yang sesuai, jadi profil ini diabaikan sampai peran dipulihkan.",
  teamStructureMemberIneligibleShort: "Peran hilang",
  teamStructureOpenMembers: "Buka anggota",
  teamLeadNoEligibleMembers:
    "Tidak ada anggota bebas dengan peran “Affiliate Team Lead”. Buat dulu anggota dengan peran itu di halaman anggota.",
  teamLeadMemberHint:
    "Hanya anggota dengan peran “Affiliate Team Lead” yang ditampilkan. Anggota tidak dapat diganti nanti.",
  regionAdminNoEligibleMembers:
    "Tidak ada anggota bebas dengan peran “Affiliate Region Admin”. Buat dulu anggota dengan peran itu di halaman anggota.",
  regionAdminMemberHint:
    "Hanya anggota dengan peran “Affiliate Region Admin” yang ditampilkan. Anggota tidak dapat diganti nanti.",
  teamStructureDisplayName: "Nama tampilan",
  teamStructureDisplayNameHint: "Ditampilkan di struktur tim.",
  teamStructureReportsTo: "Melapor ke",
  teamStructureReportsToFor: "{{name}} melapor ke",
  teamStructureNoParent: "Tanpa ketua tim",
  teamStructureLeadCount: "Ketua tim: {{count}}",
  teamStructureBusinessDeveloperCount: "BD: {{count}}",
  teamStructureNoLeads:
    "Belum ada ketua tim. Tambahkan satu, lalu tempatkan BD dan ketua lain di bawahnya.",
  teamStructureUnparentedTitle: "Tidak di tim mana pun",
  teamStructureUnparentedEmpty: "Setiap BD melapor ke seorang ketua tim.",
  teamStructureCycle: "Putaran pelaporan",
  teamStructureArchive: "Arsipkan",
  teamStructureArchivedTitle: "Diarsipkan ({{count}})",
  teamLeadArchiveTitle: "Arsipkan ketua tim",
  teamLeadArchiveMessage:
    'Arsipkan {{name}}? Timnya tidak lagi dihitung untuk ketua di atasnya. BD dan ketua di bawahnya tetap tercantum di "Tidak di tim mana pun" sampai Anda menetapkan ketua tim baru.',
  regionAdminArchiveTitle: "Arsipkan admin wilayah",
  regionAdminArchiveMessage: "Arsipkan {{name}}? Ia tidak lagi dapat membagikan kreator.",
  regionAdminsTitle: "Admin wilayah",
  regionAdminsDescription:
    "Admin wilayah menugaskan, menugaskan ulang, dan melepas kreator dari wilayah dan toko mereka. Mereka tidak mengerjakan tugas harian.",
  regionAdminAdd: "Tambah admin wilayah",
  regionAdminAddTitle: "Tambah admin wilayah",
  regionAdminEditTitle: "Ubah admin wilayah",
  regionAdminsEmpty: "Belum ada admin wilayah.",
  regionAdminScopeAllHint:
    "Admin wilayah ini dapat membagikan kreator dari semua toko, termasuk toko yang terhubung kemudian.",
  regionAdminScopeSpecificHint:
    "Admin wilayah ini hanya membagikan kreator dari wilayah dan toko yang dipilih di bawah.",
  teamStructureErrorMemberInvalid:
    "Anggota ini tidak dapat dipakai: tidak ditemukan, dinonaktifkan, atau perannya tidak memiliki izin afiliasi yang sesuai.",
  teamStructureErrorProfileExists: "Anggota ini sudah memiliki profil aktif.",
  teamStructureErrorProfileNotFound: "Profil tidak ditemukan. Muat ulang lalu coba lagi.",
  teamStructureErrorProfileArchived: "Profil ini diarsipkan.",
  teamStructureErrorBusinessDeveloperNotFound: "BD tidak ditemukan atau diarsipkan.",
  teamStructureErrorParentInvalid: "Ketua tim yang dipilih tidak ditemukan atau diarsipkan.",
  teamStructureErrorParentCycle:
    "Ketua tim tidak dapat melapor ke dirinya sendiri atau ke anggota timnya sendiri.",
  teamStructureErrorShopNotFound:
    "Salah satu toko yang dipilih sudah tidak ada. Buka editor lagi dan pilih ulang.",
  teamStructureErrorInputInvalid: "Periksa nama dan pilihan, lalu coba lagi.",
};

const it: Copy = {
  structureTab: "Struttura del team",
  structureTabSummary: "Responsabili di team, amministratori di area, linee di riporto",
  teamStructureTitle: "Struttura del team",
  teamStructureDescription:
    "Inserisci i BD sotto i responsabili di team, a qualsiasi profondità. Un responsabile vede, in sola lettura, ciò che vedono i BD del suo team.",
  teamLeadAdd: "Aggiungi responsabile di team",
  teamLeadAddTitle: "Aggiungi responsabile di team",
  teamLeadEditTitle: "Modifica responsabile di team",
  teamLeadRole: "Responsabile di team",
  teamStructureBdRole: "BD",
  regionAdminRole: "Amministratore di area",
  teamStructureMember: "Membro",
  teamStructureMemberSearch: "Cerca membri",
  teamStructureMemberPlaceholder: "Scegli un membro",
  teamStructureMemberIneligible:
    "Questo membro non ha più il ruolo corrispondente, quindi il profilo viene ignorato finché il ruolo non viene ripristinato.",
  teamStructureMemberIneligibleShort: "Ruolo mancante",
  teamStructureOpenMembers: "Apri membri",
  teamLeadNoEligibleMembers:
    "Nessun membro libero ha il ruolo “Affiliate Team Lead”. Crea prima nella pagina dei membri un membro con quel ruolo.",
  teamLeadMemberHint:
    "Sono elencati solo i membri con il ruolo “Affiliate Team Lead”. Il membro non può essere cambiato in seguito.",
  regionAdminNoEligibleMembers:
    "Nessun membro libero ha il ruolo “Affiliate Region Admin”. Crea prima nella pagina dei membri un membro con quel ruolo.",
  regionAdminMemberHint:
    "Sono elencati solo i membri con il ruolo “Affiliate Region Admin”. Il membro non può essere cambiato in seguito.",
  teamStructureDisplayName: "Nome visualizzato",
  teamStructureDisplayNameHint: "Mostrato nella struttura del team.",
  teamStructureReportsTo: "Risponde a",
  teamStructureReportsToFor: "{{name}} risponde a",
  teamStructureNoParent: "Nessun responsabile",
  teamStructureLeadCount: "Responsabili di team: {{count}}",
  teamStructureBusinessDeveloperCount: "BD: {{count}}",
  teamStructureNoLeads:
    "Ancora nessun responsabile di team. Aggiungine uno, poi inserisci sotto di lui BD e altri responsabili.",
  teamStructureUnparentedTitle: "In nessun team",
  teamStructureUnparentedEmpty: "Ogni BD risponde a un responsabile di team.",
  teamStructureCycle: "Ciclo di riporto",
  teamStructureArchive: "Archivia",
  teamStructureArchivedTitle: "Archiviati ({{count}})",
  teamLeadArchiveTitle: "Archivia responsabile di team",
  teamLeadArchiveMessage:
    "Archiviare {{name}}? Il suo team non conta più per i responsabili sopra di lui. BD e responsabili sotto di lui restano in «In nessun team» finché non assegni un nuovo responsabile.",
  regionAdminArchiveTitle: "Archivia amministratore di area",
  regionAdminArchiveMessage: "Archiviare {{name}}? Non potrà più assegnare creator.",
  regionAdminsTitle: "Amministratori di area",
  regionAdminsDescription:
    "Gli amministratori di area assegnano, riassegnano e rilasciano i creator delle loro aree e dei loro negozi. Non svolgono il lavoro quotidiano.",
  regionAdminAdd: "Aggiungi amministratore di area",
  regionAdminAddTitle: "Aggiungi amministratore di area",
  regionAdminEditTitle: "Modifica amministratore di area",
  regionAdminsEmpty: "Ancora nessun amministratore di area.",
  regionAdminScopeAllHint:
    "Questo amministratore può assegnare i creator di tutti i negozi, compresi quelli collegati in seguito.",
  regionAdminScopeSpecificHint:
    "Questo amministratore assegna solo i creator delle aree e dei negozi selezionati sotto.",
  teamStructureErrorMemberInvalid:
    "Questo membro non può essere usato: non trovato, disattivato o con un ruolo privo del permesso di affiliazione corrispondente.",
  teamStructureErrorProfileExists: "Questo membro ha già un profilo attivo.",
  teamStructureErrorProfileNotFound: "Profilo non trovato. Aggiorna e riprova.",
  teamStructureErrorProfileArchived: "Questo profilo è archiviato.",
  teamStructureErrorBusinessDeveloperNotFound: "BD non trovato o archiviato.",
  teamStructureErrorParentInvalid:
    "Il responsabile di team scelto non è stato trovato o è archiviato.",
  teamStructureErrorParentCycle:
    "Un responsabile di team non può rispondere a sé stesso né a qualcuno del proprio team.",
  teamStructureErrorShopNotFound:
    "Uno dei negozi selezionati non esiste più. Riapri l'editor e scegli di nuovo.",
  teamStructureErrorInputInvalid: "Controlla il nome e la selezione, poi riprova.",
};

const th: Copy = {
  structureTab: "โครงสร้างทีม",
  structureTabSummary: "หัวหน้าทีม ผู้ดูแลภูมิภาค สายการรายงาน",
  teamStructureTitle: "โครงสร้างทีม",
  teamStructureDescription:
    "จัด BD ไว้ภายใต้หัวหน้าทีมได้หลายระดับ หัวหน้าทีมดูข้อมูลของ BD ในทีมได้แบบอ่านอย่างเดียว",
  teamLeadAdd: "เพิ่มหัวหน้าทีม",
  teamLeadAddTitle: "เพิ่มหัวหน้าทีม",
  teamLeadEditTitle: "แก้ไขหัวหน้าทีม",
  teamLeadRole: "หัวหน้าทีม",
  teamStructureBdRole: "BD",
  regionAdminRole: "ผู้ดูแลภูมิภาค",
  teamStructureMember: "สมาชิก",
  teamStructureMemberSearch: "ค้นหาสมาชิก",
  teamStructureMemberPlaceholder: "เลือกสมาชิก",
  teamStructureMemberIneligible: "สมาชิกคนนี้ไม่มีบทบาทที่ตรงกันแล้ว โปรไฟล์นี้จึงไม่มีผลจนกว่าจะคืนบทบาท",
  teamStructureMemberIneligibleShort: "ไม่มีบทบาท",
  teamStructureOpenMembers: "เปิดหน้าสมาชิก",
  teamLeadNoEligibleMembers:
    "ไม่มีสมาชิกว่างที่มีบทบาท“Affiliate Team Lead” กรุณาสร้างสมาชิกที่มีบทบาทนี้ในหน้าสมาชิกก่อน",
  teamLeadMemberHint: "แสดงเฉพาะสมาชิกที่มีบทบาท“Affiliate Team Lead” และเปลี่ยนสมาชิกภายหลังไม่ได้",
  regionAdminNoEligibleMembers:
    "ไม่มีสมาชิกว่างที่มีบทบาท“Affiliate Region Admin” กรุณาสร้างสมาชิกที่มีบทบาทนี้ในหน้าสมาชิกก่อน",
  regionAdminMemberHint: "แสดงเฉพาะสมาชิกที่มีบทบาท“Affiliate Region Admin” และเปลี่ยนสมาชิกภายหลังไม่ได้",
  teamStructureDisplayName: "ชื่อที่แสดง",
  teamStructureDisplayNameHint: "แสดงในโครงสร้างทีม",
  teamStructureReportsTo: "รายงานต่อ",
  teamStructureReportsToFor: "{{name}} รายงานต่อ",
  teamStructureNoParent: "ไม่มีหัวหน้าทีม",
  teamStructureLeadCount: "หัวหน้าทีม: {{count}}",
  teamStructureBusinessDeveloperCount: "BD: {{count}}",
  teamStructureNoLeads: "ยังไม่มีหัวหน้าทีม เพิ่มหนึ่งคน แล้วจัด BD และหัวหน้าทีมคนอื่นไว้ใต้เขา",
  teamStructureUnparentedTitle: "ไม่อยู่ในทีมใด",
  teamStructureUnparentedEmpty: "BD ทุกคนรายงานต่อหัวหน้าทีมแล้ว",
  teamStructureCycle: "สายรายงานวนกลับ",
  teamStructureArchive: "เก็บถาวร",
  teamStructureArchivedTitle: "เก็บถาวรแล้ว ({{count}})",
  teamLeadArchiveTitle: "เก็บถาวรหัวหน้าทีม",
  teamLeadArchiveMessage:
    'เก็บถาวร {{name}} หรือไม่ ทีมของเขาจะไม่นับรวมให้หัวหน้าที่อยู่เหนือขึ้นไป BD และหัวหน้าทีมที่อยู่ใต้เขาจะแสดงใน "ไม่อยู่ในทีมใด" จนกว่าคุณจะกำหนดหัวหน้าทีมใหม่',
  regionAdminArchiveTitle: "เก็บถาวรผู้ดูแลภูมิภาค",
  regionAdminArchiveMessage: "เก็บถาวร {{name}} หรือไม่ เขาจะไม่สามารถมอบหมายครีเอเตอร์ได้อีก",
  regionAdminsTitle: "ผู้ดูแลภูมิภาค",
  regionAdminsDescription:
    "ผู้ดูแลภูมิภาคมอบหมาย โอนย้าย และปล่อยครีเอเตอร์ของภูมิภาคและร้านค้าของตน โดยไม่ทำงานประจำวัน",
  regionAdminAdd: "เพิ่มผู้ดูแลภูมิภาค",
  regionAdminAddTitle: "เพิ่มผู้ดูแลภูมิภาค",
  regionAdminEditTitle: "แก้ไขผู้ดูแลภูมิภาค",
  regionAdminsEmpty: "ยังไม่มีผู้ดูแลภูมิภาค",
  regionAdminScopeAllHint: "ผู้ดูแลภูมิภาคคนนี้มอบหมายครีเอเตอร์ของทุกร้านค้าได้ รวมถึงร้านที่เชื่อมต่อภายหลัง",
  regionAdminScopeSpecificHint: "ผู้ดูแลภูมิภาคคนนี้มอบหมายครีเอเตอร์ได้เฉพาะภูมิภาคและร้านค้าที่เลือกด้านล่าง",
  teamStructureErrorMemberInvalid: "ใช้สมาชิกคนนี้ไม่ได้: ไม่พบ ถูกปิดใช้งาน หรือบทบาทไม่มีสิทธิ์แอฟฟิลิเอตที่ตรงกัน",
  teamStructureErrorProfileExists: "สมาชิกคนนี้มีโปรไฟล์ที่ใช้งานอยู่แล้ว",
  teamStructureErrorProfileNotFound: "ไม่พบโปรไฟล์ กรุณารีเฟรชแล้วลองอีกครั้ง",
  teamStructureErrorProfileArchived: "โปรไฟล์นี้ถูกเก็บถาวรแล้ว",
  teamStructureErrorBusinessDeveloperNotFound: "ไม่พบ BD หรือ BD ถูกเก็บถาวรแล้ว",
  teamStructureErrorParentInvalid: "ไม่พบหัวหน้าทีมที่เลือก หรือถูกเก็บถาวรแล้ว",
  teamStructureErrorParentCycle: "หัวหน้าทีมรายงานต่อตัวเองหรือคนในทีมของตนเองไม่ได้",
  teamStructureErrorShopNotFound: "ร้านค้าที่เลือกบางร้านไม่มีอยู่แล้ว กรุณาเปิดตัวแก้ไขใหม่แล้วเลือกอีกครั้ง",
  teamStructureErrorInputInvalid: "ตรวจสอบชื่อและตัวเลือก แล้วลองอีกครั้ง",
};

export const AFFILIATE_TEAM_STRUCTURE_COPY = { en, zh, de, es, fr, id, it, th };
