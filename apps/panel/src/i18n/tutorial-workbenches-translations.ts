import type { SupportedLanguageCode } from "./languages.js";

/** September 22 audit: split workbenches, time ranges, knowledge media and seller metadata. */
const en = {
  tutorial: {
    ecommerceAffiliateAttention: {
      welcomeTitle: "Agent workbench",
      welcomeBody:
        "Review Agent proposals and staff escalations here. Sample applications and creator conversations now have their own Manual Workbench page.",
      scopeTitle: "Three Agent views",
      scopeBody:
        "Switch between pending Agent work, staff escalations, and all Agent work. This tour visits each view and returns to pending work.",
      filtersBody:
        "Filter proposals by owner, action type, and text; All Agent Work also offers status. Escalations share owner, text, and time filters. Shop filtering belongs to the Manual Workbench.",
      agentTimeTitle: "When Agent work was created",
      agentTimeBody:
        "All time is the default. Presets or a custom date range filter proposal and escalation creation time, not completion time. The range is shared across the three Agent tabs; enter both dates for a custom range.",
      manualWelcomeTitle: "Manual workbench",
      manualWelcomeBody:
        "Handle sample applications and conversations directly, separately from Agent proposals. This tour only switches views; it does not approve samples or send messages.",
      manualScopeTitle: "Samples and conversations",
      manualScopeBody:
        "Use Samples for application reviews and Messages for creators awaiting a reply. Each queue has its own filters and ordering. The tour returns to Samples when finished.",
      samplesBody:
        "Search shops and filter by review status, protection, owner, product, or creator. Open an application to check the applied SKU, stock, and performance before deciding; sorting is separate from filtering.",
      sampleTimeTitle: "When an application was first observed",
      sampleTimeBody:
        "This range uses first-observed time, not the platform application date. It defaults to all time. Choose a preset or both custom dates, then sort oldest or newest first.",
      messagesBody:
        "Choose a channel, owner, protection, or creator; shop filtering is available for TikTok Shop. Channel badges count the whole pending queue, not just the filtered results. Open a conversation to review context before replying.",
      messageTimeTitle: "When a conversation last became pending",
      messageTimeBody:
        "This range uses the latest pending-message time, not conversation creation time. All time is the default; choose a preset or both custom dates. Waiting-time sorting is a separate control.",
    },
    productKnowledge: {
      libraryBody:
        "Search active or archived records and compare content coverage and linked products. Open a row for rich-text editing and SKU discovery. The next detail steps need an existing record; an empty library is not populated by this tour.",
      contentTitle: "Rich text, images, and videos",
      contentBody:
        "Switch between instructions, Q&A, and creative cases. Paste Markdown or use formatting, image upload, and video upload controls; long sections scroll inside the editor. Save text changes explicitly. Archived records are read-only; this tour makes no edits or uploads.",
      bindingsTitle: "Find products across shops",
      bindingsBody:
        "For active records, enter multiple Seller SKUs separated by commas. Review matches, unmatched SKUs, and shop failures before selecting products to link. Linking and unlinking are separate actions; the tour does neither and closes the detail it opened.",
    },
    ecommerceAffiliateTeam: {
      assignmentsBody:
        "Download the current template and read its Instructions sheet. Identify creators by username; keep UID notes as text. Bulk updates support owners, protection, seller notes, and existing manual tags only. Preview every row and any overwrite effects before importing; unknown tags must be created in the catalog first.",
    },
    ecommerceAffiliateCreators: {
      resultsBody:
        "Open a creator and verify the all-shop or single-shop scope before acting. The header now supports a seller-provided UID note; Management contains the seller note alongside ownership and tags. Save these edits explicitly; they can also be managed through Team bulk updates.",
    },
    ecommerceAffiliateCampaign: {
      wizardStagesBody:
        "The stages cover products, targeting, outreach, and authorization. Targeting highlights invalid daily capacity, duration, contact email, or search guidance after Next. Fix the indicated field before continuing. Outreach supports invitation plus message or invitation only; this tour leaves the draft unsaved.",
      detailOperationsBody:
        "Compare discovery conditions, including numeric ranges, then inspect campaign creators or the sent funnel view. Qualification, invitation delivery, and creator responses are distinct results. Review them separately before changing the plan.",
    },
    ecommerceAffiliateIntelligence: {
      scopesBody:
        "Search shops by name, alias, or ID, or choose the account model. Scope cards report readiness, fallback, or missing evidence. Choose the scope before comparing model and human decisions.",
    },
    ecommerce: {
      connectFlowBody:
        "Choose the platform app, market (including Japan), and seller type before authorization. The app determines the OAuth flow. This tour only opens the form; it does not connect a shop.",
    },
  },
};

