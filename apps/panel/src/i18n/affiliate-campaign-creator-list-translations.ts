// ADR-106: copy for creator-list campaigns (strategy card, upload section, progress detail).
// Nested under `ecommerce.affiliateCampaign.creatorList`; every locale carries every key.

const en = {
  strategyKicker: "Your list",
  strategyTitle: "Creator list",
  strategyDescription:
    "Upload a list of creator usernames and reach exactly those creators. Nothing is searched or filtered.",
  strategyOrder:
    "Creators TikTok already knows are matched at once; the rest are looked up one at a time, about one every 2 minutes per shop.",
  sectionTitle: "Creator list",
  sectionDescription:
    "Download the template, put one creator username per row in the creator_username column, and upload the file (.xlsx, .xls or .csv).",
  downloadTemplate: "Download template",
  uploadFile: "Upload list",
  replaceFile: "Replace list",
  reading: "Reading file…",
  readFailed: "The file could not be read. Upload an .xlsx, .xls or .csv file.",
  missingColumn: "The first row must be the header creator_username. Use the template.",
  noRows: "The file has no usernames below the header.",
  summaryValid: "{{count}} usernames",
  summaryDuplicates: "{{count}} duplicates removed",
  summaryInvalid: "{{count}} rows are not valid usernames",
  invalidRow: "Row {{row}}: {{value}}",
  invalidMore: "and {{count}} more rows",
  tooMany: "A list can hold at most {{max}} usernames; this file has {{count}}.",
  listRequired: "Upload a creator list before continuing.",
  existingList:
    "Current list: {{total}} usernames. Uploading a new file replaces it; creators already reached are not reached again.",
  lookupNote:
    "Creators TikTok already knows are matched at once. The rest are looked up one at a time, about one every 2 minutes per shop, and the results appear in the campaign details.",
  template: {
    instructionsSheetName: "Instructions",
    field: "Field",
    requirement: "Requirement",
    instructions: "How to fill",
    example: "Example",
    required: "Required",
    usernameHint:
      "One creator username per row. A leading @ and pasted profile links are accepted. Letters, digits, dots and underscores only, up to 24 characters. At most {{max}} usernames.",
  },
  confirmTitle: "Creator source",
  confirmValue: "Creator list · {{count}} usernames",
  detail: {
    viewList: "View creator list",
    hideList: "Hide creator list",
    title: "Creator list progress",
    resolved: "Matched",
    pendingLookup: "Being looked up",
    notFound: "Not found",
    ambiguous: "Ambiguous",
    lookupFailed: "Lookup failed",
    fed: "Sent to outreach",
    problemTitle: "Usernames that could not be matched",
    problemEmpty: "Every username has been matched or is still being looked up.",
    loadMore: "Load more",
  },
  status: {
    PENDING_LOOKUP: "Being looked up",
    RESOLVED: "Matched",
    NOT_FOUND: "Not found",
    AMBIGUOUS: "Ambiguous",
    LOOKUP_FAILED: "Lookup failed",
  },
  source: {
    IDENTITY_STORE: "Already known",
    MARKETPLACE_SEARCH: "Found by search",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "Waiting for creators in your list to be looked up",
    CREATOR_LIST_EXHAUSTED:
      "Every creator in your list has been used. Upload more usernames to continue.",
  },
  readinessListEmpty: "The creator list is empty. Upload a list to start.",
  errors: {
    required: "Upload a creator list before continuing.",
    tooLarge: "The creator list is too large. A list can hold at most 5,000 usernames.",
    usernameInvalid: "Some usernames are not valid: {{rows}}",
    notAllowed:
      "A creator list can only be used when the campaign is created with the creator list strategy.",
    sourceImmutable: "How creators are chosen cannot be changed after the campaign is created.",
  },
};

export type CreatorListCopy = typeof en;

