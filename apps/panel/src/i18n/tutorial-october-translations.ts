import type { SupportedLanguageCode } from "./languages.js";

/** October 2 audit: workspace tabs, BD access, manual reviews and application-level BI. */
const en = {
  tutorial: {
    workspace: {
      tabsTitle: "Keep work in separate tabs",
      tabsBody:
        "Switch between open workspaces without losing their page state. Hidden tabs pause their effects. Switching tabs ends this tour; start it again on the active page.",
    },
    ecommerceAffiliateAttention: {
      queueBody:
        "Open a proposal to inspect the recommendation, evidence and individual sample-review rows. Check each row's approve, platform-reject or ignore action separately. Ignoring is not a platform rejection; this tour submits no decisions.",
      manualScopeBody:
        "Samples contains application reviews; Messages contains pending creator conversations. Each queue has independent filters and ordering. This tour returns to Samples without approving applications or sending messages.",
      samplesBody:
        "Filter by shop, review status, protection, BD, product or creator. Product filters can use platform products or merchant PIDs linked through Product Knowledge. Check the applied SKU, stock and creator performance before deciding.",
      sampleReviewTitle: "Approve, reject, or ignore",
      sampleReviewBody:
        "Open an application to review its context. Platform rejection requires a reason; Other also requires an explanation. Ignore is separate from platform rejection and can be reopened for review. This tour performs none of these actions.",
      messagesBody:
        "Choose a channel, BD, protection or creator; shop filtering applies to TikTok Shop. Channel badges count the entire pending queue, not filtered rows. Time filters and waiting-time ordering are separate.",
      messageReviewTitle: "Reply or mark handled",
      messageReviewBody:
        "Open a conversation and review its context. You can reply or mark it handled without sending a reply. Verify the channel and shop before acting; this tour neither sends nor marks messages handled.",
    },
    ecommerceAffiliateAnalytics: {
      tabsTitle: "Overview, Explore, and Details",
      tabsBody:
        "Overview summarizes the funnel; Explore builds aggregate queries; Details lists individual applications. BD-only accounts have Details only. This tour visits available views without running a query.",
      approvalBody:
        "Compare application review outcomes and decision origins. Ignored applications are reported separately from merchant rejection; do not treat ignoring as a platform rejection. Use Details to inspect individual records.",
      bdWelcomeTitle: "Application-level analysis",
      bdWelcomeBody:
        "Your BD workspace provides Details, not Overview or Explore. Search review and fulfillment records within your authorized scope. The tour explains the query without submitting it.",
      detailsQueryTitle: "Choose an application dataset",
      detailsQueryBody:
        "Select review or fulfillment results, shops and dates. Here the date range means application date, not decision or order date. Choose your scope before pressing Search details.",
      detailsFiltersTitle: "Narrow the records",
      detailsFiltersBody:
        "Review filters include decision and origin; fulfillment filters include shipment, content and post-application orders. Creator Open ID and product ID identify exact records. Shipment date is first observed by sync, not an exact platform timestamp.",
      detailsResultsTitle: "Pages, exports, and evidence",
      detailsResultsBody:
        "Search to populate one row per application. Page through results or download all matching rows. Fulfillment rows open order and video evidence. Creator metrics use a profile captured near application time; the platform does not specify their reporting period. Order lines can belong to multiple applications: do not sum them as unique orders.",
    },
    ecommerceAffiliateTeam: {
      responsibilitiesBody:
        "Open a BD to inspect channels, settings and Login. Responsibility and protection govern creator ownership; a BD login is a separate account. This tour opens an existing profile only and never creates a login.",
      loginTitle: "Manage a BD login separately",
      loginBody:
        "Login controls provision, reset, enable, disable and remove access. New or reset credentials appear once: share them securely when actually provisioning. This tour only shows the panel and closes the profile it opened.",
      loginScopeTitle: "Understand the BD workspace",
      loginScopeBody:
        "BD-only access includes workbenches, creators and history within authorized scope, read-only Product Knowledge and analytics Details. Supervisor team and campaign controls are not included. Review the scope before granting access.",
    },
    ecommerceAffiliateCreators: {
      resultsBody:
        "Open a creator and verify all-shop or single-shop scope. Inspect application-time performance and collaboration evidence. Supervisors can open BD profiles and manage ownership, notes and tags; BD-only accounts do not see supervisor controls. Save permitted edits explicitly.",
    },
    ecommerceAffiliateCampaign: {
      wizardStagesBody:
        "Products, targeting, outreach and authorization form the four stages. Targeting distinguishes marketplace rules from AI pre-approval; check readiness, numeric conditions, capacity and validation errors. Outreach supports invitation with a message or invitation only. The tour leaves its blank draft unsaved and does not close an existing draft.",
      detailOperationsBody:
        "Compare search conditions and screening mode, then inspect creators and the sent funnel. Marketplace-rule filtering, AI filtering, protection and outreach-policy blocks have distinct meanings. Qualification, delivery and creator response are separate outcomes; a zero AI-filter count in marketplace mode is not an AI approval rate.",
    },
    productKnowledge: {
      readOnlyBody:
        "Your BD workspace can read product instructions, Q&A, creative cases and linked products. Creating, editing, uploading and changing links are unavailable. This tour only opens existing records.",
      readOnlyLibraryBody:
        "Search active or archived records and inspect coverage and product links. Open an existing row to read its content. An empty library is not populated by this tour.",
      readOnlyContentBody:
        "Read instructions, Q&A and creative cases, including images and videos. BD access is read-only: there are no editing, uploading or saving steps.",
      readOnlyBindingsBody:
        "Inspect the products linked to this record across shops. BD access cannot link or unlink products. The tour closes only a detail that it opened.",
    },
    account: {
      membersTitle: "Account members and BD logins",
      membersBody:
        "Owners manage account members here. BD login access is managed from Team & Channels, inside a BD profile's Login tab, not through this member-creation flow. This tour creates no accounts.",
      rolesTitle: "Built-in and custom roles",
      rolesBody:
        "Built-in roles are locked. Use custom roles for editable permission sets and inspect assignments before changing access. This tour does not create, modify or delete roles.",
    },
    shopAnalytics: {
      welcomeBody:
        "Inspect live SPS health for supported US shops. Shop eligibility and selection limit the live scope; this is not an all-market report. Use the overview and shop diagnosis to investigate changes.",
      scopeTitle: "Select eligible US shops",
      scopeBody:
        "Select up to 50 eligible US shops for live SPS. Search narrows the visible selector, not the selected scope. With too many shops, choose a scope before data loads; unsupported markets are excluded.",
      trendBody:
        "Compare the selected shops over time and inspect their SPS components. Charts show at most six shop series. A limited chart is not evidence that other selected shops have no data; check the shop diagnosis table too.",
    },
  },
};