export const TUTORIAL_WORKBENCHES_TRANSLATIONS: Record<SupportedLanguageCode, typeof en> = {
  en,
  zh: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "Agent 工作台",
        welcomeBody:
          "在这里审核 Agent 提案和处理人工升级事项。样品申请和达人会话已移到独立的「人工工作台」页面。",
        scopeTitle: "三个 Agent 视图",
        scopeBody:
          "切换待处理 Agent 工作、人工升级事项和全部 Agent 工作。本教程依次介绍，并在结束后返回待处理视图。",
        filtersBody:
          "按负责人、动作类型和文字筛选提案；全部 Agent 工作还支持状态筛选。升级事项共用负责人、文字及时间筛选，店铺筛选位于人工工作台。",
        agentTimeTitle: "按工作创建时间筛选",
        agentTimeBody:
          "默认不限时间。预设或自定义日期筛选的是提案、升级事项的创建时间，而非完成时间。三个 Agent 标签页共用所选范围；自定义时请填齐起止日期。",
        manualWelcomeTitle: "人工工作台",
        manualWelcomeBody:
          "直接处理样品申请和达人会话，与 Agent 提案分开管理。本教程仅切换视图，不审批样品，也不发送消息。",
        manualScopeTitle: "样品与会话",
        manualScopeBody:
          "在样品页审核申请，在消息页查看等待回复的达人。两个队列各有筛选和排序，教程结束后回到样品页。",
        samplesBody:
          "搜索店铺，按审核状态、保护状态、负责人、商品或达人筛选。打开申请后，核对达人申请的 SKU、库存和表现再决定；排序与筛选相互独立。",
        sampleTimeTitle: "按首次观测时间筛选",
        sampleTimeBody:
          "这里使用申请首次被系统观测到的时间，而不是平台申请日期。默认不限时间；可选预设或填齐自定义起止日期，再按时间从早到晚或从晚到早排序。",
        messagesBody:
          "按渠道、负责人、保护状态或达人筛选；TikTok Shop 渠道还可选店铺。渠道数字是整个待回复队列的数量，不是筛选结果数。回复前先打开会话核对上下文。",
        messageTimeTitle: "按最近待回复时间筛选",
        messageTimeBody:
          "这里使用最近待回复消息的时间，而不是会话创建时间。默认不限时间，可选预设或填齐自定义起止日期；等待时间排序是独立的控制项。",
      },
      productKnowledge: {
        libraryBody:
          "搜索使用中或已归档的记录，比较内容覆盖率和关联商品数。打开一行可编辑富文本和按 SKU 查找商品。后续详情步骤需要现有记录；空知识库不会被教程自动填充。",
        contentTitle: "富文本、图片和视频",
        contentBody:
          "切换说明书、问答和创意案例，粘贴 Markdown，或使用格式、上传图片和上传视频工具。长内容在编辑器内滚动，文字修改需主动保存。归档记录只读；教程不编辑、不上传。",
        bindingsTitle: "跨店铺查找商品",
        bindingsBody:
          "使用中的记录可输入多个 Seller SKU，以逗号分隔。核对匹配结果、未匹配 SKU 和店铺失败提示后，再选择商品关联。关联和解除关联是独立操作；教程不执行，并会关闭自己打开的详情。",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "下载最新版模板并阅读说明工作表。用用户名识别达人，UID 备注保持文本格式。批量更新支持负责人、保护、商家备注及已有手动标签；导入前逐行预览并核对覆盖影响，未知标签需先在目录中创建。",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "打开达人后先确认全部店铺或单店范围。详情顶部可填写商家自有 UID 备注，「管理」中可维护商家备注、归属和标签。修改需主动保存，也可通过团队页批量更新。",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "四个阶段是商品、目标筛选、触达和授权。目标阶段点击下一步后，会指出每日容量、持续天数、联系邮箱或搜索指引的无效字段；修正后再继续。触达支持定邀加私信或仅定邀；教程不会保存草稿。",
        detailOperationsBody:
          "比较包含数值区间的搜索条件，再查看计划达人或漏斗中的已发送视图。资格判断、定邀送达和达人反馈是不同结果，调整计划前请分别核对。",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "按店铺名、别名或 ID 搜索店铺，也可选择账号模型。范围卡片显示就绪、回退或证据不足状态；先选定范围，再比较模型与人工决策。",
      },
      ecommerce: {
        connectFlowBody:
          "授权前选择平台应用、市场（含日本）和卖家类型，所选应用决定 OAuth 流程。本教程只打开表单，不执行店铺连接。",
      },
    },
  },
  de: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "Agent-Arbeitsbereich",
        welcomeBody:
          "Prüfen Sie hier Agent-Vorschläge und Eskalationen an Mitarbeiter. Musteranträge und Creator-Gespräche befinden sich jetzt im separaten manuellen Arbeitsbereich.",
        scopeTitle: "Drei Agent-Ansichten",
        scopeBody:
          "Wechseln Sie zwischen offenen Aufgaben, Eskalationen und allen Agent-Aufgaben. Die Tour besucht jede Ansicht und kehrt zu den offenen Aufgaben zurück.",
        filtersBody:
          "Filtern Sie Vorschläge nach Zuständigkeit, Aktion und Text; alle Aufgaben zusätzlich nach Status. Eskalationen teilen Zuständigkeits-, Text- und Zeitfilter. Shopfilter finden Sie im manuellen Arbeitsbereich.",
        agentTimeTitle: "Erstellungszeit der Agent-Aufgabe",
        agentTimeBody:
          "Standard ist der gesamte Zeitraum. Voreinstellungen oder eigene Daten filtern die Erstellung von Vorschlägen und Eskalationen, nicht deren Abschluss. Alle drei Tabs teilen den Zeitraum. Geben Sie bei eigener Auswahl beide Daten an.",
        manualWelcomeTitle: "Manueller Arbeitsbereich",
        manualWelcomeBody:
          "Bearbeiten Sie Musteranträge und Gespräche getrennt von Agent-Vorschlägen. Diese Tour wechselt nur Ansichten; sie genehmigt keine Muster und sendet keine Nachrichten.",
        manualScopeTitle: "Muster und Gespräche",
        manualScopeBody:
          "Muster zeigt Anträge, Nachrichten zeigt Creator, die auf Antwort warten. Beide Listen haben eigene Filter und Sortierungen. Die Tour kehrt zum Muster-Tab zurück.",
        samplesBody:
          "Suchen Sie Shops und filtern Sie nach Prüfstatus, Schutz, Zuständigkeit, Produkt oder Creator. Prüfen Sie im Antrag die beantragte SKU, Bestand und Leistung vor einer Entscheidung. Sortierung und Filter sind getrennt.",
        sampleTimeTitle: "Erste Beobachtung des Antrags",
        sampleTimeBody:
          "Dieser Zeitraum bezieht sich auf die erste Beobachtung durch das System, nicht das Antragsdatum der Plattform. Standard ist der gesamte Zeitraum. Wählen Sie eine Vorgabe oder beide Daten; sortieren Sie anschließend auf- oder absteigend.",
        messagesBody:
          "Wählen Sie Kanal, Zuständigkeit, Schutz oder Creator; Shopfilter gibt es für TikTok Shop. Kanalzahlen zählen die gesamte offene Warteschlange, nicht die gefilterte Liste. Prüfen Sie den Gesprächskontext vor einer Antwort.",
        messageTimeTitle: "Letzte ausstehende Nachricht",
        messageTimeBody:
          "Der Zeitraum bezieht sich auf die letzte ausstehende Nachricht, nicht auf die Erstellung des Gesprächs. Standard ist der gesamte Zeitraum; wählen Sie eine Vorgabe oder beide Daten. Die Wartezeit-Sortierung ist unabhängig.",
      },
      productKnowledge: {
        libraryBody:
          "Suchen Sie aktive oder archivierte Einträge und vergleichen Sie Inhaltsabdeckung und verknüpfte Produkte. Eine Zeile öffnet Editor und SKU-Suche. Die folgenden Details benötigen einen vorhandenen Eintrag; die Tour erstellt keinen.",
        contentTitle: "Rich Text, Bilder und Videos",
        contentBody:
          "Wechseln Sie zwischen Anleitungen, Fragen und Antworten sowie Kreativbeispielen. Fügen Sie Markdown ein oder nutzen Sie Formatierung und Bild-/Video-Upload. Lange Inhalte scrollen im Editor. Speichern Sie Textänderungen ausdrücklich. Archive sind schreibgeschützt; die Tour ändert und lädt nichts hoch.",
        bindingsTitle: "Produkte shopübergreifend finden",
        bindingsBody:
          "Geben Sie bei aktiven Einträgen mehrere Seller-SKUs durch Kommas getrennt ein. Prüfen Sie Treffer, fehlende SKUs und Shopfehler vor dem Verknüpfen. Verknüpfen und Trennen sind separate Aktionen; die Tour führt sie nicht aus und schließt selbst geöffnete Details.",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "Laden Sie die aktuelle Vorlage und lesen Sie das Anleitungsblatt. Identifizieren Sie Creator per Benutzername; UID-Notizen bleiben Text. Massenupdates unterstützen Zuständigkeit, Schutz, Verkäufernotizen und nur bestehende manuelle Tags. Prüfen Sie Zeilen und Überschreibungen vor dem Import; neue Tags zuerst im Katalog anlegen.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Prüfen Sie im Creator den Bereich aller Shops oder eines Shops. Im Kopf steht jetzt die eigene UID-Notiz; unter Verwaltung finden Sie Verkäufernotizen, Zuständigkeit und Tags. Änderungen ausdrücklich speichern oder über Team-Massenupdates verwalten.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Die Phasen umfassen Produkte, Zielgruppe, Kontakt und Freigabe. Nach Weiter markiert die Zielgruppenphase ungültige Tageskapazität, Dauer, Kontakt-E-Mail oder Suchhinweise. Korrigieren Sie diese zuerst. Kontakt erlaubt Einladung mit Nachricht oder nur Einladung; die Tour speichert keinen Entwurf.",
        detailOperationsBody:
          "Vergleichen Sie Suchbedingungen einschließlich Zahlenbereichen und prüfen Sie Creator oder gesendete Einladungen im Trichter. Eignung, Zustellung und Creator-Antwort sind getrennte Ergebnisse. Prüfen Sie sie vor Planänderungen einzeln.",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "Suchen Sie Shops nach Name, Alias oder ID oder wählen Sie das Kontomodell. Karten zeigen Bereitschaft, Rückfallmodell oder fehlende Belege. Wählen Sie den Bereich vor dem Vergleich von Modell und Mensch.",
      },
      ecommerce: {
        connectFlowBody:
          "Wählen Sie Plattform-App, Markt (einschließlich Japan) und Verkäufertyp vor der Autorisierung. Die App bestimmt den OAuth-Ablauf. Die Tour öffnet nur das Formular und verbindet keinen Shop.",
      },
    },
  },
  es: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "Área de trabajo del Agent",
        welcomeBody:
          "Revisa propuestas del Agent y escalaciones al personal. Las solicitudes de muestras y conversaciones ahora tienen su propia área de trabajo manual.",
        scopeTitle: "Tres vistas del Agent",
        scopeBody:
          "Alterna entre trabajo pendiente, escalaciones y todo el trabajo del Agent. El recorrido visita cada vista y vuelve a los pendientes.",
        filtersBody:
          "Filtra propuestas por responsable, acción y texto; la vista completa también por estado. Las escalaciones comparten filtros de responsable, texto y tiempo. El filtro de tienda está en el área manual.",
        agentTimeTitle: "Fecha de creación del trabajo",
        agentTimeBody:
          "Por defecto se incluye todo el tiempo. Los periodos filtran la creación de propuestas y escalaciones, no su finalización. Las tres pestañas comparten el periodo; introduce ambas fechas si es personalizado.",
        manualWelcomeTitle: "Área de trabajo manual",
        manualWelcomeBody:
          "Gestiona muestras y conversaciones directamente, separadas de las propuestas del Agent. El recorrido solo cambia de vista; no aprueba muestras ni envía mensajes.",
        manualScopeTitle: "Muestras y conversaciones",
        manualScopeBody:
          "Muestras permite revisar solicitudes y Mensajes muestra creadores pendientes de respuesta. Cada cola tiene sus filtros y ordenación. El recorrido vuelve a Muestras al terminar.",
        samplesBody:
          "Busca tiendas y filtra por estado de revisión, protección, responsable, producto o creador. Abre una solicitud para comprobar el SKU solicitado, existencias y rendimiento antes de decidir. Ordenar y filtrar son controles distintos.",
        sampleTimeTitle: "Primera observación de la solicitud",
        sampleTimeBody:
          "El periodo usa la primera observación del sistema, no la fecha de solicitud de la plataforma. Por defecto incluye todo el tiempo. Elige un periodo o ambas fechas y ordena de más antiguo a más reciente o al revés.",
        messagesBody:
          "Elige canal, responsable, protección o creador; TikTok Shop permite filtrar por tienda. Los contadores abarcan toda la cola pendiente, no solo los resultados filtrados. Revisa el contexto antes de responder.",
        messageTimeTitle: "Último mensaje pendiente",
        messageTimeBody:
          "El periodo usa la fecha del último mensaje pendiente, no la creación de la conversación. Por defecto incluye todo el tiempo; elige un periodo o ambas fechas. La ordenación por espera es independiente.",
      },
      productKnowledge: {
        libraryBody:
          "Busca registros activos o archivados y compara cobertura y productos vinculados. Abre una fila para editar texto enriquecido y buscar SKUs. Los siguientes pasos requieren un registro existente; el recorrido no crea ninguno.",
        contentTitle: "Texto enriquecido, imágenes y vídeos",
        contentBody:
          "Alterna entre instrucciones, preguntas y respuestas y ejemplos creativos. Pega Markdown o usa formato y carga de imágenes o vídeos. El contenido largo se desplaza dentro del editor. Guarda los cambios de texto explícitamente. Los archivos son de solo lectura; el recorrido no edita ni sube archivos.",
        bindingsTitle: "Buscar productos entre tiendas",
        bindingsBody:
          "En registros activos, introduce varios Seller SKU separados por comas. Revisa coincidencias, SKUs sin resultado y errores de tiendas antes de vincular. Vincular y desvincular son acciones independientes; el recorrido no las ejecuta y cierra los detalles que abrió.",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "Descarga la plantilla actual y lee su hoja de instrucciones. Identifica creadores por usuario y conserva las notas UID como texto. La actualización masiva admite responsables, protección, notas y solo etiquetas existentes. Revisa filas y sobrescrituras antes de importar; crea primero las etiquetas desconocidas en el catálogo.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Abre un creador y confirma el alcance de todas las tiendas o una sola. La cabecera admite una nota UID propia; Gestión incluye notas del vendedor, responsable y etiquetas. Guarda explícitamente o gestiona estos datos mediante actualizaciones masivas en Equipo.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Las fases cubren productos, segmentación, contacto y autorización. Al pulsar Siguiente, la segmentación señala capacidad diaria, duración, correo o instrucciones de búsqueda inválidos. Corrígelos antes de continuar. Puedes enviar invitación con mensaje o solo invitación; el recorrido no guarda el borrador.",
        detailOperationsBody:
          "Compara condiciones de búsqueda, incluidos intervalos numéricos, y revisa creadores o envíos del embudo. La elegibilidad, entrega de invitaciones y respuesta son resultados distintos. Revísalos por separado antes de cambiar el plan.",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "Busca tiendas por nombre, alias o ID, o elige el modelo de cuenta. Las tarjetas indican disponibilidad, alternativa o falta de evidencia. Elige el alcance antes de comparar modelo y decisiones humanas.",
      },
      ecommerce: {
        connectFlowBody:
          "Elige aplicación, mercado (incluido Japón) y tipo de vendedor antes de autorizar. La aplicación determina el flujo OAuth. El recorrido solo abre el formulario; no conecta tiendas.",
      },
    },
  },
  fr: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "Espace de travail Agent",
        welcomeBody:
          "Examinez ici les propositions de l’Agent et les escalades au personnel. Les demandes d’échantillons et les conversations disposent désormais d’un espace manuel distinct.",
        scopeTitle: "Trois vues Agent",
        scopeBody:
          "Passez des tâches en attente aux escalades ou à toutes les tâches. Le guide visite chaque vue, puis revient aux tâches en attente.",
        filtersBody:
          "Filtrez les propositions par responsable, action et texte, et aussi par statut dans la vue complète. Les escalades partagent les filtres responsable, texte et période. Le filtre boutique se trouve dans l’espace manuel.",
        agentTimeTitle: "Date de création du travail",
        agentTimeBody:
          "Par défaut, toutes les dates sont incluses. La période filtre la création des propositions et escalades, pas leur clôture. Les trois onglets partagent la période ; renseignez les deux dates pour une plage personnalisée.",
        manualWelcomeTitle: "Espace de travail manuel",
        manualWelcomeBody:
          "Traitez directement les demandes d’échantillons et les conversations, séparément des propositions de l’Agent. Ce guide change seulement de vue : aucune approbation ni aucun envoi de message.",
        manualScopeTitle: "Échantillons et conversations",
        manualScopeBody:
          "Échantillons sert aux demandes et Messages aux créateurs attendant une réponse. Chaque file possède ses filtres et son tri. Le guide revient à Échantillons à la fin.",
        samplesBody:
          "Recherchez des boutiques et filtrez par statut, protection, responsable, produit ou créateur. Ouvrez une demande pour vérifier le SKU demandé, le stock et les performances avant de décider. Le tri est distinct des filtres.",
        sampleTimeTitle: "Première observation de la demande",
        sampleTimeBody:
          "Cette période utilise la première observation par le système, pas la date de demande sur la plateforme. Toutes les dates sont incluses par défaut. Choisissez une période ou deux dates, puis triez dans l’ordre souhaité.",
        messagesBody:
          "Choisissez canal, responsable, protection ou créateur ; TikTok Shop permet aussi le filtre boutique. Les compteurs concernent toute la file en attente, pas les seuls résultats filtrés. Lisez le contexte avant de répondre.",
        messageTimeTitle: "Dernier message en attente",
        messageTimeBody:
          "La période utilise la date du dernier message en attente, pas la création de la conversation. Toutes les dates sont incluses par défaut ; choisissez une période ou deux dates. Le tri par attente reste indépendant.",
      },
      productKnowledge: {
        libraryBody:
          "Recherchez les fiches actives ou archivées et comparez couverture et produits liés. Ouvrez une ligne pour le texte enrichi et la recherche SKU. Les étapes suivantes exigent une fiche existante ; le guide n’en crée pas.",
        contentTitle: "Texte enrichi, images et vidéos",
        contentBody:
          "Passez entre instructions, questions-réponses et exemples créatifs. Collez du Markdown ou utilisez les outils de formatage et d’import d’images ou vidéos. Les longs contenus défilent dans l’éditeur. Enregistrez explicitement le texte. Les archives sont en lecture seule ; le guide ne modifie ni n’importe rien.",
        bindingsTitle: "Trouver des produits entre boutiques",
        bindingsBody:
          "Pour une fiche active, saisissez plusieurs Seller SKU séparés par des virgules. Vérifiez correspondances, SKU absents et erreurs des boutiques avant de lier. Lier et délier sont des actions séparées ; le guide ne les exécute pas et ferme les détails qu’il a ouverts.",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "Téléchargez le modèle actuel et lisez sa feuille d’instructions. Identifiez les créateurs par nom d’utilisateur ; gardez les notes UID au format texte. La mise à jour groupée couvre responsables, protection, notes et uniquement les tags existants. Vérifiez lignes et écrasements avant import ; créez d’abord les nouveaux tags dans le catalogue.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Ouvrez un créateur et vérifiez la portée toutes boutiques ou boutique unique. L’en-tête accepte une note UID vendeur ; Gestion contient les notes vendeur, l’attribution et les tags. Enregistrez explicitement ou utilisez les mises à jour groupées d’Équipe.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Les étapes couvrent produits, ciblage, contact et autorisation. Après Suivant, le ciblage signale capacité quotidienne, durée, e-mail ou consignes de recherche invalides. Corrigez-les avant de continuer. Envoyez une invitation avec message ou seule ; le guide ne sauvegarde pas le brouillon.",
        detailOperationsBody:
          "Comparez les critères de recherche, y compris les plages numériques, puis les créateurs ou les invitations envoyées dans l’entonnoir. Éligibilité, livraison et réponse sont des résultats distincts à examiner avant toute modification.",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "Recherchez les boutiques par nom, alias ou ID, ou choisissez le modèle du compte. Les cartes indiquent disponibilité, repli ou preuves manquantes. Choisissez la portée avant de comparer modèle et décisions humaines.",
      },
      ecommerce: {
        connectFlowBody:
          "Choisissez application, marché (dont le Japon) et type de vendeur avant l’autorisation. L’application détermine le parcours OAuth. Le guide ouvre seulement le formulaire, sans connecter de boutique.",
      },
    },
  },
  id: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "Ruang kerja Agent",
        welcomeBody:
          "Tinjau usulan Agent dan eskalasi staf di sini. Pengajuan sampel dan percakapan kreator kini memiliki halaman ruang kerja manual tersendiri.",
        scopeTitle: "Tiga tampilan Agent",
        scopeBody:
          "Beralih antara pekerjaan tertunda, eskalasi staf, dan semua pekerjaan Agent. Tur mengunjungi tiap tampilan lalu kembali ke pekerjaan tertunda.",
        filtersBody:
          "Saring usulan menurut penanggung jawab, tindakan, dan teks; tampilan semua pekerjaan juga menyediakan status. Eskalasi berbagi filter penanggung jawab, teks, dan waktu. Filter toko ada di ruang kerja manual.",
        agentTimeTitle: "Waktu pembuatan pekerjaan",
        agentTimeBody:
          "Default mencakup semua waktu. Rentang menyaring waktu pembuatan usulan dan eskalasi, bukan penyelesaian. Ketiga tab Agent berbagi rentang ini; isi kedua tanggal untuk rentang khusus.",
        manualWelcomeTitle: "Ruang kerja manual",
        manualWelcomeBody:
          "Tangani pengajuan sampel dan percakapan secara langsung, terpisah dari usulan Agent. Tur hanya mengganti tampilan; tidak menyetujui sampel atau mengirim pesan.",
        manualScopeTitle: "Sampel dan percakapan",
        manualScopeBody:
          "Gunakan Sampel untuk meninjau pengajuan dan Pesan untuk kreator yang menunggu balasan. Tiap antrean memiliki filter dan urutan sendiri. Tur kembali ke Sampel setelah selesai.",
        samplesBody:
          "Cari toko dan saring menurut status tinjauan, perlindungan, penanggung jawab, produk, atau kreator. Buka pengajuan untuk memeriksa SKU yang diminta, stok, dan kinerja sebelum memutuskan. Pengurutan terpisah dari filter.",
        sampleTimeTitle: "Waktu pertama pengajuan teramati",
        sampleTimeBody:
          "Rentang ini memakai waktu pertama sistem mengamati pengajuan, bukan tanggal pengajuan platform. Default mencakup semua waktu. Pilih preset atau kedua tanggal, lalu urutkan dari paling lama atau paling baru.",
        messagesBody:
          "Pilih kanal, penanggung jawab, perlindungan, atau kreator; filter toko tersedia untuk TikTok Shop. Angka kanal menghitung seluruh antrean tertunda, bukan hasil filter. Tinjau konteks percakapan sebelum membalas.",
        messageTimeTitle: "Waktu pesan tertunda terakhir",
        messageTimeBody:
          "Rentang memakai waktu pesan tertunda terakhir, bukan pembuatan percakapan. Default mencakup semua waktu; pilih preset atau kedua tanggal. Urutan waktu tunggu merupakan kontrol terpisah.",
      },
      productKnowledge: {
        libraryBody:
          "Cari catatan aktif atau arsip dan bandingkan cakupan konten serta produk tertaut. Buka baris untuk editor teks kaya dan pencarian SKU. Langkah detail berikut perlu catatan yang sudah ada; tur tidak membuat catatan.",
        contentTitle: "Teks kaya, gambar, dan video",
        contentBody:
          "Beralih antara petunjuk, tanya jawab, dan contoh kreatif. Tempel Markdown atau gunakan format serta unggah gambar/video. Konten panjang bergulir di dalam editor. Simpan perubahan teks secara eksplisit. Arsip hanya-baca; tur tidak mengedit atau mengunggah.",
        bindingsTitle: "Cari produk lintas toko",
        bindingsBody:
          "Pada catatan aktif, masukkan beberapa Seller SKU dipisahkan koma. Periksa kecocokan, SKU tanpa hasil, dan kegagalan toko sebelum menautkan. Menautkan dan melepas tautan adalah tindakan terpisah; tur tidak melakukannya dan menutup detail yang dibukanya.",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "Unduh templat terkini dan baca lembar petunjuknya. Kenali kreator dengan nama pengguna; simpan catatan UID sebagai teks. Pembaruan massal mendukung penanggung jawab, perlindungan, catatan penjual, dan hanya tag yang sudah ada. Tinjau baris dan dampak penimpaan sebelum impor; buat tag baru di katalog terlebih dahulu.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Buka kreator dan periksa cakupan semua toko atau satu toko. Header mendukung catatan UID penjual; Manajemen memuat catatan penjual, kepemilikan, dan tag. Simpan perubahan secara eksplisit atau kelola melalui pembaruan massal di Tim.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Tahapan meliputi produk, target, jangkauan, dan otorisasi. Setelah Berikutnya, target menandai kapasitas harian, durasi, email, atau panduan pencarian yang tidak valid. Perbaiki sebelum lanjut. Jangkauan mendukung undangan dengan pesan atau undangan saja; tur tidak menyimpan draf.",
        detailOperationsBody:
          "Bandingkan kondisi pencarian termasuk rentang angka, lalu kreator kampanye atau tampilan terkirim dalam funnel. Kelayakan, pengiriman undangan, dan respons merupakan hasil berbeda. Tinjau terpisah sebelum mengubah rencana.",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "Cari toko berdasarkan nama, alias, atau ID, atau pilih model akun. Kartu cakupan menunjukkan kesiapan, fallback, atau bukti yang belum tersedia. Pilih cakupan sebelum membandingkan model dan keputusan manusia.",
      },
      ecommerce: {
        connectFlowBody:
          "Pilih aplikasi platform, pasar (termasuk Jepang), dan jenis penjual sebelum otorisasi. Aplikasi menentukan alur OAuth. Tur hanya membuka formulir, tanpa menghubungkan toko.",
      },
    },
  },
  it: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "Area di lavoro Agent",
        welcomeBody:
          "Esamina proposte dell’Agent ed escalation al personale. Le richieste di campioni e le conversazioni hanno ora un’area di lavoro manuale separata.",
        scopeTitle: "Tre viste Agent",
        scopeBody:
          "Passa tra lavoro in attesa, escalation e tutto il lavoro Agent. Il tour visita ogni vista e torna al lavoro in attesa.",
        filtersBody:
          "Filtra le proposte per responsabile, azione e testo; la vista completa anche per stato. Le escalation condividono filtri responsabile, testo e tempo. Il filtro negozio si trova nell’area manuale.",
        agentTimeTitle: "Creazione del lavoro Agent",
        agentTimeBody:
          "Per impostazione predefinita sono incluse tutte le date. L’intervallo filtra la creazione di proposte ed escalation, non il completamento. È condiviso dai tre tab; inserisci entrambe le date per un intervallo personalizzato.",
        manualWelcomeTitle: "Area di lavoro manuale",
        manualWelcomeBody:
          "Gestisci direttamente campioni e conversazioni, separatamente dalle proposte Agent. Il tour cambia solo vista: non approva campioni né invia messaggi.",
        manualScopeTitle: "Campioni e conversazioni",
        manualScopeBody:
          "Campioni serve a esaminare richieste, Messaggi mostra creator in attesa di risposta. Ogni coda ha filtri e ordinamento propri. Il tour torna a Campioni al termine.",
        samplesBody:
          "Cerca negozi e filtra per stato, protezione, responsabile, prodotto o creator. Apri una richiesta per controllare SKU richiesto, scorte e prestazioni prima di decidere. Ordinamento e filtri sono separati.",
        sampleTimeTitle: "Prima osservazione della richiesta",
        sampleTimeBody:
          "L’intervallo usa la prima osservazione del sistema, non la data della richiesta sulla piattaforma. Tutte le date sono incluse di default. Scegli un periodo o entrambe le date, poi ordina dai più vecchi o dai più recenti.",
        messagesBody:
          "Scegli canale, responsabile, protezione o creator; TikTok Shop permette anche il filtro negozio. I contatori comprendono tutta la coda in attesa, non i soli risultati filtrati. Leggi il contesto prima di rispondere.",
        messageTimeTitle: "Ultimo messaggio in attesa",
        messageTimeBody:
          "L’intervallo usa l’ora dell’ultimo messaggio in attesa, non la creazione della conversazione. Tutte le date sono incluse di default; scegli un periodo o entrambe le date. L’ordinamento per attesa è indipendente.",
      },
      productKnowledge: {
        libraryBody:
          "Cerca record attivi o archiviati e confronta copertura e prodotti collegati. Apri una riga per testo formattato e ricerca SKU. I prossimi passaggi richiedono un record esistente; il tour non ne crea.",
        contentTitle: "Testo formattato, immagini e video",
        contentBody:
          "Passa tra istruzioni, domande e risposte ed esempi creativi. Incolla Markdown o usa formattazione e caricamento immagini/video. I contenuti lunghi scorrono nell’editor. Salva esplicitamente il testo. Gli archivi sono in sola lettura; il tour non modifica né carica file.",
        bindingsTitle: "Trovare prodotti tra negozi",
        bindingsBody:
          "Nei record attivi inserisci più Seller SKU separati da virgole. Controlla corrispondenze, SKU senza risultati ed errori dei negozi prima di collegare. Collegare e scollegare sono azioni separate; il tour non le esegue e chiude i dettagli che ha aperto.",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "Scarica il modello aggiornato e leggi il foglio istruzioni. Identifica i creator per nome utente; conserva le note UID come testo. Gli aggiornamenti in blocco supportano responsabili, protezione, note venditore e solo tag esistenti. Controlla righe e sovrascritture prima di importare; crea prima i nuovi tag nel catalogo.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Apri un creator e verifica l’ambito di tutti i negozi o di uno solo. L’intestazione supporta una nota UID venditore; Gestione contiene note, assegnazione e tag. Salva esplicitamente o gestisci tramite aggiornamenti in blocco in Team.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Le fasi coprono prodotti, targeting, contatto e autorizzazione. Dopo Avanti, il targeting evidenzia capacità giornaliera, durata, e-mail o indicazioni di ricerca non valide. Correggile prima di proseguire. Il contatto supporta invito con messaggio o solo invito; il tour non salva la bozza.",
        detailOperationsBody:
          "Confronta le condizioni di ricerca, inclusi gli intervalli numerici, poi creator o inviti inviati nel funnel. Idoneità, consegna e risposta sono risultati distinti. Esaminali separatamente prima di modificare il piano.",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "Cerca negozi per nome, alias o ID oppure scegli il modello account. Le schede mostrano disponibilità, fallback o prove mancanti. Scegli l’ambito prima di confrontare modello e decisioni umane.",
      },
      ecommerce: {
        connectFlowBody:
          "Scegli app, mercato (incluso il Giappone) e tipo di venditore prima dell’autorizzazione. L’app determina il flusso OAuth. Il tour apre solo il modulo, senza collegare negozi.",
      },
    },
  },
  th: {
    tutorial: {
      ecommerceAffiliateAttention: {
        welcomeTitle: "พื้นที่ทำงาน Agent",
        welcomeBody:
          "ตรวจสอบข้อเสนอของ Agent และเรื่องที่ส่งต่อให้เจ้าหน้าที่ที่นี่ คำขอตัวอย่างและบทสนทนาของครีเอเตอร์ย้ายไปยังพื้นที่ทำงานแบบแมนนวลแล้ว",
        scopeTitle: "สามมุมมองของ Agent",
        scopeBody:
          "สลับระหว่างงานที่รอดำเนินการ เรื่องส่งต่อ และงาน Agent ทั้งหมด บทสอนจะพาชมแต่ละมุมมองแล้วกลับไปยังงานที่รอดำเนินการ",
        filtersBody:
          "กรองข้อเสนอตามผู้รับผิดชอบ การดำเนินการ และข้อความ มุมมองงานทั้งหมดกรองสถานะได้ด้วย เรื่องส่งต่อใช้ตัวกรองผู้รับผิดชอบ ข้อความ และเวลาร่วมกัน ส่วนตัวกรองร้านค้าอยู่ในพื้นที่ทำงานแบบแมนนวล",
        agentTimeTitle: "เวลาที่สร้างงาน Agent",
        agentTimeBody:
          "ค่าเริ่มต้นคือทุกช่วงเวลา ช่วงวันที่กรองเวลาสร้างข้อเสนอและเรื่องส่งต่อ ไม่ใช่เวลาที่เสร็จสิ้น ทั้งสามแท็บใช้ช่วงเวลาร่วมกัน หากกำหนดเองต้องกรอกทั้งวันเริ่มและวันสิ้นสุด",
        manualWelcomeTitle: "พื้นที่ทำงานแบบแมนนวล",
        manualWelcomeBody:
          "จัดการคำขอตัวอย่างและบทสนทนาโดยตรง แยกจากข้อเสนอของ Agent บทสอนนี้เพียงสลับมุมมอง ไม่อนุมัติตัวอย่างหรือส่งข้อความ",
        manualScopeTitle: "ตัวอย่างและบทสนทนา",
        manualScopeBody:
          "ใช้แท็บตัวอย่างเพื่อตรวจคำขอ และแท็บข้อความเพื่อดูครีเอเตอร์ที่รอคำตอบ แต่ละคิวมีตัวกรองและการเรียงลำดับของตนเอง เมื่อจบบทสอนจะกลับไปแท็บตัวอย่าง",
        samplesBody:
          "ค้นหาร้านค้าและกรองตามสถานะตรวจสอบ การคุ้มครอง ผู้รับผิดชอบ สินค้า หรือครีเอเตอร์ เปิดคำขอเพื่อตรวจ SKU ที่ขอ สต็อก และผลงานก่อนตัดสินใจ การเรียงลำดับแยกจากตัวกรอง",
        sampleTimeTitle: "เวลาที่พบคำขอครั้งแรก",
        sampleTimeBody:
          "ช่วงนี้ใช้เวลาที่ระบบพบคำขอครั้งแรก ไม่ใช่วันที่ยื่นบนแพลตฟอร์ม ค่าเริ่มต้นคือทุกช่วงเวลา เลือกช่วงสำเร็จรูปหรือกรอกทั้งสองวันที่ แล้วเรียงจากเก่าไปใหม่หรือใหม่ไปเก่า",
        messagesBody:
          "เลือกช่องทาง ผู้รับผิดชอบ การคุ้มครอง หรือครีเอเตอร์ ช่องทาง TikTok Shop กรองร้านค้าได้ ตัวเลขช่องทางนับทั้งคิวที่รอตอบ ไม่ใช่เฉพาะผลลัพธ์ที่กรอง เปิดบทสนทนาอ่านบริบทก่อนตอบ",
        messageTimeTitle: "เวลาข้อความที่รอตอบล่าสุด",
        messageTimeBody:
          "ช่วงนี้ใช้เวลาของข้อความที่รอตอบล่าสุด ไม่ใช่เวลาสร้างบทสนทนา ค่าเริ่มต้นคือทุกช่วงเวลา เลือกช่วงสำเร็จรูปหรือกรอกทั้งสองวันที่ การเรียงตามเวลารอเป็นอีกตัวควบคุมหนึ่ง",
      },
      productKnowledge: {
        libraryBody:
          "ค้นหารายการที่ใช้งานหรือเก็บถาวร แล้วเปรียบเทียบความครบถ้วนของเนื้อหาและสินค้าที่เชื่อมโยง เปิดแถวเพื่อแก้ไขข้อความและค้นหา SKU ขั้นตอนถัดไปต้องมีรายการอยู่แล้ว บทสอนจะไม่สร้างรายการให้",
        contentTitle: "ข้อความจัดรูปแบบ รูปภาพ และวิดีโอ",
        contentBody:
          "สลับระหว่างคำแนะนำ ถามตอบ และตัวอย่างสร้างสรรค์ วาง Markdown หรือใช้เครื่องมือจัดรูปแบบและอัปโหลดรูปภาพหรือวิดีโอ เนื้อหายาวเลื่อนในตัวแก้ไข ต้องกดบันทึกข้อความเอง รายการเก็บถาวรอ่านได้อย่างเดียว บทสอนไม่แก้ไขหรืออัปโหลด",
        bindingsTitle: "ค้นหาสินค้าข้ามร้านค้า",
        bindingsBody:
          "ในรายการที่ใช้งาน ป้อน Seller SKU หลายค่าคั่นด้วยจุลภาค ตรวจผลที่ตรง SKU ที่ไม่พบ และข้อผิดพลาดของร้านค้าก่อนเชื่อมโยง การเชื่อมและยกเลิกเชื่อมเป็นคนละการดำเนินการ บทสอนไม่ทำทั้งสองอย่างและจะปิดหน้ารายละเอียดที่เปิดไว้เอง",
      },
      ecommerceAffiliateTeam: {
        assignmentsBody:
          "ดาวน์โหลดเทมเพลตล่าสุดและอ่านชีตคำแนะนำ ระบุครีเอเตอร์ด้วยชื่อผู้ใช้และเก็บหมายเหตุ UID เป็นข้อความ การอัปเดตแบบกลุ่มรองรับผู้รับผิดชอบ การคุ้มครอง หมายเหตุผู้ขาย และแท็กที่มีอยู่เท่านั้น ตรวจแต่ละแถวและผลการเขียนทับก่อนนำเข้า ต้องสร้างแท็กใหม่ในรายการแท็กก่อน",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "เปิดครีเอเตอร์และตรวจขอบเขตทุกร้านหรือร้านเดียว ส่วนหัวเพิ่มหมายเหตุ UID ของผู้ขายได้ ส่วนจัดการมีหมายเหตุผู้ขาย ผู้รับผิดชอบ และแท็ก ต้องบันทึกการแก้ไขเอง หรือจัดการผ่านการอัปเดตแบบกลุ่มในหน้าทีม",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "สี่ขั้นตอนคือสินค้า เป้าหมาย การติดต่อ และการอนุญาต เมื่อกดถัดไปในขั้นเป้าหมาย ระบบจะระบุความจุต่อวัน ระยะเวลา อีเมล หรือคำแนะนำค้นหาที่ไม่ถูกต้อง ให้แก้ก่อนดำเนินต่อ การติดต่อส่งคำเชิญพร้อมข้อความหรือคำเชิญอย่างเดียวได้ บทสอนไม่บันทึกฉบับร่าง",
        detailOperationsBody:
          "เปรียบเทียบเงื่อนไขค้นหารวมถึงช่วงตัวเลข แล้วดูครีเอเตอร์หรือมุมมองที่ส่งแล้วในกรวย คุณสมบัติ การส่งคำเชิญ และการตอบของครีเอเตอร์เป็นผลคนละอย่าง ตรวจแยกกันก่อนปรับแผน",
      },
      ecommerceAffiliateIntelligence: {
        scopesBody:
          "ค้นหาร้านด้วยชื่อ นามแฝง หรือ ID หรือเลือกโมเดลบัญชี การ์ดแสดงความพร้อม โมเดลสำรอง หรือหลักฐานที่ขาด เลือกขอบเขตก่อนเปรียบเทียบโมเดลกับการตัดสินใจของคน",
      },
      ecommerce: {
        connectFlowBody:
          "เลือกแอปแพลตฟอร์ม ตลาด (รวมญี่ปุ่น) และประเภทผู้ขายก่อนอนุญาต แอปกำหนดขั้นตอน OAuth บทสอนเพียงเปิดแบบฟอร์ม ไม่เชื่อมต่อร้านค้า",
      },
    },
  },
};