const zh: CreatorListCopy = {
  strategyKicker: "按名单",
  strategyTitle: "达人名单",
  strategyDescription: "上传达人用户名名单，只联系名单里的达人，不做搜索和筛选。",
  strategyOrder: "TikTok 已知的达人会立即匹配，其余的逐个查找，每个店铺约每 2 分钟查一个。",
  sectionTitle: "达人名单",
  sectionDescription:
    "下载模板，在 creator_username 列中每行填一个达人用户名，然后上传文件（.xlsx、.xls 或 .csv）。",
  downloadTemplate: "下载模板",
  uploadFile: "上传名单",
  replaceFile: "替换名单",
  reading: "正在读取文件…",
  readFailed: "无法读取该文件，请上传 .xlsx、.xls 或 .csv 文件。",
  missingColumn: "第一行必须是表头 creator_username，请使用模板。",
  noRows: "表头下方没有用户名。",
  summaryValid: "{{count}} 个用户名",
  summaryDuplicates: "已去除 {{count}} 个重复",
  summaryInvalid: "{{count}} 行不是有效的用户名",
  invalidRow: "第 {{row}} 行：{{value}}",
  invalidMore: "另有 {{count}} 行",
  tooMany: "名单最多 {{max}} 个用户名，该文件有 {{count}} 个。",
  listRequired: "请先上传达人名单再继续。",
  existingList: "当前名单：{{total}} 个用户名。上传新文件会替换它；已联系过的达人不会被重复联系。",
  lookupNote:
    "TikTok 已知的达人会立即匹配，其余的逐个查找，每个店铺约每 2 分钟查一个，结果会显示在计划详情中。",
  template: {
    instructionsSheetName: "填写说明",
    field: "字段",
    requirement: "是否必填",
    instructions: "填写方式",
    example: "示例",
    required: "必填",
    usernameHint:
      "每行一个达人用户名，可以带开头的 @，也可以直接粘贴主页链接。仅限字母、数字、点和下划线，最长 24 个字符。最多 {{max}} 个用户名。",
  },
  confirmTitle: "达人来源",
  confirmValue: "达人名单 · {{count}} 个用户名",
  detail: {
    viewList: "查看达人名单",
    hideList: "收起达人名单",
    title: "达人名单进度",
    resolved: "已匹配",
    pendingLookup: "查找中",
    notFound: "未找到",
    ambiguous: "不唯一",
    lookupFailed: "查找失败",
    fed: "已进入联系流程",
    problemTitle: "未能匹配的用户名",
    problemEmpty: "所有用户名都已匹配或仍在查找中。",
    loadMore: "加载更多",
  },
  status: {
    PENDING_LOOKUP: "查找中",
    RESOLVED: "已匹配",
    NOT_FOUND: "未找到",
    AMBIGUOUS: "不唯一",
    LOOKUP_FAILED: "查找失败",
  },
  source: {
    IDENTITY_STORE: "已知达人",
    MARKETPLACE_SEARCH: "搜索找到",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "正在等待名单中的达人完成查找",
    CREATOR_LIST_EXHAUSTED: "名单中的达人已全部使用，上传更多用户名即可继续。",
  },
  readinessListEmpty: "达人名单为空，请上传名单后开始。",
  errors: {
    required: "请先上传达人名单再继续。",
    tooLarge: "达人名单过大，名单最多 5,000 个用户名。",
    usernameInvalid: "部分用户名无效：{{rows}}",
    notAllowed: "只有以达人名单方式创建的计划才能使用达人名单。",
    sourceImmutable: "计划创建后，不能更改达人的选择方式。",
  },
};