export const TUTORIAL_OCTOBER_TRANSLATIONS: Record<SupportedLanguageCode, typeof en> = {
  en,
  zh: {
    tutorial: {
      workspace: {
        tabsTitle: "用标签页保留不同工作现场",
        tabsBody:
          "切换已打开的工作区时会保留页面状态，隐藏标签页会暂停副作用。切换标签页会结束当前教程；请在当前页面重新启动。",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "打开提案核对建议、证据和逐条样品审核记录。分别确认每行的批准、平台拒绝或忽略操作；忽略不等于平台拒绝。本教程不提交决策。",
        manualScopeBody:
          "「样品」用于审核申请，「消息」用于处理待办达人会话。两类队列的筛选和排序互相独立。本教程结束后返回样品页，不审批申请，也不发送消息。",
        samplesBody:
          "按店铺、审核状态、保护、BD、商品或达人筛选。商品筛选支持平台商品，以及通过商品知识绑定的商家 PID。决策前核对申请 SKU、库存和达人表现。",
        sampleReviewTitle: "批准、拒绝与忽略",
        sampleReviewBody:
          "打开申请查看上下文。平台拒绝需要选择原因，「其他」还需要说明。忽略不等于平台拒绝，被忽略的申请可以重新打开审核。本教程不执行任何上述操作。",
        messagesBody:
          "选择渠道、BD、保护或达人；店铺筛选适用于 TikTok Shop。渠道角标统计整个待处理队列，而非筛选后的行数。时间筛选和等待时长排序是不同控件。",
        messageReviewTitle: "回复或标记已处理",
        messageReviewBody:
          "打开会话核对上下文。可以回复，也可以不发送回复就标记已处理。操作前确认渠道和店铺；本教程不会发送消息或标记已处理。",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "概览、探索与明细",
        tabsBody:
          "概览汇总漏斗，探索构建聚合查询，明细展示单个申请。仅 BD 权限的账号只有明细。本教程介绍可用视图，不执行查询。",
        approvalBody:
          "对比申请审核结果及决策来源。被忽略的申请单独统计，不等于商家在平台上拒绝。需要检查单条记录时使用明细。",
        bdWelcomeTitle: "申请级明细分析",
        bdWelcomeBody:
          "BD 工作区提供明细，不提供概览或探索。可在授权范围内查询审核和履约记录。本教程说明查询方式，不提交查询。",
        detailsQueryTitle: "选择申请数据集",
        detailsQueryBody:
          "选择审核或履约结果、店铺和日期。这里的日期范围指申请日期，而非决策或订单日期。确认范围后再点击搜索明细。",
        detailsFiltersTitle: "缩小记录范围",
        detailsFiltersBody:
          "审核可按决策和来源筛选；履约可按发货、内容和申请后订单筛选。达人 Open ID 和商品 ID 用于精确定位。发货日期是同步首次观测时间，并非精确的平台时间戳。",
        detailsResultsTitle: "分页、导出与证据",
        detailsResultsBody:
          "搜索后每条申请占一行，可分页查看或下载全部匹配行。履约行可展开订单和视频证据。达人指标来自申请时间附近的资料快照，平台未说明统计周期。同一订单行可能关联多个申请，不要将其加总为去重订单。",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "打开 BD 查看渠道、设置和登录。职责和保护决定达人归属，BD 登录是独立账号。本教程只打开已有资料，不创建登录。",
        loginTitle: "独立管理 BD 登录",
        loginBody:
          "登录页可创建、重置、启用、停用和移除登录。新建或重置后的凭据只显示一次，实际办理时请安全交付。本教程只展示面板，并关闭由教程打开的资料。",
        loginScopeTitle: "了解 BD 工作区权限",
        loginScopeBody:
          "仅 BD 权限包含授权范围内的工作台、达人和历史、只读商品知识以及分析明细，不包含主管的团队和推广计划管理。授权前请核对范围。",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "打开达人后先确认全部店铺或单店铺范围。查看申请时表现和协作证据。主管可打开 BD 资料并管理归属、备注和标签；仅 BD 权限不显示主管控件。有权限的修改需要显式保存。",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "四阶段为商品、定向、触达和授权。定向区分平台规则与 AI 预审批，需核对就绪状态、数值条件、容量和校验错误。触达支持邀请加消息或仅邀请。本教程不保存空白草稿，也不关闭原有草稿。",
        detailOperationsBody:
          "对比搜索条件和筛选模式，再检查达人及已发送漏斗。平台规则过滤、AI 过滤、保护和触达策略阻止各有不同含义。资格筛选、送达和达人回应是不同结果；平台规则模式中 AI 过滤为零不代表 AI 通过率。",
      },
      productKnowledge: {
        readOnlyBody:
          "BD 工作区可阅读商品说明、问答、创意案例和关联商品，不能创建、编辑、上传或修改关联。本教程只打开已有记录。",
        readOnlyLibraryBody:
          "搜索有效或已归档记录，查看内容覆盖和关联商品。打开已有行阅读内容；空知识库不会由教程自动填充。",
        readOnlyContentBody:
          "阅读说明、问答及创意案例，包括图片和视频。BD 权限只读，没有编辑、上传或保存步骤。",
        readOnlyBindingsBody:
          "查看跨店铺关联到此记录的商品。BD 权限不能关联或解除关联。本教程只关闭自己打开的详情。",
      },
      account: {
        membersTitle: "账号成员与 BD 登录",
        membersBody:
          "账号所有者在此管理成员。BD 登录由团队与渠道中的 BD 资料「登录」页管理，不通过此处创建成员。本教程不创建账号。",
        rolesTitle: "内置角色与自定义角色",
        rolesBody:
          "内置角色已锁定。需要可编辑的权限集合时使用自定义角色，变更权限前检查分配情况。本教程不创建、修改或删除角色。",
      },
      shopAnalytics: {
        welcomeBody:
          "查看受支持美国店铺的实时 SPS 健康状况。可用店铺和所选范围决定实时数据范围，这不是全市场报表。通过概览和店铺诊断排查变化。",
        scopeTitle: "选择符合条件的美国店铺",
        scopeBody:
          "最多选择 50 家符合条件的美国店铺查询实时 SPS。搜索只缩小可见选项，不改变已选范围。店铺过多时先选择范围才能加载数据；不支持的市场不纳入。",
        trendBody:
          "对比所选店铺的时间趋势与 SPS 分项。图表最多显示六条店铺曲线；未出现在图中的已选店铺不一定没有数据，请同时查看店铺诊断表。",
      },
    },
  },
  de: {
    tutorial: {
      workspace: {
        tabsTitle: "Arbeit in getrennten Tabs behalten",
        tabsBody:
          "Wechseln Sie zwischen offenen Arbeitsbereichen, ohne den Seitenzustand zu verlieren. Verborgene Tabs pausieren ihre Effekte. Ein Tabwechsel beendet diese Tour; starten Sie sie auf der aktiven Seite erneut.",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "Öffnen Sie einen Vorschlag und prüfen Sie Empfehlung, Belege und einzelne Musterprüfungen. Prüfen Sie je Zeile Genehmigen, Plattformablehnung oder Ignorieren getrennt. Ignorieren ist keine Plattformablehnung; die Tour übermittelt keine Entscheidungen.",
        manualScopeBody:
          "Muster enthält Antragsprüfungen; Nachrichten enthält offene Creator-Unterhaltungen. Beide Warteschlangen haben eigene Filter und Sortierung. Die Tour kehrt zu Muster zurück, ohne Anträge zu genehmigen oder Nachrichten zu senden.",
        samplesBody:
          "Filtern Sie nach Shop, Prüfstatus, Schutz, BD, Produkt oder Creator. Produktfilter unterstützen Plattformprodukte und über Produktwissen verknüpfte Händler-PIDs. Prüfen Sie beantragte SKU, Bestand und Creator-Leistung vor einer Entscheidung.",
        sampleReviewTitle: "Genehmigen, ablehnen oder ignorieren",
        sampleReviewBody:
          "Öffnen Sie einen Antrag und prüfen Sie den Kontext. Eine Plattformablehnung verlangt einen Grund; Sonstiges verlangt zusätzlich eine Erklärung. Ignorieren ist keine Plattformablehnung und lässt sich zur erneuten Prüfung öffnen. Die Tour führt keine dieser Aktionen aus.",
        messagesBody:
          "Wählen Sie Kanal, BD, Schutz oder Creator; der Shopfilter gilt für TikTok Shop. Kanalzähler beziehen sich auf die gesamte offene Warteschlange, nicht auf gefilterte Zeilen. Zeitfilter und Wartezeitsortierung sind getrennt.",
        messageReviewTitle: "Antworten oder als erledigt markieren",
        messageReviewBody:
          "Öffnen Sie die Unterhaltung und prüfen Sie den Kontext. Sie können antworten oder ohne Antwort als erledigt markieren. Prüfen Sie vorher Kanal und Shop; die Tour sendet nichts und markiert nichts als erledigt.",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "Übersicht, Erkunden und Details",
        tabsBody:
          "Übersicht fasst den Trichter zusammen; Erkunden erstellt aggregierte Abfragen; Details zeigt einzelne Anträge. Reine BD-Konten haben nur Details. Die Tour zeigt verfügbare Ansichten, ohne eine Abfrage auszuführen.",
        approvalBody:
          "Vergleichen Sie Prüfergebnisse und Entscheidungsquellen. Ignorierte Anträge werden getrennt von Händlerablehnungen ausgewiesen; Ignorieren ist keine Plattformablehnung. Einzelne Datensätze finden Sie unter Details.",
        bdWelcomeTitle: "Analyse einzelner Anträge",
        bdWelcomeBody:
          "Ihr BD-Arbeitsbereich bietet Details, nicht Übersicht oder Erkunden. Suchen Sie Prüf- und Erfüllungsdatensätze im erlaubten Umfang. Die Tour erklärt die Abfrage, ohne sie abzusenden.",
        detailsQueryTitle: "Antragsdatensatz auswählen",
        detailsQueryBody:
          "Wählen Sie Prüf- oder Erfüllungsergebnisse, Shops und Daten. Der Zeitraum bezieht sich hier auf das Antragsdatum, nicht auf Entscheidungs- oder Bestelldatum. Prüfen Sie den Umfang vor der Detailsuche.",
        detailsFiltersTitle: "Datensätze eingrenzen",
        detailsFiltersBody:
          "Prüfungen lassen sich nach Entscheidung und Quelle filtern; Erfüllung nach Versand, Inhalt und Bestellungen nach Antragstellung. Creator Open ID und Produkt-ID bestimmen genaue Datensätze. Versanddatum ist die erste Synchronisationsbeobachtung, kein exakter Plattformzeitstempel.",
        detailsResultsTitle: "Seiten, Exporte und Belege",
        detailsResultsBody:
          "Nach der Suche erscheint eine Zeile pro Antrag. Blättern Sie oder laden Sie alle Treffer herunter. Erfüllungszeilen öffnen Bestell- und Videobelege. Creator-Kennzahlen stammen aus einem Profil nahe dem Antragszeitpunkt; die Plattform nennt keinen Berichtszeitraum. Bestellzeilen können mehreren Anträgen zugeordnet sein: nicht als eindeutige Bestellungen summieren.",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "Öffnen Sie einen BD für Kanäle, Einstellungen und Login. Zuständigkeit und Schutz regeln die Creator-Zuordnung; ein BD-Login ist ein separates Konto. Die Tour öffnet nur ein vorhandenes Profil und erstellt keinen Login.",
        loginTitle: "BD-Login separat verwalten",
        loginBody:
          "Login bietet Bereitstellung, Zurücksetzen, Aktivieren, Deaktivieren und Entfernen. Neue oder zurückgesetzte Zugangsdaten erscheinen nur einmal: übermitteln Sie sie bei echter Einrichtung sicher. Die Tour zeigt nur das Panel und schließt ihr geöffnetes Profil.",
        loginScopeTitle: "BD-Arbeitsbereich verstehen",
        loginScopeBody:
          "Reiner BD-Zugang umfasst Arbeitsbereiche, Creator und Verlauf im erlaubten Umfang, schreibgeschütztes Produktwissen sowie Analyse-Details. Team- und Kampagnensteuerung für Vorgesetzte fehlt. Prüfen Sie den Umfang vor der Freigabe.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Öffnen Sie einen Creator und prüfen Sie den Umfang: alle Shops oder ein Shop. Prüfen Sie Leistung bei Antragstellung und Kooperationsbelege. Vorgesetzte können BD-Profile öffnen und Zuordnung, Notizen und Tags verwalten; reine BD-Konten sehen diese Steuerung nicht. Erlaubte Änderungen müssen ausdrücklich gespeichert werden.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Die vier Phasen sind Produkte, Zielgruppe, Kontaktaufnahme und Autorisierung. Zielgruppe unterscheidet Marktplatzregeln von KI-Vorabgenehmigung; prüfen Sie Bereitschaft, Zahlenbedingungen, Kapazität und Validierungsfehler. Kontaktaufnahme unterstützt Einladung mit Nachricht oder nur Einladung. Die Tour speichert ihren leeren Entwurf nicht und schließt keinen vorhandenen Entwurf.",
        detailOperationsBody:
          "Vergleichen Sie Suchbedingungen und Prüfmodus, dann Creator und Versandtrichter. Marktplatzregeln, KI-Filter, Schutz und Kontaktregeln bedeuten Unterschiedliches. Qualifikation, Zustellung und Creator-Antwort sind separate Ergebnisse; null KI-Filter im Marktplatzmodus ist keine KI-Genehmigungsrate.",
      },
      productKnowledge: {
        readOnlyBody:
          "Ihr BD-Arbeitsbereich kann Produktanleitungen, Fragen und Antworten, Kreativbeispiele und verknüpfte Produkte lesen. Erstellen, Bearbeiten, Hochladen und Verknüpfungsänderungen sind nicht verfügbar. Die Tour öffnet nur vorhandene Datensätze.",
        readOnlyLibraryBody:
          "Suchen Sie aktive oder archivierte Datensätze und prüfen Sie Abdeckung und Produktverknüpfungen. Öffnen Sie eine vorhandene Zeile zum Lesen. Die Tour füllt keine leere Bibliothek.",
        readOnlyContentBody:
          "Lesen Sie Anleitungen, Fragen und Antworten sowie Kreativbeispiele mit Bildern und Videos. BD-Zugang ist schreibgeschützt: keine Bearbeitungs-, Upload- oder Speicherschritte.",
        readOnlyBindingsBody:
          "Prüfen Sie shopübergreifend verknüpfte Produkte. BD-Zugang kann keine Verknüpfungen hinzufügen oder entfernen. Die Tour schließt nur ihre selbst geöffnete Detailansicht.",
      },
      account: {
        membersTitle: "Kontomitglieder und BD-Logins",
        membersBody:
          "Eigentümer verwalten hier Kontomitglieder. BD-Zugang wird im Login-Tab eines BD-Profils unter Team und Kanäle verwaltet, nicht über diese Mitgliedererstellung. Die Tour erstellt keine Konten.",
        rolesTitle: "Integrierte und eigene Rollen",
        rolesBody:
          "Integrierte Rollen sind gesperrt. Nutzen Sie eigene Rollen für bearbeitbare Berechtigungen und prüfen Sie Zuordnungen vor Änderungen. Die Tour erstellt, ändert oder löscht keine Rollen.",
      },
      shopAnalytics: {
        welcomeBody:
          "Prüfen Sie den Live-SPS-Zustand unterstützter US-Shops. Eignung und Auswahl begrenzen den Live-Umfang; dies ist kein Bericht aller Märkte. Untersuchen Sie Änderungen mit Übersicht und Shopdiagnose.",
        scopeTitle: "Geeignete US-Shops auswählen",
        scopeBody:
          "Wählen Sie bis zu 50 geeignete US-Shops für Live-SPS. Die Suche begrenzt sichtbare Optionen, nicht die Auswahl. Bei zu vielen Shops wählen Sie erst den Umfang; nicht unterstützte Märkte sind ausgeschlossen.",
        trendBody:
          "Vergleichen Sie ausgewählte Shops im Zeitverlauf und ihre SPS-Komponenten. Diagramme zeigen höchstens sechs Shopreihen. Fehlende Kurven beweisen keine fehlenden Daten; prüfen Sie auch die Shopdiagnose-Tabelle.",
      },
    },
  },
  es: {
    tutorial: {
      workspace: {
        tabsTitle: "Mantén el trabajo en pestañas separadas",
        tabsBody:
          "Cambia entre espacios abiertos sin perder el estado de la página. Las pestañas ocultas pausan sus efectos. Cambiar de pestaña termina este tutorial; inícialo de nuevo en la página activa.",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "Abre una propuesta para revisar recomendación, pruebas y cada revisión de muestra. Comprueba por separado aprobar, rechazar en la plataforma o ignorar en cada fila. Ignorar no es rechazar en la plataforma; el tutorial no envía decisiones.",
        manualScopeBody:
          "Muestras contiene las revisiones de solicitudes; Mensajes, las conversaciones pendientes. Cada cola tiene filtros y orden propios. El tutorial vuelve a Muestras sin aprobar solicitudes ni enviar mensajes.",
        samplesBody:
          "Filtra por tienda, estado de revisión, protección, BD, producto o creador. Los filtros de producto admiten productos de la plataforma y PID del comerciante vinculados mediante Conocimiento del producto. Comprueba SKU solicitado, existencias y rendimiento antes de decidir.",
        sampleReviewTitle: "Aprobar, rechazar o ignorar",
        sampleReviewBody:
          "Abre una solicitud para revisar su contexto. El rechazo en la plataforma requiere un motivo; Otro también exige una explicación. Ignorar no equivale a rechazar en la plataforma y permite reabrir la revisión. El tutorial no realiza estas acciones.",
        messagesBody:
          "Elige canal, BD, protección o creador; el filtro de tienda se aplica a TikTok Shop. Los contadores de canal abarcan toda la cola pendiente, no las filas filtradas. El filtro temporal y el orden por espera son independientes.",
        messageReviewTitle: "Responder o marcar como atendido",
        messageReviewBody:
          "Abre la conversación y revisa el contexto. Puedes responder o marcarla como atendida sin enviar una respuesta. Comprueba canal y tienda antes de actuar; el tutorial no envía ni marca mensajes como atendidos.",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "Resumen, Explorar y Detalles",
        tabsBody:
          "Resumen sintetiza el embudo; Explorar crea consultas agregadas; Detalles muestra solicitudes individuales. Las cuentas solo BD disponen únicamente de Detalles. El tutorial visita las vistas disponibles sin ejecutar consultas.",
        approvalBody:
          "Compara resultados de revisión y orígenes de decisión. Las solicitudes ignoradas se muestran aparte del rechazo del comerciante; ignorar no es rechazar en la plataforma. Usa Detalles para revisar registros individuales.",
        bdWelcomeTitle: "Análisis por solicitud",
        bdWelcomeBody:
          "Tu espacio BD ofrece Detalles, no Resumen ni Explorar. Busca registros de revisión y cumplimiento dentro del alcance autorizado. El tutorial explica la consulta sin enviarla.",
        detailsQueryTitle: "Elige los datos de solicitudes",
        detailsQueryBody:
          "Selecciona revisión o cumplimiento, tiendas y fechas. El intervalo corresponde a la fecha de solicitud, no de decisión ni pedido. Verifica el alcance antes de buscar detalles.",
        detailsFiltersTitle: "Acota los registros",
        detailsFiltersBody:
          "Filtra revisiones por decisión y origen, y cumplimiento por envío, contenido y pedidos posteriores a la solicitud. Open ID del creador e ID de producto identifican registros exactos. La fecha de envío es la primera observación por sincronización, no una marca exacta de la plataforma.",
        detailsResultsTitle: "Páginas, exportaciones y pruebas",
        detailsResultsBody:
          "La búsqueda muestra una fila por solicitud. Navega por páginas o descarga todas las coincidencias. Las filas de cumplimiento abren pruebas de pedidos y vídeos. Las métricas usan un perfil capturado cerca de la solicitud; la plataforma no indica su periodo. Una línea de pedido puede pertenecer a varias solicitudes: no la sumes como pedidos únicos.",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "Abre un BD para ver canales, ajustes y acceso. Responsabilidad y protección rigen la asignación de creadores; el acceso BD es una cuenta aparte. El tutorial solo abre un perfil existente y no crea accesos.",
        loginTitle: "Gestiona el acceso BD por separado",
        loginBody:
          "Acceso permite crear, restablecer, activar, desactivar y eliminar accesos. Las credenciales nuevas o restablecidas aparecen una sola vez: entrégalas de forma segura al crearlas realmente. El tutorial solo muestra el panel y cierra el perfil que abrió.",
        loginScopeTitle: "Comprende el espacio BD",
        loginScopeBody:
          "El acceso solo BD incluye espacios de trabajo, creadores e historial autorizados, Conocimiento del producto de solo lectura y Detalles analíticos. No incluye gestión de equipo ni campañas para supervisores. Revisa el alcance antes de autorizar.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Abre un creador y verifica el alcance de todas las tiendas o una sola. Revisa rendimiento al solicitar y pruebas de colaboración. Los supervisores pueden abrir perfiles BD y gestionar asignación, notas y etiquetas; las cuentas solo BD no ven esos controles. Guarda explícitamente las ediciones permitidas.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Las cuatro etapas son productos, segmentación, contacto y autorización. Segmentación distingue reglas de la plataforma y preaprobación por IA; verifica disponibilidad, condiciones numéricas, capacidad y errores. Contacto admite invitación con mensaje o solo invitación. El tutorial no guarda su borrador vacío ni cierra uno existente.",
        detailOperationsBody:
          "Compara condiciones de búsqueda y modo de selección; después revisa creadores y embudo de envíos. Reglas de plataforma, filtro IA, protección y bloqueos de contacto tienen significados distintos. Selección, entrega y respuesta son resultados separados; cero filtros IA en modo plataforma no es una tasa de aprobación IA.",
      },
      productKnowledge: {
        readOnlyBody:
          "Tu espacio BD permite leer instrucciones, preguntas y respuestas, casos creativos y productos vinculados. No permite crear, editar, subir archivos ni cambiar vínculos. El tutorial solo abre registros existentes.",
        readOnlyLibraryBody:
          "Busca registros activos o archivados e inspecciona cobertura y vínculos. Abre una fila existente para leer el contenido. El tutorial no rellena una biblioteca vacía.",
        readOnlyContentBody:
          "Lee instrucciones, preguntas y respuestas y casos creativos con imágenes y vídeos. El acceso BD es de solo lectura: no hay pasos de edición, subida ni guardado.",
        readOnlyBindingsBody:
          "Inspecciona los productos vinculados entre tiendas. El acceso BD no permite vincular ni desvincular. El tutorial solo cierra los detalles que abrió.",
      },
      account: {
        membersTitle: "Miembros y accesos BD",
        membersBody:
          "Los propietarios gestionan aquí los miembros. El acceso BD se gestiona en Equipo y canales, pestaña Acceso del perfil BD, no mediante este flujo de creación de miembros. El tutorial no crea cuentas.",
        rolesTitle: "Roles integrados y personalizados",
        rolesBody:
          "Los roles integrados están bloqueados. Usa roles personalizados para permisos editables y revisa asignaciones antes de cambiar accesos. El tutorial no crea, modifica ni elimina roles.",
      },
      shopAnalytics: {
        welcomeBody:
          "Inspecciona el SPS en vivo de tiendas compatibles de EE. UU. La elegibilidad y selección limitan el alcance; no es un informe de todos los mercados. Investiga cambios con resumen y diagnóstico por tienda.",
        scopeTitle: "Selecciona tiendas aptas de EE. UU.",
        scopeBody:
          "Selecciona hasta 50 tiendas aptas de EE. UU. para SPS en vivo. La búsqueda limita las opciones visibles, no la selección. Si hay demasiadas tiendas, elige el alcance antes de cargar datos; se excluyen mercados incompatibles.",
        trendBody:
          "Compara tiendas seleccionadas y componentes SPS a lo largo del tiempo. Los gráficos muestran hasta seis series. La ausencia de una curva no demuestra falta de datos; revisa también el diagnóstico por tienda.",
      },
    },
  },
  fr: {
    tutorial: {
      workspace: {
        tabsTitle: "Conserver le travail dans des onglets séparés",
        tabsBody:
          "Passez d'un espace ouvert à l'autre sans perdre l'état de la page. Les onglets masqués suspendent leurs effets. Changer d'onglet termine ce tutoriel ; relancez-le sur la page active.",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "Ouvrez une proposition pour examiner recommandation, preuves et chaque ligne de contrôle d'échantillon. Vérifiez séparément approuver, refuser sur la plateforme ou ignorer. Ignorer n'est pas refuser sur la plateforme ; le tutoriel ne soumet aucune décision.",
        manualScopeBody:
          "Échantillons contient les demandes à examiner ; Messages, les conversations en attente. Chaque file a ses propres filtres et tri. Le tutoriel revient à Échantillons sans approuver de demande ni envoyer de message.",
        samplesBody:
          "Filtrez par boutique, statut, protection, BD, produit ou créateur. Les filtres produit acceptent les produits de plateforme et les PID marchands liés via Connaissance produit. Vérifiez SKU demandé, stock et performances avant de décider.",
        sampleReviewTitle: "Approuver, refuser ou ignorer",
        sampleReviewBody:
          "Ouvrez une demande pour lire son contexte. Le refus sur la plateforme exige un motif ; Autre exige aussi une explication. Ignorer est distinct du refus et permet de rouvrir l'examen. Le tutoriel n'effectue aucune de ces actions.",
        messagesBody:
          "Choisissez canal, BD, protection ou créateur ; le filtre boutique concerne TikTok Shop. Les compteurs couvrent toute la file en attente, pas les lignes filtrées. Filtre temporel et tri par attente sont distincts.",
        messageReviewTitle: "Répondre ou marquer comme traité",
        messageReviewBody:
          "Ouvrez la conversation et vérifiez le contexte. Vous pouvez répondre ou marquer comme traité sans réponse. Vérifiez canal et boutique avant d'agir ; le tutoriel n'envoie rien et ne marque rien comme traité.",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "Vue d'ensemble, Explorer et Détails",
        tabsBody:
          "La vue d'ensemble résume l'entonnoir ; Explorer crée des requêtes agrégées ; Détails liste les demandes. Les comptes BD seuls n'ont que Détails. Le tutoriel visite les vues disponibles sans lancer de requête.",
        approvalBody:
          "Comparez résultats d'examen et origines des décisions. Les demandes ignorées sont séparées des refus marchands ; ignorer n'est pas refuser sur la plateforme. Utilisez Détails pour examiner chaque dossier.",
        bdWelcomeTitle: "Analyse par demande",
        bdWelcomeBody:
          "Votre espace BD propose Détails, pas la vue d'ensemble ni Explorer. Recherchez les dossiers d'examen et d'exécution dans votre périmètre autorisé. Le tutoriel explique la requête sans la soumettre.",
        detailsQueryTitle: "Choisir les données des demandes",
        detailsQueryBody:
          "Sélectionnez examen ou exécution, boutiques et dates. La période correspond à la date de demande, non à celle de décision ou de commande. Vérifiez le périmètre avant de rechercher les détails.",
        detailsFiltersTitle: "Affiner les dossiers",
        detailsFiltersBody:
          "L'examen se filtre par décision et origine ; l'exécution par expédition, contenu et commandes postérieures à la demande. Open ID du créateur et ID produit ciblent les dossiers exacts. La date d'expédition est la première observation de synchronisation, pas un horodatage précis de plateforme.",
        detailsResultsTitle: "Pages, exports et preuves",
        detailsResultsBody:
          "La recherche affiche une ligne par demande. Parcourez les pages ou téléchargez tous les résultats. Les lignes d'exécution ouvrent les preuves de commandes et vidéos. Les métriques utilisent un profil capturé près de la demande ; la plateforme ne précise pas leur période. Une ligne de commande peut relever de plusieurs demandes : ne les additionnez pas comme commandes uniques.",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "Ouvrez un BD pour voir canaux, paramètres et connexion. Responsabilité et protection régissent l'attribution des créateurs ; la connexion BD est un compte distinct. Le tutoriel ouvre seulement un profil existant et ne crée aucune connexion.",
        loginTitle: "Gérer séparément la connexion BD",
        loginBody:
          "Connexion permet création, réinitialisation, activation, désactivation et retrait. Les identifiants nouveaux ou réinitialisés n'apparaissent qu'une fois : transmettez-les de manière sûre lors d'une véritable création. Le tutoriel montre seulement le panneau et ferme le profil qu'il a ouvert.",
        loginScopeTitle: "Comprendre l'espace BD",
        loginScopeBody:
          "L'accès BD seul comprend espaces de travail, créateurs et historique autorisés, Connaissance produit en lecture seule et Détails analytiques. Les commandes superviseur d'équipe et de campagnes sont exclues. Vérifiez le périmètre avant d'accorder l'accès.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Ouvrez un créateur et vérifiez le périmètre : toutes les boutiques ou une seule. Examinez performances à la demande et preuves de collaboration. Les superviseurs peuvent ouvrir les profils BD et gérer attribution, notes et étiquettes ; les comptes BD seuls ne voient pas ces commandes. Enregistrez explicitement les modifications autorisées.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Les quatre étapes sont produits, ciblage, prise de contact et autorisation. Le ciblage distingue règles de plateforme et préapprobation IA ; vérifiez disponibilité, conditions numériques, capacité et erreurs. Le contact permet invitation avec message ou seule. Le tutoriel ne sauvegarde pas son brouillon vide et ne ferme pas un brouillon existant.",
        detailOperationsBody:
          "Comparez conditions de recherche et mode de sélection, puis créateurs et entonnoir d'envoi. Règles de plateforme, filtrage IA, protection et blocages de contact ont des sens distincts. Qualification, livraison et réponse sont séparées ; zéro filtrage IA en mode plateforme n'est pas un taux d'approbation IA.",
      },
      productKnowledge: {
        readOnlyBody:
          "Votre espace BD permet de lire instructions, questions-réponses, exemples créatifs et produits liés. Création, modification, téléversement et changement de liens sont indisponibles. Le tutoriel ouvre seulement les dossiers existants.",
        readOnlyLibraryBody:
          "Recherchez les dossiers actifs ou archivés et consultez couverture et liens produits. Ouvrez une ligne existante pour lire son contenu. Le tutoriel ne remplit pas une bibliothèque vide.",
        readOnlyContentBody:
          "Lisez instructions, questions-réponses et exemples créatifs avec images et vidéos. L'accès BD est en lecture seule : aucune étape de modification, téléversement ou sauvegarde.",
        readOnlyBindingsBody:
          "Consultez les produits liés entre boutiques. L'accès BD ne permet ni liaison ni suppression de liens. Le tutoriel ferme uniquement les détails qu'il a ouverts.",
      },
      account: {
        membersTitle: "Membres du compte et connexions BD",
        membersBody:
          "Les propriétaires gèrent ici les membres. L'accès BD se gère dans Équipe et canaux, onglet Connexion du profil BD, pas via cette création de membres. Le tutoriel ne crée aucun compte.",
        rolesTitle: "Rôles intégrés et personnalisés",
        rolesBody:
          "Les rôles intégrés sont verrouillés. Utilisez des rôles personnalisés pour les permissions modifiables et vérifiez les attributions avant tout changement. Le tutoriel ne crée, modifie ni supprime de rôle.",
      },
      shopAnalytics: {
        welcomeBody:
          "Consultez le SPS en direct des boutiques américaines compatibles. Éligibilité et sélection limitent le périmètre ; ce n'est pas un rapport tous marchés. Analysez les évolutions avec la synthèse et le diagnostic par boutique.",
        scopeTitle: "Sélectionner les boutiques américaines éligibles",
        scopeBody:
          "Sélectionnez jusqu'à 50 boutiques américaines éligibles pour le SPS en direct. La recherche réduit les choix visibles, pas la sélection. Si elles sont trop nombreuses, choisissez le périmètre avant chargement ; les marchés incompatibles sont exclus.",
        trendBody:
          "Comparez les boutiques sélectionnées et leurs composantes SPS dans le temps. Les graphiques montrent au plus six séries. Une courbe absente ne prouve pas l'absence de données ; consultez aussi le tableau de diagnostic.",
      },
    },
  },
  id: {
    tutorial: {
      workspace: {
        tabsTitle: "Simpan pekerjaan di tab terpisah",
        tabsBody:
          "Beralih antar ruang kerja terbuka tanpa kehilangan keadaan halaman. Tab tersembunyi menjeda efeknya. Berpindah tab mengakhiri tutorial ini; mulai lagi pada halaman aktif.",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "Buka usulan untuk memeriksa rekomendasi, bukti dan tiap baris tinjauan sampel. Periksa tindakan setujui, tolak di platform atau abaikan secara terpisah. Mengabaikan bukan penolakan platform; tutorial tidak mengirim keputusan.",
        manualScopeBody:
          "Sampel berisi peninjauan pengajuan; Pesan berisi percakapan kreator yang tertunda. Setiap antrean memiliki filter dan urutan sendiri. Tutorial kembali ke Sampel tanpa menyetujui pengajuan atau mengirim pesan.",
        samplesBody:
          "Filter berdasarkan toko, status tinjauan, perlindungan, BD, produk atau kreator. Filter produk mendukung produk platform dan PID merchant yang ditautkan lewat Pengetahuan Produk. Periksa SKU yang diajukan, stok dan kinerja kreator sebelum memutuskan.",
        sampleReviewTitle: "Setujui, tolak, atau abaikan",
        sampleReviewBody:
          "Buka pengajuan untuk memeriksa konteks. Penolakan platform memerlukan alasan; Lainnya juga memerlukan penjelasan. Mengabaikan berbeda dari penolakan platform dan dapat dibuka kembali untuk ditinjau. Tutorial tidak melakukan tindakan tersebut.",
        messagesBody:
          "Pilih kanal, BD, perlindungan atau kreator; filter toko berlaku untuk TikTok Shop. Angka kanal menghitung seluruh antrean tertunda, bukan baris terfilter. Filter waktu dan urutan waktu tunggu terpisah.",
        messageReviewTitle: "Balas atau tandai ditangani",
        messageReviewBody:
          "Buka percakapan dan periksa konteks. Anda dapat membalas atau menandai ditangani tanpa mengirim balasan. Pastikan kanal dan toko sebelum bertindak; tutorial tidak mengirim atau menandai pesan ditangani.",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "Ringkasan, Jelajahi, dan Detail",
        tabsBody:
          "Ringkasan merangkum funnel; Jelajahi membuat kueri agregat; Detail menampilkan pengajuan individual. Akun khusus BD hanya memiliki Detail. Tutorial mengunjungi tampilan tersedia tanpa menjalankan kueri.",
        approvalBody:
          "Bandingkan hasil tinjauan dan asal keputusan. Pengajuan yang diabaikan dilaporkan terpisah dari penolakan merchant; mengabaikan bukan penolakan platform. Gunakan Detail untuk memeriksa tiap catatan.",
        bdWelcomeTitle: "Analisis per pengajuan",
        bdWelcomeBody:
          "Ruang kerja BD menyediakan Detail, bukan Ringkasan atau Jelajahi. Cari catatan tinjauan dan pemenuhan dalam cakupan yang diizinkan. Tutorial menjelaskan kueri tanpa mengirimkannya.",
        detailsQueryTitle: "Pilih data pengajuan",
        detailsQueryBody:
          "Pilih hasil tinjauan atau pemenuhan, toko dan tanggal. Rentang di sini berarti tanggal pengajuan, bukan keputusan atau pesanan. Tentukan cakupan sebelum menekan Cari detail.",
        detailsFiltersTitle: "Persempit catatan",
        detailsFiltersBody:
          "Filter tinjauan mencakup keputusan dan asal; pemenuhan mencakup pengiriman, konten dan pesanan setelah pengajuan. Open ID kreator dan ID produk menunjukkan catatan tepat. Tanggal pengiriman adalah pengamatan sinkronisasi pertama, bukan waktu platform yang pasti.",
        detailsResultsTitle: "Halaman, ekspor, dan bukti",
        detailsResultsBody:
          "Pencarian menampilkan satu baris per pengajuan. Jelajahi halaman atau unduh semua hasil. Baris pemenuhan membuka bukti pesanan dan video. Metrik kreator memakai profil yang direkam dekat waktu pengajuan; platform tidak menjelaskan periodenya. Baris pesanan dapat terkait beberapa pengajuan: jangan jumlahkan sebagai pesanan unik.",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "Buka BD untuk melihat kanal, pengaturan dan Login. Tanggung jawab dan perlindungan mengatur kepemilikan kreator; login BD adalah akun terpisah. Tutorial hanya membuka profil yang ada dan tidak membuat login.",
        loginTitle: "Kelola login BD secara terpisah",
        loginBody:
          "Login menyediakan pembuatan, reset, pengaktifan, penonaktifan dan penghapusan akses. Kredensial baru atau hasil reset hanya muncul sekali: serahkan secara aman saat benar-benar membuat akses. Tutorial hanya menampilkan panel dan menutup profil yang dibukanya.",
        loginScopeTitle: "Pahami ruang kerja BD",
        loginScopeBody:
          "Akses khusus BD mencakup ruang kerja, kreator dan riwayat yang diizinkan, Pengetahuan Produk hanya-baca dan Detail analitik. Kontrol tim dan kampanye supervisor tidak termasuk. Periksa cakupan sebelum memberi akses.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Buka kreator dan pastikan cakupan semua toko atau satu toko. Periksa kinerja saat pengajuan dan bukti kolaborasi. Supervisor dapat membuka profil BD serta mengelola kepemilikan, catatan dan tag; akun khusus BD tidak melihat kontrol tersebut. Simpan perubahan yang diizinkan secara eksplisit.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Empat tahapnya adalah produk, penargetan, penjangkauan dan otorisasi. Penargetan membedakan aturan marketplace dan pra-persetujuan AI; periksa kesiapan, kondisi numerik, kapasitas dan kesalahan validasi. Penjangkauan mendukung undangan dengan pesan atau undangan saja. Tutorial tidak menyimpan draf kosongnya atau menutup draf yang sudah ada.",
        detailOperationsBody:
          "Bandingkan kondisi pencarian dan mode penyaringan, lalu kreator dan funnel terkirim. Aturan marketplace, filter AI, perlindungan dan blokir kebijakan penjangkauan berbeda artinya. Kualifikasi, pengiriman dan respons kreator adalah hasil terpisah; nol filter AI pada mode marketplace bukan tingkat persetujuan AI.",
      },
      productKnowledge: {
        readOnlyBody:
          "Ruang kerja BD dapat membaca petunjuk, tanya jawab, kasus kreatif dan produk tertaut. Membuat, menyunting, mengunggah dan mengubah tautan tidak tersedia. Tutorial hanya membuka catatan yang ada.",
        readOnlyLibraryBody:
          "Cari catatan aktif atau diarsipkan dan periksa cakupan serta tautan produk. Buka baris yang ada untuk membaca konten. Tutorial tidak mengisi pustaka kosong.",
        readOnlyContentBody:
          "Baca petunjuk, tanya jawab dan kasus kreatif beserta gambar dan video. Akses BD hanya-baca: tidak ada langkah menyunting, mengunggah atau menyimpan.",
        readOnlyBindingsBody:
          "Periksa produk lintas toko yang ditautkan ke catatan ini. Akses BD tidak dapat menautkan atau melepas tautan. Tutorial hanya menutup detail yang dibukanya sendiri.",
      },
      account: {
        membersTitle: "Anggota akun dan login BD",
        membersBody:
          "Pemilik mengelola anggota akun di sini. Akses BD dikelola dari Tim & Kanal, tab Login profil BD, bukan alur pembuatan anggota ini. Tutorial tidak membuat akun.",
        rolesTitle: "Peran bawaan dan khusus",
        rolesBody:
          "Peran bawaan dikunci. Gunakan peran khusus untuk izin yang dapat disunting dan periksa penugasan sebelum mengubah akses. Tutorial tidak membuat, mengubah atau menghapus peran.",
      },
      shopAnalytics: {
        welcomeBody:
          "Periksa kesehatan SPS langsung untuk toko AS yang didukung. Kelayakan dan pilihan toko membatasi cakupan langsung; ini bukan laporan semua pasar. Gunakan ringkasan dan diagnosis toko untuk menyelidiki perubahan.",
        scopeTitle: "Pilih toko AS yang memenuhi syarat",
        scopeBody:
          "Pilih hingga 50 toko AS yang memenuhi syarat untuk SPS langsung. Pencarian mempersempit pilihan terlihat, bukan cakupan terpilih. Jika toko terlalu banyak, pilih cakupan sebelum data dimuat; pasar yang tidak didukung dikecualikan.",
        trendBody:
          "Bandingkan toko terpilih dan komponen SPS dari waktu ke waktu. Grafik menampilkan maksimal enam seri toko. Kurva yang tidak muncul bukan bukti data tidak ada; periksa juga tabel diagnosis toko.",
      },
    },
  },
  it: {
    tutorial: {
      workspace: {
        tabsTitle: "Conserva il lavoro in schede separate",
        tabsBody:
          "Passa tra spazi aperti senza perdere lo stato della pagina. Le schede nascoste sospendono i propri effetti. Cambiare scheda termina questo tutorial; riavvialo sulla pagina attiva.",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "Apri una proposta per verificare raccomandazione, prove e singole righe di revisione campioni. Controlla separatamente approvazione, rifiuto sulla piattaforma o ignorare. Ignorare non è un rifiuto sulla piattaforma; il tutorial non invia decisioni.",
        manualScopeBody:
          "Campioni contiene le revisioni delle richieste; Messaggi, le conversazioni in sospeso. Ogni coda ha filtri e ordine propri. Il tutorial torna a Campioni senza approvare richieste né inviare messaggi.",
        samplesBody:
          "Filtra per negozio, stato, protezione, BD, prodotto o creator. I filtri prodotto supportano prodotti della piattaforma e PID del commerciante collegati tramite Conoscenza prodotto. Controlla SKU richiesto, scorte e prestazioni prima di decidere.",
        sampleReviewTitle: "Approva, rifiuta o ignora",
        sampleReviewBody:
          "Apri una richiesta per verificarne il contesto. Il rifiuto sulla piattaforma richiede un motivo; Altro richiede anche una spiegazione. Ignorare è distinto dal rifiuto e consente di riaprire la revisione. Il tutorial non esegue queste azioni.",
        messagesBody:
          "Scegli canale, BD, protezione o creator; il filtro negozio vale per TikTok Shop. I contatori dei canali comprendono tutta la coda in sospeso, non le righe filtrate. Filtro temporale e ordinamento per attesa sono separati.",
        messageReviewTitle: "Rispondi o segna come gestito",
        messageReviewBody:
          "Apri la conversazione e controlla il contesto. Puoi rispondere o segnarla come gestita senza inviare risposta. Verifica canale e negozio prima di agire; il tutorial non invia né segna messaggi come gestiti.",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "Panoramica, Esplora e Dettagli",
        tabsBody:
          "Panoramica riassume il funnel; Esplora crea query aggregate; Dettagli elenca singole richieste. Gli account solo BD hanno soltanto Dettagli. Il tutorial visita le viste disponibili senza eseguire query.",
        approvalBody:
          "Confronta esiti delle revisioni e origini delle decisioni. Le richieste ignorate sono separate dai rifiuti del commerciante; ignorare non è rifiutare sulla piattaforma. Usa Dettagli per controllare i singoli record.",
        bdWelcomeTitle: "Analisi per richiesta",
        bdWelcomeBody:
          "Lo spazio BD offre Dettagli, non Panoramica o Esplora. Cerca revisioni e adempimenti nell'ambito autorizzato. Il tutorial spiega la query senza inviarla.",
        detailsQueryTitle: "Scegli i dati delle richieste",
        detailsQueryBody:
          "Seleziona revisione o adempimento, negozi e date. L'intervallo indica la data della richiesta, non della decisione o dell'ordine. Verifica l'ambito prima di cercare i dettagli.",
        detailsFiltersTitle: "Restringi i record",
        detailsFiltersBody:
          "Le revisioni si filtrano per decisione e origine; gli adempimenti per spedizione, contenuti e ordini successivi alla richiesta. Open ID del creator e ID prodotto individuano record precisi. La data di spedizione è la prima osservazione della sincronizzazione, non un timestamp esatto della piattaforma.",
        detailsResultsTitle: "Pagine, esportazioni e prove",
        detailsResultsBody:
          "La ricerca mostra una riga per richiesta. Sfoglia le pagine o scarica tutti i risultati. Le righe di adempimento aprono prove di ordini e video. Le metriche usano un profilo acquisito vicino alla richiesta; la piattaforma non specifica il periodo. Una riga d'ordine può riferirsi a più richieste: non sommarle come ordini unici.",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "Apri un BD per canali, impostazioni e Login. Responsabilità e protezione regolano l'assegnazione dei creator; il login BD è un account separato. Il tutorial apre solo un profilo esistente e non crea accessi.",
        loginTitle: "Gestisci separatamente il login BD",
        loginBody:
          "Login permette creazione, ripristino, attivazione, disattivazione e rimozione. Le credenziali nuove o ripristinate compaiono una sola volta: consegnale in modo sicuro durante una vera creazione. Il tutorial mostra solo il pannello e chiude il profilo che ha aperto.",
        loginScopeTitle: "Comprendi lo spazio BD",
        loginScopeBody:
          "L'accesso solo BD comprende spazi di lavoro, creator e cronologia autorizzati, Conoscenza prodotto in sola lettura e Dettagli analitici. Non include controlli supervisore di team e campagne. Verifica l'ambito prima di concedere accesso.",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "Apri un creator e verifica l'ambito di tutti i negozi o uno solo. Controlla prestazioni alla richiesta e prove di collaborazione. I supervisori possono aprire profili BD e gestire assegnazione, note e tag; gli account solo BD non vedono tali controlli. Salva esplicitamente le modifiche consentite.",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "Le quattro fasi sono prodotti, targeting, contatto e autorizzazione. Il targeting distingue regole del marketplace e preapprovazione IA; controlla disponibilità, condizioni numeriche, capacità ed errori. Il contatto supporta invito con messaggio o solo invito. Il tutorial non salva la propria bozza vuota e non chiude bozze esistenti.",
        detailOperationsBody:
          "Confronta condizioni di ricerca e modalità di selezione, poi creator e funnel di invio. Regole marketplace, filtro IA, protezione e blocchi di contatto hanno significati diversi. Qualificazione, consegna e risposta sono esiti separati; zero filtri IA in modalità marketplace non è un tasso di approvazione IA.",
      },
      productKnowledge: {
        readOnlyBody:
          "Lo spazio BD permette di leggere istruzioni, domande e risposte, casi creativi e prodotti collegati. Creazione, modifica, caricamento e cambio dei collegamenti non sono disponibili. Il tutorial apre solo record esistenti.",
        readOnlyLibraryBody:
          "Cerca record attivi o archiviati e controlla copertura e collegamenti. Apri una riga esistente per leggere il contenuto. Il tutorial non riempie una libreria vuota.",
        readOnlyContentBody:
          "Leggi istruzioni, domande e risposte e casi creativi con immagini e video. L'accesso BD è di sola lettura: nessun passaggio di modifica, caricamento o salvataggio.",
        readOnlyBindingsBody:
          "Controlla i prodotti collegati tra negozi. L'accesso BD non può collegare o scollegare prodotti. Il tutorial chiude solo i dettagli che ha aperto.",
      },
      account: {
        membersTitle: "Membri dell'account e login BD",
        membersBody:
          "I proprietari gestiscono qui i membri. L'accesso BD si gestisce in Team e canali, scheda Login del profilo BD, non tramite questa creazione di membri. Il tutorial non crea account.",
        rolesTitle: "Ruoli integrati e personalizzati",
        rolesBody:
          "I ruoli integrati sono bloccati. Usa ruoli personalizzati per permessi modificabili e controlla le assegnazioni prima di cambiare accessi. Il tutorial non crea, modifica o elimina ruoli.",
      },
      shopAnalytics: {
        welcomeBody:
          "Esamina il SPS in tempo reale dei negozi USA supportati. Idoneità e selezione limitano l'ambito; non è un rapporto di tutti i mercati. Analizza i cambiamenti con panoramica e diagnosi per negozio.",
        scopeTitle: "Seleziona negozi USA idonei",
        scopeBody:
          "Seleziona fino a 50 negozi USA idonei per SPS in tempo reale. La ricerca restringe le opzioni visibili, non l'ambito selezionato. Se sono troppi, scegli l'ambito prima del caricamento; i mercati non supportati sono esclusi.",
        trendBody:
          "Confronta negozi selezionati e componenti SPS nel tempo. I grafici mostrano al massimo sei serie. Una curva assente non prova la mancanza di dati; controlla anche la tabella diagnostica.",
      },
    },
  },
  th: {
    tutorial: {
      workspace: {
        tabsTitle: "เก็บงานไว้ในแท็บแยกกัน",
        tabsBody:
          "สลับพื้นที่ทำงานที่เปิดอยู่โดยไม่เสียสถานะหน้า แท็บที่ซ่อนจะพักเอฟเฟกต์ การสลับแท็บจะจบบทแนะนำนี้ ให้เริ่มใหม่บนหน้าที่ใช้งานอยู่",
      },
      ecommerceAffiliateAttention: {
        queueBody:
          "เปิดข้อเสนอเพื่อตรวจคำแนะนำ หลักฐาน และแถวตรวจตัวอย่างแต่ละรายการ ตรวจการอนุมัติ ปฏิเสธบนแพลตฟอร์ม หรือเพิกเฉยแยกกัน การเพิกเฉยไม่ใช่การปฏิเสธบนแพลตฟอร์ม บทแนะนำไม่ส่งการตัดสินใจ",
        manualScopeBody:
          "ตัวอย่างสินค้ารวมการตรวจคำขอ ส่วนข้อความรวมบทสนทนาครีเอเตอร์ที่รอดำเนินการ แต่ละคิวมีตัวกรองและลำดับของตนเอง บทแนะนำจะกลับไปตัวอย่างสินค้าโดยไม่อนุมัติคำขอหรือส่งข้อความ",
        samplesBody:
          "กรองตามร้าน สถานะตรวจสอบ การคุ้มครอง BD สินค้า หรือครีเอเตอร์ ตัวกรองสินค้ารองรับสินค้าบนแพลตฟอร์มและ PID ผู้ค้าที่เชื่อมผ่านความรู้สินค้า ตรวจ SKU ที่ขอ สต็อก และผลงานครีเอเตอร์ก่อนตัดสินใจ",
        sampleReviewTitle: "อนุมัติ ปฏิเสธ หรือเพิกเฉย",
        sampleReviewBody:
          "เปิดคำขอเพื่อตรวจบริบท การปฏิเสธบนแพลตฟอร์มต้องเลือกเหตุผล และอื่น ๆ ต้องมีคำอธิบายด้วย การเพิกเฉยแยกจากการปฏิเสธบนแพลตฟอร์มและเปิดตรวจใหม่ได้ บทแนะนำไม่ทำรายการเหล่านี้",
        messagesBody:
          "เลือกช่องทาง BD การคุ้มครอง หรือครีเอเตอร์ ตัวกรองร้านใช้กับ TikTok Shop ตัวเลขช่องทางนับทั้งคิวที่รอดำเนินการ ไม่ใช่แถวหลังกรอง ตัวกรองเวลาแยกจากการเรียงตามเวลารอ",
        messageReviewTitle: "ตอบหรือทำเครื่องหมายว่าจัดการแล้ว",
        messageReviewBody:
          "เปิดบทสนทนาและตรวจบริบท คุณตอบหรือทำเครื่องหมายว่าจัดการแล้วโดยไม่ส่งคำตอบได้ ตรวจช่องทางและร้านก่อนดำเนินการ บทแนะนำไม่ส่งหรือทำเครื่องหมายข้อความว่าจัดการแล้ว",
      },
      ecommerceAffiliateAnalytics: {
        tabsTitle: "ภาพรวม สำรวจ และรายละเอียด",
        tabsBody:
          "ภาพรวมสรุปกรวย สำรวจสร้างคิวรีสรุปรวม รายละเอียดแสดงคำขอรายรายการ บัญชีที่มีเฉพาะสิทธิ์ BD มีเพียงรายละเอียด บทแนะนำเปิดมุมมองที่ใช้ได้โดยไม่รันคิวรี",
        approvalBody:
          "เปรียบเทียบผลตรวจคำขอและที่มาของการตัดสินใจ คำขอที่เพิกเฉยแสดงแยกจากผู้ค้าปฏิเสธ อย่านับการเพิกเฉยเป็นการปฏิเสธบนแพลตฟอร์ม ใช้รายละเอียดตรวจรายรายการ",
        bdWelcomeTitle: "วิเคราะห์ระดับคำขอ",
        bdWelcomeBody:
          "พื้นที่ BD มีรายละเอียด ไม่มีภาพรวมหรือสำรวจ ค้นผลตรวจและการดำเนินการตามขอบเขตที่ได้รับสิทธิ์ บทแนะนำอธิบายคิวรีโดยไม่ส่งคิวรี",
        detailsQueryTitle: "เลือกชุดข้อมูลคำขอ",
        detailsQueryBody:
          "เลือกผลตรวจหรือการดำเนินการ ร้าน และวันที่ ช่วงวันที่นี้คือวันที่ยื่นคำขอ ไม่ใช่วันที่ตัดสินใจหรือสั่งซื้อ ตรวจขอบเขตก่อนกดค้นหารายละเอียด",
        detailsFiltersTitle: "จำกัดรายการให้แคบลง",
        detailsFiltersBody:
          "ผลตรวจกรองตามการตัดสินใจและที่มา การดำเนินการกรองตามการส่งสินค้า เนื้อหา และคำสั่งซื้อหลังยื่นคำขอ Open ID ครีเอเตอร์และ ID สินค้าระบุรายการได้ตรง วันที่ส่งสินค้าคือวันที่ซิงก์พบครั้งแรก ไม่ใช่เวลาที่แน่นอนของแพลตฟอร์ม",
        detailsResultsTitle: "หน้า ส่งออก และหลักฐาน",
        detailsResultsBody:
          "ค้นหาเพื่อแสดงหนึ่งแถวต่อคำขอ เปลี่ยนหน้าหรือดาวน์โหลดทุกรายการที่ตรงได้ แถวการดำเนินการเปิดหลักฐานคำสั่งซื้อและวิดีโอ ตัวชี้วัดครีเอเตอร์ใช้โปรไฟล์ที่บันทึกใกล้เวลายื่นคำขอ แพลตฟอร์มไม่ได้ระบุช่วงสถิติ แถวคำสั่งซื้ออาจเชื่อมหลายคำขอ อย่ารวมเป็นจำนวนคำสั่งซื้อที่ไม่ซ้ำ",
      },
      ecommerceAffiliateTeam: {
        responsibilitiesBody:
          "เปิด BD เพื่อดูช่องทาง การตั้งค่า และการเข้าสู่ระบบ ความรับผิดชอบและการคุ้มครองกำหนดเจ้าของครีเอเตอร์ บัญชีเข้าสู่ระบบ BD เป็นบัญชีแยก บทแนะนำเปิดเฉพาะโปรไฟล์ที่มีอยู่และไม่สร้างบัญชีเข้าสู่ระบบ",
        loginTitle: "จัดการการเข้าสู่ระบบ BD แยกกัน",
        loginBody:
          "หน้านี้สร้าง รีเซ็ต เปิดใช้ ปิดใช้ และลบสิทธิ์ได้ ข้อมูลเข้าสู่ระบบใหม่หรือที่รีเซ็ตจะแสดงครั้งเดียว ให้ส่งมอบอย่างปลอดภัยเมื่อสร้างจริง บทแนะนำแสดงเพียงแผงและปิดโปรไฟล์ที่เปิดเอง",
        loginScopeTitle: "เข้าใจพื้นที่ทำงาน BD",
        loginScopeBody:
          "สิทธิ์เฉพาะ BD รวมพื้นที่ทำงาน ครีเอเตอร์ และประวัติในขอบเขตที่อนุญาต ความรู้สินค้าแบบอ่านอย่างเดียว และรายละเอียดวิเคราะห์ ไม่รวมการจัดการทีมและแคมเปญของหัวหน้างาน ตรวจขอบเขตก่อนให้สิทธิ์",
      },
      ecommerceAffiliateCreators: {
        resultsBody:
          "เปิดครีเอเตอร์และตรวจขอบเขตทุกร้านหรือร้านเดียว ดูผลงานตอนยื่นคำขอและหลักฐานความร่วมมือ หัวหน้างานเปิดโปรไฟล์ BD และจัดการเจ้าของ หมายเหตุ และแท็กได้ บัญชีเฉพาะ BD ไม่เห็นการควบคุมเหล่านี้ ต้องกดบันทึกการแก้ไขที่ได้รับอนุญาตเอง",
      },
      ecommerceAffiliateCampaign: {
        wizardStagesBody:
          "สี่ขั้นคือสินค้า การกำหนดเป้าหมาย การติดต่อ และการอนุญาต เป้าหมายแยกกฎมาร์เก็ตเพลซจากการอนุมัติล่วงหน้า AI ตรวจความพร้อม เงื่อนไขตัวเลข ความจุ และข้อผิดพลาด การติดต่อรองรับคำเชิญพร้อมข้อความหรือคำเชิญอย่างเดียว บทแนะนำไม่บันทึกร่างว่างและไม่ปิดร่างเดิม",
        detailOperationsBody:
          "เปรียบเทียบเงื่อนไขค้นหาและโหมดคัดกรอง แล้วดูครีเอเตอร์และกรวยการส่ง กฎมาร์เก็ตเพลซ ตัวกรอง AI การคุ้มครอง และการบล็อกนโยบายติดต่อมีความหมายต่างกัน คุณสมบัติ การส่งถึง และคำตอบเป็นคนละผล จำนวนกรอง AI เป็นศูนย์ในโหมดมาร์เก็ตเพลซไม่ใช่อัตราอนุมัติ AI",
      },
      productKnowledge: {
        readOnlyBody:
          "พื้นที่ BD อ่านคำแนะนำ ถามตอบ กรณีสร้างสรรค์ และสินค้าที่เชื่อมได้ แต่สร้าง แก้ไข อัปโหลด หรือเปลี่ยนลิงก์ไม่ได้ บทแนะนำเปิดเฉพาะรายการที่มีอยู่",
        readOnlyLibraryBody:
          "ค้นรายการที่ใช้งานหรือเก็บถาวรและดูความครอบคลุมกับสินค้าที่เชื่อม เปิดแถวที่มีอยู่เพื่ออ่าน บทแนะนำไม่เติมคลังที่ว่าง",
        readOnlyContentBody:
          "อ่านคำแนะนำ ถามตอบ และกรณีสร้างสรรค์พร้อมรูปและวิดีโอ สิทธิ์ BD อ่านอย่างเดียว ไม่มีขั้นแก้ไข อัปโหลด หรือบันทึก",
        readOnlyBindingsBody:
          "ดูสินค้าข้ามร้านที่เชื่อมกับรายการนี้ สิทธิ์ BD เชื่อมหรือยกเลิกการเชื่อมไม่ได้ บทแนะนำปิดเฉพาะรายละเอียดที่เปิดเอง",
      },
      account: {
        membersTitle: "สมาชิกบัญชีและการเข้าสู่ระบบ BD",
        membersBody:
          "เจ้าของจัดการสมาชิกบัญชีที่นี่ สิทธิ์เข้าสู่ระบบ BD จัดการผ่านทีมและช่องทาง ในแท็บเข้าสู่ระบบของโปรไฟล์ BD ไม่ใช่ขั้นสร้างสมาชิกนี้ บทแนะนำไม่สร้างบัญชี",
        rolesTitle: "บทบาทในตัวและแบบกำหนดเอง",
        rolesBody:
          "บทบาทในตัวถูกล็อก ใช้บทบาทกำหนดเองสำหรับชุดสิทธิ์ที่แก้ไขได้และตรวจการมอบหมายก่อนเปลี่ยนสิทธิ์ บทแนะนำไม่สร้าง แก้ไข หรือลบบทบาท",
      },
      shopAnalytics: {
        welcomeBody:
          "ตรวจสุขภาพ SPS สดของร้านสหรัฐฯ ที่รองรับ ร้านที่เข้าเกณฑ์และการเลือกจำกัดขอบเขตสด นี่ไม่ใช่รายงานทุกตลาด ใช้ภาพรวมและการวินิจฉัยร้านตรวจการเปลี่ยนแปลง",
        scopeTitle: "เลือกร้านสหรัฐฯ ที่เข้าเกณฑ์",
        scopeBody:
          "เลือกได้สูงสุด 50 ร้านสหรัฐฯ ที่เข้าเกณฑ์สำหรับ SPS สด การค้นหาจำกัดตัวเลือกที่มองเห็น ไม่เปลี่ยนขอบเขตที่เลือก หากร้านมากเกินไปต้องเลือกขอบเขตก่อนโหลดข้อมูล ตลาดที่ไม่รองรับจะถูกตัดออก",
        trendBody:
          "เปรียบเทียบร้านที่เลือกตามเวลาและองค์ประกอบ SPS กราฟแสดงสูงสุดหกเส้นร้าน เส้นที่ไม่ปรากฏไม่ได้พิสูจน์ว่าไม่มีข้อมูล ให้ตรวจตารางวินิจฉัยร้านด้วย",
      },
    },
  },
};