const de: CreatorListCopy = {
  strategyKicker: "Ihre Liste",
  strategyTitle: "Creator-Liste",
  strategyDescription:
    "Laden Sie eine Liste von Creator-Benutzernamen hoch und erreichen Sie genau diese Creator. Es wird nichts gesucht oder gefiltert.",
  strategyOrder:
    "Creator, die TikTok bereits kennt, werden sofort zugeordnet; die übrigen werden nacheinander gesucht, etwa einer alle 2 Minuten pro Shop.",
  sectionTitle: "Creator-Liste",
  sectionDescription:
    "Laden Sie die Vorlage herunter, tragen Sie pro Zeile einen Creator-Benutzernamen in die Spalte creator_username ein und laden Sie die Datei hoch (.xlsx, .xls oder .csv).",
  downloadTemplate: "Vorlage herunterladen",
  uploadFile: "Liste hochladen",
  replaceFile: "Liste ersetzen",
  reading: "Datei wird gelesen…",
  readFailed:
    "Die Datei konnte nicht gelesen werden. Laden Sie eine .xlsx-, .xls- oder .csv-Datei hoch.",
  missingColumn:
    "Die erste Zeile muss die Kopfzeile creator_username sein. Verwenden Sie die Vorlage.",
  noRows: "Unter der Kopfzeile stehen keine Benutzernamen.",
  summaryValid: "{{count}} Benutzernamen",
  summaryDuplicates: "{{count}} Duplikate entfernt",
  summaryInvalid: "{{count}} Zeilen sind keine gültigen Benutzernamen",
  invalidRow: "Zeile {{row}}: {{value}}",
  invalidMore: "und {{count}} weitere Zeilen",
  tooMany: "Eine Liste kann höchstens {{max}} Benutzernamen enthalten; diese Datei hat {{count}}.",
  listRequired: "Laden Sie eine Creator-Liste hoch, bevor Sie fortfahren.",
  existingList:
    "Aktuelle Liste: {{total}} Benutzernamen. Ein neuer Upload ersetzt sie; bereits erreichte Creator werden nicht erneut erreicht.",
  lookupNote:
    "Creator, die TikTok bereits kennt, werden sofort zugeordnet. Die übrigen werden nacheinander gesucht, etwa einer alle 2 Minuten pro Shop; die Ergebnisse erscheinen in den Kampagnendetails.",
  template: {
    instructionsSheetName: "Anleitung",
    field: "Feld",
    requirement: "Pflichtangabe",
    instructions: "So füllen Sie es aus",
    example: "Beispiel",
    required: "Erforderlich",
    usernameHint:
      "Ein Creator-Benutzername pro Zeile. Ein führendes @ und eingefügte Profil-Links sind erlaubt. Nur Buchstaben, Ziffern, Punkte und Unterstriche, höchstens 24 Zeichen. Höchstens {{max}} Benutzernamen.",
  },
  confirmTitle: "Creator-Quelle",
  confirmValue: "Creator-Liste · {{count}} Benutzernamen",
  detail: {
    viewList: "Creator-Liste anzeigen",
    hideList: "Creator-Liste ausblenden",
    title: "Fortschritt der Creator-Liste",
    resolved: "Zugeordnet",
    pendingLookup: "Wird gesucht",
    notFound: "Nicht gefunden",
    ambiguous: "Nicht eindeutig",
    lookupFailed: "Suche fehlgeschlagen",
    fed: "An die Ansprache übergeben",
    problemTitle: "Benutzernamen, die nicht zugeordnet werden konnten",
    problemEmpty: "Alle Benutzernamen sind zugeordnet oder werden noch gesucht.",
    loadMore: "Mehr laden",
  },
  status: {
    PENDING_LOOKUP: "Wird gesucht",
    RESOLVED: "Zugeordnet",
    NOT_FOUND: "Nicht gefunden",
    AMBIGUOUS: "Nicht eindeutig",
    LOOKUP_FAILED: "Suche fehlgeschlagen",
  },
  source: {
    IDENTITY_STORE: "Bereits bekannt",
    MARKETPLACE_SEARCH: "Per Suche gefunden",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "Wartet darauf, dass die Creator Ihrer Liste gesucht werden",
    CREATOR_LIST_EXHAUSTED:
      "Alle Creator Ihrer Liste wurden verwendet. Laden Sie weitere Benutzernamen hoch, um fortzufahren.",
  },
  readinessListEmpty: "Die Creator-Liste ist leer. Laden Sie eine Liste hoch, um zu starten.",
  errors: {
    required: "Laden Sie eine Creator-Liste hoch, bevor Sie fortfahren.",
    tooLarge:
      "Die Creator-Liste ist zu groß. Eine Liste kann höchstens 5.000 Benutzernamen enthalten.",
    usernameInvalid: "Einige Benutzernamen sind ungültig: {{rows}}",
    notAllowed:
      "Eine Creator-Liste kann nur verwendet werden, wenn die Kampagne mit der Strategie „Creator-Liste“ erstellt wird.",
    sourceImmutable:
      "Die Auswahl der Creator kann nach dem Erstellen der Kampagne nicht mehr geändert werden.",
  },
};

const es: CreatorListCopy = {
  strategyKicker: "Tu lista",
  strategyTitle: "Lista de creadores",
  strategyDescription:
    "Sube una lista de nombres de usuario de creadores y llega exactamente a esos creadores. No se busca ni se filtra nada.",
  strategyOrder:
    "Los creadores que TikTok ya conoce se emparejan al instante; el resto se busca uno a uno, aproximadamente uno cada 2 minutos por tienda.",
  sectionTitle: "Lista de creadores",
  sectionDescription:
    "Descarga la plantilla, escribe un nombre de usuario de creador por fila en la columna creator_username y sube el archivo (.xlsx, .xls o .csv).",
  downloadTemplate: "Descargar plantilla",
  uploadFile: "Subir lista",
  replaceFile: "Reemplazar lista",
  reading: "Leyendo el archivo…",
  readFailed: "No se pudo leer el archivo. Sube un archivo .xlsx, .xls o .csv.",
  missingColumn: "La primera fila debe ser el encabezado creator_username. Usa la plantilla.",
  noRows: "El archivo no tiene nombres de usuario debajo del encabezado.",
  summaryValid: "{{count}} nombres de usuario",
  summaryDuplicates: "{{count}} duplicados eliminados",
  summaryInvalid: "{{count}} filas no son nombres de usuario válidos",
  invalidRow: "Fila {{row}}: {{value}}",
  invalidMore: "y {{count}} filas más",
  tooMany: "Una lista admite como máximo {{max}} nombres de usuario; este archivo tiene {{count}}.",
  listRequired: "Sube una lista de creadores antes de continuar.",
  existingList:
    "Lista actual: {{total}} nombres de usuario. Al subir un archivo nuevo se reemplaza; los creadores ya contactados no se vuelven a contactar.",
  lookupNote:
    "Los creadores que TikTok ya conoce se emparejan al instante. El resto se busca uno a uno, aproximadamente uno cada 2 minutos por tienda, y los resultados aparecen en los detalles de la campaña.",
  template: {
    instructionsSheetName: "Instrucciones",
    field: "Campo",
    requirement: "Requisito",
    instructions: "Cómo rellenarlo",
    example: "Ejemplo",
    required: "Obligatorio",
    usernameHint:
      "Un nombre de usuario de creador por fila. Se acepta una @ inicial y enlaces de perfil pegados. Solo letras, dígitos, puntos y guiones bajos, hasta 24 caracteres. Como máximo {{max}} nombres de usuario.",
  },
  confirmTitle: "Origen de los creadores",
  confirmValue: "Lista de creadores · {{count}} nombres de usuario",
  detail: {
    viewList: "Ver lista de creadores",
    hideList: "Ocultar lista de creadores",
    title: "Progreso de la lista de creadores",
    resolved: "Emparejados",
    pendingLookup: "En búsqueda",
    notFound: "No encontrados",
    ambiguous: "Ambiguos",
    lookupFailed: "Búsqueda fallida",
    fed: "Enviados a contacto",
    problemTitle: "Nombres de usuario que no se pudieron emparejar",
    problemEmpty: "Todos los nombres de usuario están emparejados o se siguen buscando.",
    loadMore: "Cargar más",
  },
  status: {
    PENDING_LOOKUP: "En búsqueda",
    RESOLVED: "Emparejado",
    NOT_FOUND: "No encontrado",
    AMBIGUOUS: "Ambiguo",
    LOOKUP_FAILED: "Búsqueda fallida",
  },
  source: {
    IDENTITY_STORE: "Ya conocido",
    MARKETPLACE_SEARCH: "Encontrado por búsqueda",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "Esperando a que se busquen los creadores de tu lista",
    CREATOR_LIST_EXHAUSTED:
      "Se han usado todos los creadores de tu lista. Sube más nombres de usuario para continuar.",
  },
  readinessListEmpty: "La lista de creadores está vacía. Sube una lista para empezar.",
  errors: {
    required: "Sube una lista de creadores antes de continuar.",
    tooLarge:
      "La lista de creadores es demasiado grande. Una lista admite como máximo 5.000 nombres de usuario.",
    usernameInvalid: "Algunos nombres de usuario no son válidos: {{rows}}",
    notAllowed:
      "Una lista de creadores solo se puede usar cuando la campaña se crea con la estrategia de lista de creadores.",
    sourceImmutable:
      "La forma de elegir creadores no se puede cambiar después de crear la campaña.",
  },
};

const fr: CreatorListCopy = {
  strategyKicker: "Votre liste",
  strategyTitle: "Liste de créateurs",
  strategyDescription:
    "Importez une liste de noms d’utilisateur de créateurs et contactez exactement ces créateurs. Rien n’est recherché ni filtré.",
  strategyOrder:
    "Les créateurs que TikTok connaît déjà sont associés immédiatement ; les autres sont recherchés un par un, environ un toutes les 2 minutes par boutique.",
  sectionTitle: "Liste de créateurs",
  sectionDescription:
    "Téléchargez le modèle, saisissez un nom d’utilisateur de créateur par ligne dans la colonne creator_username, puis importez le fichier (.xlsx, .xls ou .csv).",
  downloadTemplate: "Télécharger le modèle",
  uploadFile: "Importer la liste",
  replaceFile: "Remplacer la liste",
  reading: "Lecture du fichier…",
  readFailed: "Le fichier n’a pas pu être lu. Importez un fichier .xlsx, .xls ou .csv.",
  missingColumn: "La première ligne doit être l’en-tête creator_username. Utilisez le modèle.",
  noRows: "Le fichier ne contient aucun nom d’utilisateur sous l’en-tête.",
  summaryValid: "{{count}} noms d’utilisateur",
  summaryDuplicates: "{{count}} doublons supprimés",
  summaryInvalid: "{{count}} lignes ne sont pas des noms d’utilisateur valides",
  invalidRow: "Ligne {{row}} : {{value}}",
  invalidMore: "et {{count}} lignes de plus",
  tooMany:
    "Une liste peut contenir au plus {{max}} noms d’utilisateur ; ce fichier en contient {{count}}.",
  listRequired: "Importez une liste de créateurs avant de continuer.",
  existingList:
    "Liste actuelle : {{total}} noms d’utilisateur. Importer un nouveau fichier la remplace ; les créateurs déjà contactés ne le sont pas de nouveau.",
  lookupNote:
    "Les créateurs que TikTok connaît déjà sont associés immédiatement. Les autres sont recherchés un par un, environ un toutes les 2 minutes par boutique, et les résultats apparaissent dans les détails de la campagne.",
  template: {
    instructionsSheetName: "Instructions",
    field: "Champ",
    requirement: "Obligation",
    instructions: "Comment remplir",
    example: "Exemple",
    required: "Obligatoire",
    usernameHint:
      "Un nom d’utilisateur de créateur par ligne. Un @ initial et des liens de profil collés sont acceptés. Lettres, chiffres, points et tirets bas uniquement, 24 caractères au maximum. {{max}} noms d’utilisateur au plus.",
  },
  confirmTitle: "Source des créateurs",
  confirmValue: "Liste de créateurs · {{count}} noms d’utilisateur",
  detail: {
    viewList: "Voir la liste de créateurs",
    hideList: "Masquer la liste de créateurs",
    title: "Avancement de la liste de créateurs",
    resolved: "Associés",
    pendingLookup: "En recherche",
    notFound: "Introuvables",
    ambiguous: "Ambigus",
    lookupFailed: "Recherche échouée",
    fed: "Transmis à la prise de contact",
    problemTitle: "Noms d’utilisateur qui n’ont pas pu être associés",
    problemEmpty: "Tous les noms d’utilisateur sont associés ou encore en cours de recherche.",
    loadMore: "Charger plus",
  },
  status: {
    PENDING_LOOKUP: "En recherche",
    RESOLVED: "Associé",
    NOT_FOUND: "Introuvable",
    AMBIGUOUS: "Ambigu",
    LOOKUP_FAILED: "Recherche échouée",
  },
  source: {
    IDENTITY_STORE: "Déjà connu",
    MARKETPLACE_SEARCH: "Trouvé par recherche",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "En attente de la recherche des créateurs de votre liste",
    CREATOR_LIST_EXHAUSTED:
      "Tous les créateurs de votre liste ont été utilisés. Importez d’autres noms d’utilisateur pour continuer.",
  },
  readinessListEmpty: "La liste de créateurs est vide. Importez une liste pour commencer.",
  errors: {
    required: "Importez une liste de créateurs avant de continuer.",
    tooLarge:
      "La liste de créateurs est trop volumineuse. Une liste peut contenir au plus 5 000 noms d’utilisateur.",
    usernameInvalid: "Certains noms d’utilisateur ne sont pas valides : {{rows}}",
    notAllowed:
      "Une liste de créateurs ne peut être utilisée que si la campagne est créée avec la stratégie de liste de créateurs.",
    sourceImmutable:
      "La façon de choisir les créateurs ne peut plus être modifiée après la création de la campagne.",
  },
};

const id: CreatorListCopy = {
  strategyKicker: "Daftar Anda",
  strategyTitle: "Daftar kreator",
  strategyDescription:
    "Unggah daftar username kreator dan jangkau tepat kreator tersebut. Tidak ada pencarian atau penyaringan.",
  strategyOrder:
    "Kreator yang sudah dikenal TikTok dicocokkan seketika; sisanya dicari satu per satu, sekitar satu setiap 2 menit per toko.",
  sectionTitle: "Daftar kreator",
  sectionDescription:
    "Unduh templat, isi satu username kreator per baris pada kolom creator_username, lalu unggah file (.xlsx, .xls, atau .csv).",
  downloadTemplate: "Unduh templat",
  uploadFile: "Unggah daftar",
  replaceFile: "Ganti daftar",
  reading: "Membaca file…",
  readFailed: "File tidak dapat dibaca. Unggah file .xlsx, .xls, atau .csv.",
  missingColumn: "Baris pertama harus berupa header creator_username. Gunakan templat.",
  noRows: "File tidak memiliki username di bawah header.",
  summaryValid: "{{count}} username",
  summaryDuplicates: "{{count}} duplikat dihapus",
  summaryInvalid: "{{count}} baris bukan username yang valid",
  invalidRow: "Baris {{row}}: {{value}}",
  invalidMore: "dan {{count}} baris lainnya",
  tooMany: "Satu daftar maksimal berisi {{max}} username; file ini berisi {{count}}.",
  listRequired: "Unggah daftar kreator sebelum melanjutkan.",
  existingList:
    "Daftar saat ini: {{total}} username. Mengunggah file baru akan menggantinya; kreator yang sudah dihubungi tidak dihubungi lagi.",
  lookupNote:
    "Kreator yang sudah dikenal TikTok dicocokkan seketika. Sisanya dicari satu per satu, sekitar satu setiap 2 menit per toko, dan hasilnya muncul di detail kampanye.",
  template: {
    instructionsSheetName: "Petunjuk",
    field: "Kolom",
    requirement: "Persyaratan",
    instructions: "Cara mengisi",
    example: "Contoh",
    required: "Wajib",
    usernameHint:
      "Satu username kreator per baris. @ di depan dan tautan profil yang ditempel diterima. Hanya huruf, angka, titik, dan garis bawah, maksimal 24 karakter. Maksimal {{max}} username.",
  },
  confirmTitle: "Sumber kreator",
  confirmValue: "Daftar kreator · {{count}} username",
  detail: {
    viewList: "Lihat daftar kreator",
    hideList: "Sembunyikan daftar kreator",
    title: "Progres daftar kreator",
    resolved: "Cocok",
    pendingLookup: "Sedang dicari",
    notFound: "Tidak ditemukan",
    ambiguous: "Ambigu",
    lookupFailed: "Pencarian gagal",
    fed: "Diteruskan ke penjangkauan",
    problemTitle: "Username yang tidak dapat dicocokkan",
    problemEmpty: "Semua username sudah cocok atau masih dicari.",
    loadMore: "Muat lebih banyak",
  },
  status: {
    PENDING_LOOKUP: "Sedang dicari",
    RESOLVED: "Cocok",
    NOT_FOUND: "Tidak ditemukan",
    AMBIGUOUS: "Ambigu",
    LOOKUP_FAILED: "Pencarian gagal",
  },
  source: {
    IDENTITY_STORE: "Sudah dikenal",
    MARKETPLACE_SEARCH: "Ditemukan lewat pencarian",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "Menunggu kreator dalam daftar Anda selesai dicari",
    CREATOR_LIST_EXHAUSTED:
      "Semua kreator dalam daftar Anda sudah digunakan. Unggah lebih banyak username untuk melanjutkan.",
  },
  readinessListEmpty: "Daftar kreator kosong. Unggah daftar untuk memulai.",
  errors: {
    required: "Unggah daftar kreator sebelum melanjutkan.",
    tooLarge: "Daftar kreator terlalu besar. Satu daftar maksimal berisi 5.000 username.",
    usernameInvalid: "Beberapa username tidak valid: {{rows}}",
    notAllowed:
      "Daftar kreator hanya dapat digunakan jika kampanye dibuat dengan strategi daftar kreator.",
    sourceImmutable: "Cara memilih kreator tidak dapat diubah setelah kampanye dibuat.",
  },
};

const it: CreatorListCopy = {
  strategyKicker: "La tua lista",
  strategyTitle: "Elenco creator",
  strategyDescription:
    "Carica un elenco di nomi utente di creator e raggiungi esattamente quei creator. Non viene cercato né filtrato nulla.",
  strategyOrder:
    "I creator che TikTok conosce già vengono abbinati subito; gli altri vengono cercati uno alla volta, circa uno ogni 2 minuti per negozio.",
  sectionTitle: "Elenco creator",
  sectionDescription:
    "Scarica il modello, inserisci un nome utente di creator per riga nella colonna creator_username e carica il file (.xlsx, .xls o .csv).",
  downloadTemplate: "Scarica il modello",
  uploadFile: "Carica elenco",
  replaceFile: "Sostituisci elenco",
  reading: "Lettura del file…",
  readFailed: "Impossibile leggere il file. Carica un file .xlsx, .xls o .csv.",
  missingColumn: "La prima riga deve essere l’intestazione creator_username. Usa il modello.",
  noRows: "Il file non contiene nomi utente sotto l’intestazione.",
  summaryValid: "{{count}} nomi utente",
  summaryDuplicates: "{{count}} duplicati rimossi",
  summaryInvalid: "{{count}} righe non sono nomi utente validi",
  invalidRow: "Riga {{row}}: {{value}}",
  invalidMore: "e altre {{count}} righe",
  tooMany:
    "Un elenco può contenere al massimo {{max}} nomi utente; questo file ne contiene {{count}}.",
  listRequired: "Carica un elenco di creator prima di continuare.",
  existingList:
    "Elenco attuale: {{total}} nomi utente. Caricare un nuovo file lo sostituisce; i creator già contattati non vengono contattati di nuovo.",
  lookupNote:
    "I creator che TikTok conosce già vengono abbinati subito. Gli altri vengono cercati uno alla volta, circa uno ogni 2 minuti per negozio, e i risultati compaiono nei dettagli della campagna.",
  template: {
    instructionsSheetName: "Istruzioni",
    field: "Campo",
    requirement: "Requisito",
    instructions: "Come compilare",
    example: "Esempio",
    required: "Obbligatorio",
    usernameHint:
      "Un nome utente di creator per riga. Sono accettati una @ iniziale e i link al profilo incollati. Solo lettere, cifre, punti e trattini bassi, fino a 24 caratteri. Al massimo {{max}} nomi utente.",
  },
  confirmTitle: "Origine dei creator",
  confirmValue: "Elenco creator · {{count}} nomi utente",
  detail: {
    viewList: "Mostra elenco creator",
    hideList: "Nascondi elenco creator",
    title: "Avanzamento dell’elenco creator",
    resolved: "Abbinati",
    pendingLookup: "In ricerca",
    notFound: "Non trovati",
    ambiguous: "Ambigui",
    lookupFailed: "Ricerca non riuscita",
    fed: "Passati al contatto",
    problemTitle: "Nomi utente che non è stato possibile abbinare",
    problemEmpty: "Tutti i nomi utente sono stati abbinati o sono ancora in ricerca.",
    loadMore: "Carica altri",
  },
  status: {
    PENDING_LOOKUP: "In ricerca",
    RESOLVED: "Abbinato",
    NOT_FOUND: "Non trovato",
    AMBIGUOUS: "Ambiguo",
    LOOKUP_FAILED: "Ricerca non riuscita",
  },
  source: {
    IDENTITY_STORE: "Già noto",
    MARKETPLACE_SEARCH: "Trovato con la ricerca",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "In attesa della ricerca dei creator del tuo elenco",
    CREATOR_LIST_EXHAUSTED:
      "Tutti i creator del tuo elenco sono stati utilizzati. Carica altri nomi utente per continuare.",
  },
  readinessListEmpty: "L’elenco creator è vuoto. Carica un elenco per iniziare.",
  errors: {
    required: "Carica un elenco di creator prima di continuare.",
    tooLarge:
      "L’elenco creator è troppo grande. Un elenco può contenere al massimo 5.000 nomi utente.",
    usernameInvalid: "Alcuni nomi utente non sono validi: {{rows}}",
    notAllowed:
      "Un elenco creator può essere usato solo se la campagna è creata con la strategia elenco creator.",
    sourceImmutable:
      "Il modo di scegliere i creator non può essere modificato dopo la creazione della campagna.",
  },
};

const th: CreatorListCopy = {
  strategyKicker: "รายชื่อของคุณ",
  strategyTitle: "รายชื่อครีเอเตอร์",
  strategyDescription:
    "อัปโหลดรายชื่อผู้ใช้ของครีเอเตอร์ แล้วติดต่อเฉพาะครีเอเตอร์เหล่านั้นเท่านั้น ไม่มีการค้นหาหรือกรอง",
  strategyOrder: "ครีเอเตอร์ที่ TikTok รู้จักอยู่แล้วจะจับคู่ทันที ที่เหลือจะค้นหาทีละราย ประมาณ 1 รายทุก 2 นาทีต่อร้านค้า",
  sectionTitle: "รายชื่อครีเอเตอร์",
  sectionDescription:
    "ดาวน์โหลดเทมเพลต กรอกชื่อผู้ใช้ครีเอเตอร์ 1 รายต่อ 1 แถวในคอลัมน์ creator_username แล้วอัปโหลดไฟล์ (.xlsx, .xls หรือ .csv)",
  downloadTemplate: "ดาวน์โหลดเทมเพลต",
  uploadFile: "อัปโหลดรายชื่อ",
  replaceFile: "แทนที่รายชื่อ",
  reading: "กำลังอ่านไฟล์…",
  readFailed: "ไม่สามารถอ่านไฟล์ได้ กรุณาอัปโหลดไฟล์ .xlsx, .xls หรือ .csv",
  missingColumn: "แถวแรกต้องเป็นหัวคอลัมน์ creator_username กรุณาใช้เทมเพลต",
  noRows: "ไม่มีชื่อผู้ใช้ใต้หัวคอลัมน์ในไฟล์",
  summaryValid: "{{count}} ชื่อผู้ใช้",
  summaryDuplicates: "ลบรายการซ้ำแล้ว {{count}} รายการ",
  summaryInvalid: "{{count}} แถวไม่ใช่ชื่อผู้ใช้ที่ถูกต้อง",
  invalidRow: "แถว {{row}}: {{value}}",
  invalidMore: "และอีก {{count}} แถว",
  tooMany: "รายชื่อใส่ได้สูงสุด {{max}} ชื่อผู้ใช้ แต่ไฟล์นี้มี {{count}}",
  listRequired: "กรุณาอัปโหลดรายชื่อครีเอเตอร์ก่อนดำเนินการต่อ",
  existingList:
    "รายชื่อปัจจุบัน: {{total}} ชื่อผู้ใช้ การอัปโหลดไฟล์ใหม่จะแทนที่รายชื่อนี้ ครีเอเตอร์ที่ติดต่อไปแล้วจะไม่ถูกติดต่อซ้ำ",
  lookupNote:
    "ครีเอเตอร์ที่ TikTok รู้จักอยู่แล้วจะจับคู่ทันที ที่เหลือจะค้นหาทีละราย ประมาณ 1 รายทุก 2 นาทีต่อร้านค้า และผลลัพธ์จะแสดงในรายละเอียดแคมเปญ",
  template: {
    instructionsSheetName: "คำแนะนำ",
    field: "ฟิลด์",
    requirement: "ข้อกำหนด",
    instructions: "วิธีกรอก",
    example: "ตัวอย่าง",
    required: "จำเป็น",
    usernameHint:
      "ชื่อผู้ใช้ครีเอเตอร์ 1 รายต่อ 1 แถว รองรับ @ นำหน้าและลิงก์โปรไฟล์ที่วาง ใช้ได้เฉพาะตัวอักษร ตัวเลข จุด และขีดล่าง ยาวไม่เกิน 24 ตัวอักษร สูงสุด {{max}} ชื่อผู้ใช้",
  },
  confirmTitle: "แหล่งที่มาของครีเอเตอร์",
  confirmValue: "รายชื่อครีเอเตอร์ · {{count}} ชื่อผู้ใช้",
  detail: {
    viewList: "ดูรายชื่อครีเอเตอร์",
    hideList: "ซ่อนรายชื่อครีเอเตอร์",
    title: "ความคืบหน้าของรายชื่อครีเอเตอร์",
    resolved: "จับคู่แล้ว",
    pendingLookup: "กำลังค้นหา",
    notFound: "ไม่พบ",
    ambiguous: "ไม่ชัดเจน",
    lookupFailed: "ค้นหาไม่สำเร็จ",
    fed: "ส่งเข้าสู่การติดต่อแล้ว",
    problemTitle: "ชื่อผู้ใช้ที่จับคู่ไม่ได้",
    problemEmpty: "ทุกชื่อผู้ใช้จับคู่แล้วหรือยังอยู่ระหว่างการค้นหา",
    loadMore: "โหลดเพิ่ม",
  },
  status: {
    PENDING_LOOKUP: "กำลังค้นหา",
    RESOLVED: "จับคู่แล้ว",
    NOT_FOUND: "ไม่พบ",
    AMBIGUOUS: "ไม่ชัดเจน",
    LOOKUP_FAILED: "ค้นหาไม่สำเร็จ",
  },
  source: {
    IDENTITY_STORE: "รู้จักอยู่แล้ว",
    MARKETPLACE_SEARCH: "พบจากการค้นหา",
  },
  stopReason: {
    WAITING_FOR_CREATOR_LIST_LOOKUP: "กำลังรอให้ค้นหาครีเอเตอร์ในรายชื่อของคุณ",
    CREATOR_LIST_EXHAUSTED: "ครีเอเตอร์ในรายชื่อของคุณถูกใช้ครบแล้ว อัปโหลดชื่อผู้ใช้เพิ่มเพื่อดำเนินการต่อ",
  },
  readinessListEmpty: "รายชื่อครีเอเตอร์ว่างเปล่า กรุณาอัปโหลดรายชื่อเพื่อเริ่มต้น",
  errors: {
    required: "กรุณาอัปโหลดรายชื่อครีเอเตอร์ก่อนดำเนินการต่อ",
    tooLarge: "รายชื่อครีเอเตอร์ใหญ่เกินไป รายชื่อใส่ได้สูงสุด 5,000 ชื่อผู้ใช้",
    usernameInvalid: "ชื่อผู้ใช้บางรายการไม่ถูกต้อง: {{rows}}",
    notAllowed: "ใช้รายชื่อครีเอเตอร์ได้เฉพาะเมื่อสร้างแคมเปญด้วยกลยุทธ์รายชื่อครีเอเตอร์เท่านั้น",
    sourceImmutable: "ไม่สามารถเปลี่ยนวิธีเลือกครีเอเตอร์ได้หลังจากสร้างแคมเปญแล้ว",
  },
};

export const campaignCreatorListCopy = { en, zh, de, es, fr, id, it, th } as const;
