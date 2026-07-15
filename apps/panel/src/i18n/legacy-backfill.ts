// Historical i18n backfill for keys that were previously present only in en/zh.
// Keep this file shrinking: once a locale file receives native entries, remove
// the corresponding keys here and lower the baseline in languages.test.ts.

export const LEGACY_I18N_BACKFILL = {
  "de": {
    "adsManagement": {
      "adsReadyShops": "Anzeigenbereite Shops",
      "advertiserTableSubtitle": "Verbinden Sie TikTok Business oder Ads Manager, dann synchronisiert Airflow Kampagnen-, Anzeigengruppen-, Anzeigen- und GMV Max-Berichtsdaten dieser Werbetreibenden.",
      "advertiserTableTitle": "Werbekonten",
      "authSeparationHint": "Der Zugriff auf TikTok Ads wird über den Business/Ads Manager gewährt. EasyClaw verwaltet nur Shops, die auch als TikTok Shops autorisiert sind.",
      "authStatus": {
        "AUTHORIZED": "Autorisiert",
        "DISCONNECTED": "Getrennt",
        "REVOKED": "Widerrufen",
        "TOKEN_EXPIRED": "Token abgelaufen"
      },
      "authorizedAdvertisers": "Autorisiert",
      "needsAttention": "Benötigt Aufmerksamkeit",
      "businessAccountHint": "Die TikTok Ads-Autorisierung gewährt Werbetreibenden Zugriff. Die Store-Abdeckung ist nur dann umsetzbar, wenn ein für den Werbetreibenden sichtbarer Store einem von EasyClaw autorisierten Shop zugeordnet ist.",
      "columns": {
        "actions": "Aktionen",
        "advertiserId": "Werbetreibenden-ID",
        "currency": "Währung",
        "name": "Inserent",
        "role": "Rolle",
        "status": "Authentifizierungsstatus",
        "syncHealth": "BI-Sync",
        "tokenExpiry": "Token läuft ab",
        "updatedAt": "Aktualisiert",
        "visibleStores": "Sichtbare Geschäfte"
      },
      "confirmDisconnect": "Dieses Werbekonto trennen? Die BI-Synchronisierung wird gestoppt, bis sie erneut autorisiert wird.",
      "connect": "Verbinden Sie TikTok-Anzeigen",
      "connectAdvertiser": "Ads-Konto verbinden",
      "connectBusiness": "Verbinden Sie TikTok Business",
      "copyFailed": "Der Autorisierungslink konnte nicht kopiert werden.",
      "disconnect": "Trennen",
      "disconnectFailed": "Das Werbekonto konnte nicht getrennt werden.",
      "disconnectSuccess": "Werbekonto getrennt.",
      "emptyAdvertisersBody": "Verbinden Sie TikTok Business oder Ads Manager, um Werbetreibende und ihre sichtbaren Shops zu entdecken.",
      "emptyAdvertisersTitle": "Keine Werbekonten verbunden",
      "loadFailed": "Die Anzeigenverwaltungsdaten konnten nicht geladen werden.",
      "noShops": "Noch keine Shops verbunden.",
      "oauthFailed": "Die TikTok Ads-Autorisierung konnte nicht gestartet werden.",
      "oauthHint": "Öffnen Sie diesen Link in einem Browser, der beim TikTok Business Center oder Ads Manager-Konto angemeldet ist, dem die Werbetreibenden gehören.",
      "oauthModalTitle": "Verbinden Sie TikTok-Anzeigen",
      "oauthSuccess": "TikTok Business-Verbindung erfolgreich abgeschlossen.",
      "oauthTimeout": "Zeitüberschreitung bei der Autorisierung. Aktualisieren Sie die Seite, wenn die Autorisierung im Browser abgeschlossen ist.",
      "openAuthLink": "Öffnen Sie den Autorisierungslink für TikTok Ads",
      "syncHealth": {
        "FAILED": "Problem",
        "HEALTHY": "Gesund"
      },
      "syncIssue": {
        "BACKEND_ERROR": "Backend-Sync-Problem",
        "PERMISSION_DENIED": "Advertiser-Berechtigung verloren",
        "PLATFORM_ERROR": "TikTok Ads API-Problem",
        "UNKNOWN": "Sync-Problem"
      },
      "shopAdsStatus": {
        "connected": "Bedeckt",
        "needs_advertiser": "Kein Werbekonto",
        "needs_link": "Nicht abgedeckt"
      },
      "shopColumns": {
        "action": "Aktion",
        "adsStatus": "Anzeigenstatus",
        "advertiser": "Aktive Werbekonten",
        "coverage": "Abdeckung",
        "gmvMax": "Aktuelle GMV-Max-Autorisierung",
        "region": "Region",
        "shop": "Geschäft",
        "storeId": "Store-ID"
      },
      "currentGmvMaxAccount": "Aktuelles GMV Max",
      "gmvMaxAvailable": "GMV Max verfügbar",
      "currentGmvMaxUnknown": "Aktuell autorisiertes Konto wird synchronisiert",
      "shopCoverageSubtitle": "Zeigt alle aktuell aktiven Werbekonten pro Shop und kennzeichnet die aktuelle GMV-Max-Autorisierung separat. Dies ist keine datumsbezogene Ansicht des Auslieferungskontos.",
      "shopCoverageTitle": "Verwaltete Shop-Abdeckung",
      "shopReadinessSubtitle": "Überprüfen Sie die Ads-Kontoabdeckung, die Shop-Sichtbarkeit und die GMV-Max-Bereitschaft jedes angeschlossenen Shops.",
      "shopReadinessTitle": "Shop-Anzeigenbereitschaft",
      "subtitle": "Verbinden Sie den TikTok Business-Zugang und überprüfen Sie, welche autorisierten Shops von diesen Werbekonten abgedeckt werden.",
      "title": "TikTok-Anzeigenverwaltung",
      "totalAdvertisers": "Werbekonten",
      "unonboardedStoreCount": "Für Werbetreibende sichtbare {{count}}-Shops sind nicht in EasyClaw integriert",
      "waitingAuth": "Warten auf die Autorisierung für TikTok Ads..."
    },
    "common": {
      "no": "Nein",
      "website": "Webseite",
      "yes": "Ja"
    },
    "ecommerce": {
      "affiliateWorkspace": {
        "approvalQueueTitle": "Aktionsvorschläge",
        "creatorRelationshipWorkPrimaryObject": "Kooperationsdatensatz",
        "creatorRelationshipPrimaryObject": "Creator-Beziehung",
        "creatorRelationshipWorkItems": "Kooperationsdatensätze",
        "creatorIdentityObject": "Creator-Identität",
        "creatorIdentityId": "Identitäts-System-ID",
        "creatorBlocked": "Blockiert",
        "relationshipShopStates": "Shop-Status",
        "relationshipActiveCollaborations": "Aktive Kooperationen",
        "relationshipTagCount": "{{count}} Tag(s)",
        "relationshipWorkCollaborationCount": "{{count}} Kooperation(en)",
        "relationshipWorkShortLabel": "Datensatz {{id}}",
        "relationshipWorkActiveCollaborations": "Aktive Kooperationen",
        "relationshipWorkPendingProposals": "Ausstehende Vorschläge",
        "focusedProposal": "Ausgewählter Vorschlag",
        "relationshipWorkbenchSubtitle": "Arbeitsbereich für Creator-Profil, Kommunikation, Kooperationen und Aktionsverlauf.",
        "relationshipProfileSummary": "Creator-Übersicht",
        "relationshipCurrentDecision": "Aktuelle Aufgabe",
        "relationshipPanelCurrentWork": "Aktuelle Aufgabe",
        "relationshipPanelCommunication": "Kommunikationsverlauf",
        "relationshipPanelCollaborations": "Kooperationsdatensätze",
        "relationshipPanelActivity": "Aktionsverlauf",
        "activity": {
          "loadOlder": "Ältere Aktivitäten laden"
        },
        "relationshipNoCurrentWork": "Keine aktive Aufgabe",
        "relationshipNoCurrentWorkHint": "Für diese Creator-Beziehung gibt es derzeit keinen ausstehenden Vorschlag und keine manuelle Aufgabe.",
        "relationshipNeedsManualReview": "Diese Creator-Beziehung muss vor dem nächsten Schritt von Mitarbeitenden geprüft werden.",
        "relationshipAcrossShops": "Shopübergreifend",
        "relationshipCommunicationHint": "Aus verfügbaren Shop-, Plattformchat-, WhatsApp- und E-Mail-Daten zusammengeführt.",
        "noRecentContact": "Kein aktueller Kontakt",
        "relationshipMoreShopStates": "+{{count}} weitere Shop-Status",
        "relationshipWorkUnread": "Ungelesen",
        "relationshipWorkMoreCollaborations": "+{{count}} weitere Kooperationen",
        "relationshipWorkPlatformChat": "Konversation",
        "relationshipWorkLastInbound": "Letzte Creator-Nachricht",
        "relationshipWorkLastOutbound": "Letzte Händlerantwort",
        "relationshipWorkContext": "Datensatzkontext",
        "relationshipWorkAmbiguousCollaborations": "Mögliche Kooperationskontexte",
        "relationshipWorkNoCollaborations": "Dieser Kooperationsdatensatz ist noch mit keiner Produktkooperation verknüpft.",
        "relationshipWorkNoPendingProposals": "Keine ausstehenden Vorschläge in diesem Kooperationsdatensatz.",
        "relationshipWorkActiveTitle": "{{count}} aktive Kooperation(en)",
        "relationshipConversationTitle": "Beziehungskonversation",
        "relationshipWorkAmbiguousSummary": "Dieser Kooperationsdatensatz hat mehrere mögliche Produktkontexte. Prüfen Sie sie, bevor Sie produktspezifische Aktionen ausführen.",
        "relationshipWorkDefaultSummary": "Kooperationsdatensatz zwischen Shop und Creator. Produktkooperationen erscheinen hier, sobald Produkt- oder Sample-Kontext bekannt ist.",
        "openCreatorRelationshipWorkDetailHint": "Kooperationsdatensatz öffnen, um Konversation, Vorschläge und zugehörige Kooperationen zu prüfen.",
        "copyRelationshipWorkSystemId": "System-ID kopieren",
        "messageChannels": {
          "PLATFORM_CHAT": "TikTok Shop",
          "WHATSAPP": "WhatsApp",
          "EMAIL": "Email"
        },
        "collaborationRecordObject": "Kooperation",
        "attentionFilters": {
          "ALL": "Alle",
          "APPROVAL_REQUIRED": "Zulassungen",
          "MANUAL_FOLLOW_UP": "Manuelle Nachverfolgung",
          "STAFF_ACTION_REQUIRED": "Mitarbeiteraktion"
        },
        "collaborationWorkBadges": {
          "agent": "Agent",
          "approval": "Genehmigung",
          "blocked": "Blockiert",
          "done": "Erledigt",
          "staff": "Personal",
          "waitingCreator": "Schöpfer",
          "waitingExternal": "Extern",
          "waitingPlatform": "Plattform"
        },
        "collaborationFilters": {
          "AGENT_REQUIRED": "Agent erforderlich",
          "STAFF_REQUIRED": "Personal erforderlich",
          "WAITING_EXTERNAL": "Wartet auf externe Antwort",
          "IDLE": "Inaktiv"
        },
        "collaborationWorkDescriptions": {
          "BLOCKED": "Diese Zusammenarbeit ist blockiert und wird nicht automatisch weiterentwickelt.",
          "DEFAULT": "Öffnen Sie die Detailansicht, um den Verlauf, Vorschläge und Plattformereignisse zu überprüfen.",
          "DONE": "Zu dieser Zusammenarbeit gibt es keine offene Arbeit. Öffnen Sie die Detailansicht, um den Verlauf einzusehen.",
          "FOLLOW_UP_CREATOR": "Der nächste Schritt auf Erstellerseite ist überfällig. Kontaktieren Sie den Ersteller basierend auf dem aktuellen Kontext der Zusammenarbeit.",
          "PROPOSAL_REJECTED": "Das Personal lehnte die Empfehlung des Agenten ab. Das System wird diesen Vorschlag nicht ausführen; Behandeln Sie es manuell oder warten Sie auf das nächste Ersteller-/Plattformereignis.",
          "RESOLVE_CREATOR_IDENTITY": "Das System kann diesen Ersteller noch nicht zuverlässig identifizieren. Bestätigen Sie die Identität manuell oder warten Sie auf weitere Plattformdaten.",
          "RESPOND_TO_CREATOR": "Der Agent erstellt eine Antwort unter Verwendung der letzten Konversation, des Produktkontexts und des Kooperationsverlaufs. Wenn eine Genehmigung erforderlich ist, wird zunächst ein Vorschlag erstellt.",
          "REVIEW_ACTION_PROPOSAL": "Der Agent hat einen Plattform-Aktionsvorschlag erstellt. Genehmigen oder lehnen Sie es auf der Seite Aktionsvorschläge ab.",
          "REVIEW_AGENT_FAILURE": "Der Agent hat dieses Arbeitselement nicht abgeschlossen. Überprüfen Sie den Datensatz und entscheiden Sie manuell über den nächsten Schritt.",
          "REVIEW_COLLABORATION": "Diese Zusammenarbeit erfordert das Urteilsvermögen des Personals. Öffnen Sie die Detailansicht, überprüfen Sie den Verlauf und entscheiden Sie dann, ob Sie ihn auf der Plattform bearbeiten möchten.",
          "REVIEW_SAMPLE_APPLICATION": "Der Ersteller hat eine Beispielanfrage eingereicht. Der Agent verwendet Shop-Regeln und Vorhersageergebnisse, um eine Genehmigung oder Ablehnung zu empfehlen.",
          "SHIP_SAMPLE": "Die Musteranforderung wurde genehmigt. Das Personal sollte den Versand im Plattform- oder Lagerfluss organisieren.",
          "WAITING_CREATOR": "Derzeit sind keine Maßnahmen des Personals erforderlich. Warten darauf, dass der Ersteller antwortet, das Beispiel erhält oder Inhalte veröffentlicht.",
          "WAITING_PLATFORM": "Derzeit sind keine Maßnahmen des Personals erforderlich. Warten darauf, dass der TikTok Shop Beispiel-, Inhalts- oder Kooperationsaktualisierungen synchronisiert."
        },
        "collaborationWorkQueueTitle": "Kooperationen, die eine personelle Betreuung erfordern",
        "collaborationWorkTitles": {
          "BLOCKED": "Dieser Ersteller ist blockiert",
          "DONE": "Diese Zusammenarbeit wird abgewickelt",
          "PROPOSAL_REJECTED": "Vorschlag abgelehnt; Nachbereitung durch das Personal erforderlich",
          "PROPOSAL_REVISION_REQUESTED": "Überarbeitung des Vorschlags angefordert",
          "RESPOND_TO_CREATOR": "Antworte dem Ersteller",
          "REVIEW_ACTION_PROPOSAL": "Überprüfen Sie den Agentenvorschlag",
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Musterinhalt nachfassen",
          "WAITING_CREATOR": "Warten auf den Schöpfer",
          "WAITING_PLATFORM": "Warten auf Plattform-Updates"
        },
        "empty": {
          "HISTORY": "Noch kein Affiliate-Arbeitsverlauf.",
          "IN_PROGRESS": "Derzeit sind keine Affiliate-Kooperationen im Gange.",
          "NEEDS_ATTENTION": "Im Moment braucht keine Affiliate-Arbeit Aufmerksamkeit."
        },
        "labels": {
          "nextStep": "Nächster Schritt"
        },
        "historyFilters": {
          "AGENT_REQUIRED": "Agent erforderlich",
          "STAFF_REQUIRED": "Personal erforderlich",
          "WAITING_EXTERNAL": "Wartet auf externe Antwort",
          "IDLE": "Inaktiv"
        },
        "lifecycleEventPreview": "Plattform-/Systemereignis: {{eventType}}",
        "lifecycleEvents": {
          "PROPOSAL_REVISION_REQUESTED": "Überarbeitung des Vorschlags angefordert"
        },
        "manualFollowUpNote": "Der Agentenvorschlag wurde abgelehnt. Die Mitarbeiter sollten diesen Punkt manuell auf der Plattform oder in der Folgekommunikation bearbeiten.",
        "processReasons": {
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Musterinhalt nachfassen"
        },
        "requiredActions": {
          "NONE": "Keine Aktion erforderlich",
          "NO_ACTION": "Keine Aktion erforderlich",
          "RESPOND_TO_CREATOR": "Creator antworten",
          "REPLY_TO_CREATOR": "Creator antworten",
          "REVIEW_SAMPLE_APPLICATION": "Probenantrag prüfen",
          "SHIP_SAMPLE": "Probe versenden",
          "FOLLOW_UP_CREATOR": "Creator nachfassen",
          "COMPLETE_COLLABORATION_TASK": "Kooperationsaufgabe abschließen",
          "REVIEW_COLLABORATION": "Kooperation prüfen",
          "RESOLVE_CREATOR_IDENTITY": "Creator-Identität klären",
          "REVIEW_AGENT_FAILURE": "Agentenfehler prüfen",
          "REVIEW_ACTION_PROPOSAL": "Aktionsvorschlag prüfen",
          "REVIEW_AMBIGUOUS_CONTEXT": "Mehrdeutigen Kontext prüfen",
          "WAIT_CREATOR_RESPONSE": "Auf Creator-Antwort warten",
          "WAIT_PLATFORM_UPDATE": "Auf Plattform-Update warten"
        },
        "statusLabels": {
          "AGENT_REQUIRED": "Agent erforderlich",
          "STAFF_REQUIRED": "Personal erforderlich",
          "EXTERNAL_WAITING": "Wartet auf externe Antwort",
          "WAITING_EXTERNAL": "Wartet auf externe Antwort",
          "IDLE": "Inaktiv"
        },
        "workKinds": {
          "RELATIONSHIP": "Creator-Beziehung",
          "APPROVAL_REVIEW": "Genehmigungsprüfung",
          "CONTENT_FOLLOW_UP": "Content-Nachfassung",
          "CREATOR_FOLLOW_UP": "Creator-Nachfassung",
          "IDENTITY_RESOLUTION": "Identitätsklärung",
          "INBOUND_MESSAGE_TRIAGE": "Eingehende Nachricht prüfen",
          "MANUAL_REVIEW": "Manuelle Prüfung",
          "OBSERVATION_REVIEW": "Beobachtungsprüfung",
          "SAMPLE_APPLICATION_DECISION": "Probenantrag-Entscheidung",
          "SAMPLE_SHIPMENT": "Probenversand"
        },
        "sampleStatusPreview": "Beispielstatus: {{status}}; {{contentCount}}-Inhaltselemente wurden beobachtet.",
        "sectionHints": {
          "HISTORY": "Ausgeführte Aktionen, abgelehnte Vorschläge, Plattformereignisse und direkte Agentenaktionen.",
          "IN_PROGRESS": "Die Zusammenarbeit mit den Erstellern schreitet bereits voran, ohne dass das Personal sofort Maßnahmen ergreifen muss.",
          "NEEDS_ATTENTION": "Affiliate-Arbeiten, die einer Genehmigung, manuellen Nachverfolgung oder Agentenbearbeitung bedürfen."
        },
        "sections": {
          "HISTORY": "Geschichte",
          "IN_PROGRESS": "Im Gange",
          "NEEDS_ATTENTION": "Braucht Aufmerksamkeit"
        },
        "summary": {
          "historyHint": "Aktuelles Arbeitsprotokoll",
          "inProgressHint": "Warten auf Ersteller oder Plattform",
          "needsAttentionHint": "Genehmigungen und Nachverfolgung durch das Personal"
        }
      },
      "customerServiceWorkspace": {
        "filterAiState": "KI-Handhabung",
        "filterConversationStatus": "Gesprächsstatus",
        "filterEscalationState": "Eskalation",
        "filterPageSize": "Seitengröße",
        "filterSearch": "Suchen",
        "filterShop": "Geschäft",
        "filterStatus": "Status"
      },
      "shopAdsStatus": {
        "connected": "Verbunden",
        "hint_connected": "Dieser Shop ist mit einem TikTok Ads Store verknüpft.",
        "hint_needs_advertiser": "Verknüpfen Sie ein TikTok Ads-Konto, bevor dieser Shop für die Anzeigenberichterstattung verwendet werden kann.",
        "hint_needs_link": "Ein TikTok Ads-Konto ist verbunden, aber dieser Shop benötigt noch eine Überprüfung der Sichtbarkeit im Ads Store.",
        "needs_advertiser": "Kein Ads-Konto",
        "needs_link": "Muss überprüft werden"
      },
      "table": {
        "headers": {
          "adsStatus": "Anzeigen"
        },
        "manageAds": "Anzeigen verwalten"
      }
    },
    "nav": {
      "account": "Konto",
      "group": {
        "accountSystem": "Konto und System",
        "automation": "Automatisierung",
        "connections": "Verbindungen & Modelle",
        "shopOperations": "Shop-Betrieb"
      }
    },
    "tools": {
      "selector": {
        "name": {
          "CS_DISMISS_CONVERSATION_ESCALATIONS": "Gesprächseskalationen ablehnen",
          "ECOM_GET_OPERATION_REPORT": "Holen Sie sich den Betriebsbericht",
          "ECOM_GET_SHOP_ORDER_SKU_EXPORT": "Bestell-SKUs exportieren",
          "ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED": "Konversations-KI festlegen"
        }
      }
    },
    "tutorial": {
      "adsManagement": {
        "actionsBody": "Verwenden Sie Connect TikTok Business, um den Zugriff für Werbetreibende zu autorisieren. Aktualisieren Sie aktualisierte Werbetreibende, sichtbare Geschäfte und Shop-Abdeckung.",
        "actionsTitle": "Verbinden und aktualisieren",
        "advertisersBody": "Jede Zeile ist ein Werbetreibender, der über die TikTok Business-Autorisierung verfügbar ist, einschließlich Rolle, Token-Status und sichtbarer Store-Anzahl.",
        "advertisersTitle": "Werbekonten",
        "shopCoverageBody": "Nur Shops, die bereits in EasyClaw autorisiert sind, werden strafbar. Für Werbetreibende sichtbare Shops, die nicht integriert sind, dienen weiterhin der Information.",
        "shopCoverageTitle": "Verwaltete Shop-Abdeckung",
        "summaryBody": "Diese Zähler trennen autorisierte Werbetreibende von Shops, die tatsächlich in EasyClaw verwaltet werden können.",
        "summaryTitle": "Zusammenfassung der Abdeckung",
        "welcomeBody": "Diese Seite verbindet den TikTok Business-Zugang und zeigt, welche von EasyClaw autorisierten Shops durch für Werbetreibende sichtbare Shops abgedeckt sind.",
        "welcomeTitle": "TikTok-Anzeigen"
      },
      "billing": {
        "accountActionsBody": "Verwenden Sie diese Schaltflächen, um den Checkout zu starten, die Zahlungsmethode zu verwalten oder das Abrechnungsportal zu öffnen, wenn diese Aktionen für Ihren Plan verfügbar sind.",
        "accountActionsTitle": "Kontoabrechnungsaktionen",
        "accountPlanBody": "Diese Karte zeigt Ihre KI-Berechtigung auf Kontoebene, den Planstatus, die Gültigkeit und die Nutzungsbeschränkungen für allgemeine Agentenläufe.",
        "accountPlanTitle": "Konto-KI-Plan",
        "overviewBody": "In der Kopfzeile wird erläutert, welche Abrechnungsdaten hier angezeigt werden. Auf dieser Seite können Sie den aktuellen Zugriff überprüfen und kostenpflichtige Dienste verwalten.",
        "overviewTitle": "Abrechnungsübersicht",
        "paymentsBody": "Abgeschlossene Zahlungen und Rechnungen werden hier angezeigt, sodass Sie die letzten Rechnungsaktivitäten überprüfen können, ohne die Desktop-App zu verlassen.",
        "paymentsTitle": "Zahlungsaufzeichnungen",
        "shopListBody": "Jede Zeile fasst die aktivierten kostenpflichtigen Dienste, den Status, die Verlängerungsinformationen und die Service-Level-Aktionen eines Shops zusammen.",
        "shopListTitle": "Shop-Abonnementliste",
        "shopServicesBody": "Die Abrechnung von Shop-Services erfolgt getrennt von der Konto-AI-Abrechnung. Jeder angeschlossene Shop kann dienstleistungsspezifischen Zugriff haben, beispielsweise auf den KI-Kundenservice.",
        "shopServicesTitle": "Shop-Dienstleistungen",
        "subscribeFlowBody": "Mit diesem Ablauf können Sie vor dem Bezahlen einen Shop und einen Serviceplan auswählen. Es erscheint nur, wenn es Geschäfte gibt, die Anspruch auf zusätzlichen Servicezugang haben.",
        "subscribeFlowTitle": "Abonnieren Sie einen Shop",
        "usageBody": "Nutzungskarten und Metadaten zeigen das verbleibende Kontingent, den Verlängerungszeitpunkt und den Abonnementstatus. Bei diesen Details handelt es sich um schreibgeschützte Snapshots aus dem Abrechnungs-Backend.",
        "usageTitle": "Nutzungs- und Plandetails",
        "welcomeBody": "Auf dieser Seite sind Konto-KI-Abonnements, Shop-Service-Abonnements und Zahlungsaufzeichnungen zusammengefasst.",
        "welcomeTitle": "Willkommen bei Billing"
      },
      "ecommerce": {
        "drawerBody": "In der Schublade befindet sich die Konfiguration pro Shop: Übersicht, KI-Kundenservice, Inventar, Affiliate-Management, Abrechnung und Gerätebindung.",
        "drawerTitle": "Ladenschublade",
        "shopActionsBody": "Aktualisieren ruft den neuesten Shop-Status ab. „Shop hinzufügen“ startet den Plattform-OAuth-Ablauf zum Verbinden eines anderen Verkäuferkontos.",
        "shopActionsTitle": "Shop-Aktionen",
        "shopAliasBody": "Mit Aliasnamen können Sie einen Shop lokal umbenennen, um ihn leichter wiederzuerkennen. Drücken Sie die Eingabetaste oder verwischen Sie das Feld, um es zu speichern.",
        "shopAliasTitle": "Shop-Alias",
        "shopRowActionsBody": "Öffnen Sie die Schublade, um Dienste zu konfigurieren, abgelaufene Token erneut zu autorisieren oder einen Shop zu trennen.",
        "shopRowActionsTitle": "Zeilenaktionen",
        "shopTableBody": "Die Tabelle zeigt Shop-Identität, Alias, Plattform, Region, Autorisierungsstatus, Kontostand und Zeilenaktionen.",
        "shopTableTitle": "Shop-Tisch",
        "shopsBody": "Der Shop-Bereich listet alle verbundenen Verkäuferkonten auf und bietet Ihnen die wichtigsten betrieblichen Einstiegspunkte für jeden Shop.",
        "shopsTitle": "Vernetzte Geschäfte",
        "welcomeBody": "Diese Seite verwaltet verbundene Shops, KI-Kundenservice, Affiliate-Automatisierung und Lagerintegrationen für das E-Commerce-Modul.",
        "welcomeTitle": "Willkommen im globalen E-Commerce",
        "wmsActionsBody": "Aktualisieren Sie den Bestandsstatus, überprüfen Sie unterstützte WMS-Anbieter oder fügen Sie ein Lagerkonto hinzu.",
        "wmsActionsTitle": "Lageraktionen",
        "wmsBody": "Lagerkonten verbinden Ihre Shop-Daten mit Bestands- und Fulfillment-Systemen.",
        "wmsTableBody": "Die Lagertabelle zeigt synchronisierte Lager, Endpunkte, Währungen, Synchronisierungszeit und Bestandsverwaltungsaktionen.",
        "wmsTableTitle": "Lagertisch",
        "wmsTitle": "Lagerkonten"
      },
      "ecommerceAffiliate": {
        "actionsBody": "Genehmigen wendet den Vorschlag an. Bei „Ablehnen“ wird es mit einer Entscheidungsnotiz verworfen, sodass die Automatisierung diese Aktion nicht ausführt.",
        "actionsTitle": "Genehmigen oder ablehnen",
        "panelBody": "Das Panel enthält ausstehende Ersteller- oder Kooperationsvorschläge, gruppiert nach Shop und Erstellerkontext.",
        "panelTitle": "Vorschlagsgremium",
        "proposalCardBody": "Auf jeder Karte werden der Aktionstyp, die Begründung, die Ziel-IDs und der Richtlinienkontext für die vorgeschlagene Affiliate-Operation erläutert.",
        "proposalCardTitle": "Vorschlagskarte",
        "queueBody": "Hier erscheinen Vorschlagsgruppen. Leere Zustände sind normal, wenn keine KI-Aktion auf die Zustimmung des Menschen wartet.",
        "queueTitle": "Vorschlagswarteschlange",
        "shopFilterBody": "Verwenden Sie den Shop-Filter, um sich auf ein Verkäuferkonto zu konzentrieren oder Vorschläge für alle Shops zu überprüfen.",
        "shopFilterTitle": "Shop-Filter",
        "toolbarBody": "Die Symbolleiste zeigt die ausstehende Anzahl, den Shop-Filter und die Aktualisierungsaktion zum Abrufen der neuesten Vorschläge an.",
        "toolbarTitle": "Symbolleiste",
        "welcomeBody": "In diesem Arbeitsbereich werden KI-generierte Affiliate-Aktionsvorschläge überprüft, bevor sie angewendet werden.",
        "welcomeTitle": "Willkommen beim Affiliate-Management"
      },
      "ecommerceCustomerService": {
        "conversationDetailBody": "Im Detailbereich werden Nachrichten, Zusammenfassungstools, KI-Aktivierung, manuelle Antwortsteuerungen und Metadaten für die ausgewählte Konversation angezeigt.",
        "conversationDetailTitle": "Gesprächsdetails",
        "conversationListBody": "Jede Zeile fasst ein Käufergespräch mit Shop, Zeitstempel, Status, Eskalationsabzeichen und Vorschautext zusammen.",
        "conversationListTitle": "Gesprächsliste",
        "conversationShellBody": "In der geteilten Ansicht bleibt die Warteschlange links und das ausgewählte Konversationsdetail rechts.",
        "conversationShellTitle": "Konversationsarbeitsbereich",
        "escalationQueueBody": "Auf der Registerkarte „Eskalation“ werden offene oder ausstehende Fälle aufgeführt, die überprüft, beantwortet oder abgewiesen werden müssen.",
        "escalationQueueTitle": "Eskalationswarteschlange",
        "filtersBody": "Filtern Sie nach Shop, Konversationsstatus, KI-Status, Eskalationsstatus und Seitengröße, um die Warteschlange zu fokussieren.",
        "filtersTitle": "Filter",
        "manualReplyBody": "Verwenden Sie die manuelle Antwort, wenn ein Mensch direkt antworten muss. Dies funktioniert zusammen mit den KI-Steuerelementen für die Konversation.",
        "manualReplyTitle": "Manuelle Antwort",
        "searchBody": "Durch die Suche wird die Warteschlange nach Käufer-, Bestell- oder Konversationskennungen eingegrenzt. Wenden Sie die Suche an, um die aktuelle Arbeitsbereichsansicht zu aktualisieren.",
        "searchTitle": "Suchen",
        "tabsBody": "Wechseln Sie zwischen dem Live-Konversations-Posteingang und der Eskalationswarteschlange. Mithilfe von Zählungen können Sie die aktuelle Arbeitsbelastung auf einen Blick erkennen.",
        "tabsTitle": "Arbeitsbereich-Registerkarten",
        "welcomeBody": "Dieser Arbeitsbereich dient der Überwachung von Käufergesprächen und der Bearbeitung von KI-Eskalationen in verbundenen Shops.",
        "welcomeTitle": "Willkommen beim Kundenservice"
      },
      "settings": {
        "showAgentNameBody": "Steuert, ob das Markenlabel der Seitenleiste den aktuellen Agentennamen anstelle des App-Namens anzeigen darf. Aktivieren Sie es, wenn Sie mehrere benannte Agenten ausführen und schnell visuell überprüfen möchten, welcher Agent aktiv ist.",
        "showAgentNameTitle": "Name des Sidebar-Agenten"
      }
    }
  },
  "es": {
    "adsManagement": {
      "adsReadyShops": "Tiendas listas para anuncios",
      "advertiserTableSubtitle": "Conecte TikTok Business o Ads Manager y luego Airflow sincroniza los datos de informes de campañas, grupos de anuncios, anuncios y GMV Max de estos anunciantes.",
      "advertiserTableTitle": "Cuentas publicitarias",
      "authSeparationHint": "El acceso a TikTok Ads se otorga a través de Business/Ads Manager. EasyClaw sólo gestiona tiendas que también estén autorizadas como TikTok Shops.",
      "authStatus": {
        "AUTHORIZED": "Autorizado",
        "DISCONNECTED": "Desconectado",
        "REVOKED": "Revocado",
        "TOKEN_EXPIRED": "Token caducado"
      },
      "authorizedAdvertisers": "Autorizado",
      "needsAttention": "Requiere atención",
      "businessAccountHint": "La autorización de TikTok Ads otorga acceso al anunciante. La cobertura de la tienda es procesable solo cuando una tienda visible para el anunciante se asigna a una tienda autorizada por EasyClaw.",
      "columns": {
        "actions": "Comportamiento",
        "advertiserId": "ID de anunciante",
        "currency": "Divisa",
        "name": "Anunciante",
        "role": "Role",
        "status": "Estado de autenticación",
        "syncHealth": "Sincronización BI",
        "tokenExpiry": "El token caduca",
        "updatedAt": "Actualizado",
        "visibleStores": "Tiendas visibles"
      },
      "confirmDisconnect": "¿Desconectar esta cuenta publicitaria? La sincronización de BI se detendrá hasta que se vuelva a autorizar.",
      "connect": "Conectar anuncios de TikTok",
      "connectAdvertiser": "Conectar cuenta de anuncios",
      "connectBusiness": "Conecte el negocio de TikTok",
      "copyFailed": "No se pudo copiar el enlace de autorización.",
      "disconnect": "Desconectar",
      "disconnectFailed": "No se pudo desconectar la cuenta publicitaria.",
      "disconnectSuccess": "Cuenta publicitaria desconectada.",
      "emptyAdvertisersBody": "Conecte TikTok Business o Ads Manager para descubrir anunciantes y sus tiendas visibles.",
      "emptyAdvertisersTitle": "No hay cuentas publicitarias conectadas",
      "loadFailed": "No se pudieron cargar los datos de administración de anuncios.",
      "noShops": "Aún no hay tiendas conectadas.",
      "oauthFailed": "No se pudo iniciar la autorización de anuncios de TikTok.",
      "oauthHint": "Abra este enlace en un navegador que haya iniciado sesión en TikTok Business Center o en la cuenta del Administrador de anuncios propiedad de los anunciantes.",
      "oauthModalTitle": "Conectar anuncios de TikTok",
      "oauthSuccess": "La conexión de TikTok Business se completó con éxito.",
      "oauthTimeout": "Se agotó el tiempo de autorización. Actualice la página si se completó la autorización en el navegador.",
      "openAuthLink": "Abra el enlace de autorización de anuncios de TikTok",
      "syncHealth": {
        "FAILED": "Problema",
        "HEALTHY": "Correcto"
      },
      "syncIssue": {
        "BACKEND_ERROR": "Problema de sincronización backend",
        "PERMISSION_DENIED": "Permiso del anunciante perdido",
        "PLATFORM_ERROR": "Problema de API de TikTok Ads",
        "UNKNOWN": "Problema de sincronización"
      },
      "shopAdsStatus": {
        "connected": "Cubierto",
        "needs_advertiser": "Sin cuenta publicitaria",
        "needs_link": "No cubierto"
      },
      "shopColumns": {
        "action": "Acción",
        "adsStatus": "Estado de los anuncios",
        "advertiser": "Cuentas publicitarias activas",
        "coverage": "Cobertura",
        "gmvMax": "Autorización GMV Max actual",
        "region": "Región",
        "shop": "Comercio",
        "storeId": "ID de tienda"
      },
      "currentGmvMaxAccount": "GMV Max actual",
      "gmvMaxAvailable": "GMV Max disponible",
      "currentGmvMaxUnknown": "La cuenta autorizada actual está pendiente de sincronización",
      "shopCoverageSubtitle": "Muestra todas las cuentas publicitarias activas de cada tienda e identifica por separado la autorización GMV Max actual. No es una vista por fecha de la cuenta de entrega.",
      "shopCoverageTitle": "Cobertura de tienda administrada",
      "shopReadinessSubtitle": "Revise la cobertura de la cuenta de anuncios de cada tienda conectada, la visibilidad de la tienda y la preparación de GMV Max.",
      "shopReadinessTitle": "Preparación para los anuncios de la tienda",
      "subtitle": "Conecte el acceso a TikTok Business y verifique qué tiendas autorizadas están cubiertas por esas cuentas publicitarias.",
      "title": "Gestión de anuncios de TikTok",
      "totalAdvertisers": "Cuentas publicitarias",
      "unonboardedStoreCount": "Las tiendas {{count}} visibles para el anunciante no están incorporadas en EasyClaw",
      "waitingAuth": "Esperando autorización de TikTok Ads..."
    },
    "common": {
      "no": "No",
      "website": "Sitio web",
      "yes": "Sí"
    },
    "ecommerce": {
      "affiliateWorkspace": {
        "approvalQueueTitle": "Propuestas de acción",
        "creatorRelationshipWorkPrimaryObject": "Registro de colaboración",
        "creatorRelationshipPrimaryObject": "Relación con el creador",
        "creatorRelationshipWorkItems": "Registros de colaboración",
        "creatorIdentityObject": "Identidad del creador",
        "creatorIdentityId": "ID del sistema de identidad",
        "creatorBlocked": "Bloqueado",
        "relationshipShopStates": "Estados de tienda",
        "relationshipActiveCollaborations": "Colaboraciones activas",
        "relationshipTagCount": "{{count}} etiqueta(s)",
        "relationshipWorkCollaborationCount": "{{count}} colaboración(es)",
        "relationshipWorkShortLabel": "Registro {{id}}",
        "relationshipWorkActiveCollaborations": "Colaboraciones activas",
        "relationshipWorkPendingProposals": "Propuestas pendientes",
        "focusedProposal": "Propuesta seleccionada",
        "relationshipWorkbenchSubtitle": "Panel de trabajo para perfil del creador, comunicación, colaboraciones e historial de acciones.",
        "relationshipProfileSummary": "Resumen del creador",
        "relationshipCurrentDecision": "Trabajo actual",
        "relationshipPanelCurrentWork": "Trabajo actual",
        "relationshipPanelCommunication": "Historial de comunicación",
        "relationshipPanelCollaborations": "Registros de colaboración",
        "relationshipPanelActivity": "Historial de acciones",
        "activity": {
          "loadOlder": "Cargar acciones anteriores"
        },
        "relationshipNoCurrentWork": "Sin trabajo activo",
        "relationshipNoCurrentWorkHint": "Esta relación con el creador no tiene propuestas pendientes ni tareas manuales ahora mismo.",
        "relationshipNeedsManualReview": "Esta relación con el creador necesita revisión del equipo antes de decidir el siguiente paso.",
        "relationshipAcrossShops": "Entre tiendas",
        "relationshipCommunicationHint": "Combinado desde registros disponibles de tienda, chat de plataforma, WhatsApp y email.",
        "noRecentContact": "Sin contacto reciente",
        "relationshipMoreShopStates": "+{{count}} estados de tienda más",
        "relationshipWorkUnread": "No leído",
        "relationshipWorkMoreCollaborations": "+{{count}} colaboraciones más",
        "relationshipWorkPlatformChat": "Conversación",
        "relationshipWorkLastInbound": "Último mensaje del creador",
        "relationshipWorkLastOutbound": "Última respuesta del vendedor",
        "relationshipWorkContext": "Contexto del registro",
        "relationshipWorkAmbiguousCollaborations": "Contextos de colaboración posibles",
        "relationshipWorkNoCollaborations": "Este registro de colaboración aún no está vinculado a una colaboración de producto.",
        "relationshipWorkNoPendingProposals": "No hay propuestas pendientes en este registro de colaboración.",
        "relationshipWorkActiveTitle": "{{count}} colaboración(es) activa(s)",
        "relationshipConversationTitle": "Conversación de relación",
        "relationshipWorkAmbiguousSummary": "Este registro de colaboración tiene varios contextos de producto posibles. Revísalos antes de ejecutar acciones específicas de producto.",
        "relationshipWorkDefaultSummary": "Registro de colaboración entre tienda y creador. Las colaboraciones de producto aparecen aquí cuando se conoce el contexto de producto o muestra.",
        "openCreatorRelationshipWorkDetailHint": "Abre el registro de colaboración para ver conversación, propuestas y colaboraciones relacionadas.",
        "copyRelationshipWorkSystemId": "Copiar ID del sistema",
        "messageChannels": {
          "PLATFORM_CHAT": "TikTok Shop",
          "WHATSAPP": "WhatsApp",
          "EMAIL": "Email"
        },
        "collaborationRecordObject": "Colaboración",
        "attentionFilters": {
          "ALL": "Todo",
          "APPROVAL_REQUIRED": "Aprobaciones",
          "MANUAL_FOLLOW_UP": "Seguimiento manual",
          "STAFF_ACTION_REQUIRED": "Acción del personal"
        },
        "collaborationWorkBadges": {
          "agent": "Agente",
          "approval": "Aprobación",
          "blocked": "Obstruido",
          "done": "Hecho",
          "staff": "Personal",
          "waitingCreator": "Creador",
          "waitingExternal": "Externo",
          "waitingPlatform": "Plataforma"
        },
        "collaborationFilters": {
          "AGENT_REQUIRED": "Agente requerido",
          "STAFF_REQUIRED": "Personal requerido",
          "WAITING_EXTERNAL": "Esperando respuesta externa",
          "IDLE": "Inactivo"
        },
        "collaborationWorkDescriptions": {
          "BLOCKED": "Esta colaboración está bloqueada y no avanzará automáticamente.",
          "DEFAULT": "Abra la vista detallada para inspeccionar el historial, las propuestas y los eventos de la plataforma.",
          "DONE": "No hay ningún trabajo abierto sobre esta colaboración. Abra la vista detallada para inspeccionar el historial.",
          "FOLLOW_UP_CREATOR": "El siguiente paso del lado del creador está retrasado. Haga un seguimiento con el creador según el contexto de colaboración actual.",
          "PROPOSAL_REJECTED": "El personal rechazó la recomendación del agente. El sistema no ejecutará esa propuesta; manéjelo manualmente o espere el próximo evento del creador/plataforma.",
          "RESOLVE_CREATOR_IDENTITY": "El sistema todavía no puede identificar de forma fiable a este creador. Confirma la identidad manualmente o espera más datos de la plataforma.",
          "RESPOND_TO_CREATOR": "El agente redactará una respuesta utilizando la conversación reciente, el contexto del producto y el historial de colaboración. Si se requiere aprobación, primero creará una propuesta.",
          "REVIEW_ACTION_PROPOSAL": "El agente ha creado una propuesta de plataforma-acción. Aprobarlo o rechazarlo en la página de propuestas de acción.",
          "REVIEW_AGENT_FAILURE": "El agente no completó este elemento de trabajo. Revisa el registro y decide el siguiente paso manualmente.",
          "REVIEW_COLLABORATION": "Esta colaboración necesita el criterio del personal. Abra la vista detallada, revise el historial y luego decida si desea manejarlo en la plataforma.",
          "REVIEW_SAMPLE_APPLICATION": "El creador envió una solicitud de muestra. El agente utilizará las reglas de la tienda y los resultados de predicción para recomendar la aprobación o el rechazo.",
          "SHIP_SAMPLE": "La solicitud de muestra ha sido aprobada. El personal debe organizar el envío en la plataforma o flujo del almacén.",
          "WAITING_CREATOR": "No es necesaria ninguna acción del personal en este momento. Esperando a que el creador responda, reciba la muestra o publique contenido.",
          "WAITING_PLATFORM": "No es necesaria ninguna acción del personal en este momento. Esperando a que TikTok Shop sincronice muestras, contenido o actualizaciones de colaboración."
        },
        "collaborationWorkQueueTitle": "Colaboraciones que necesitan manejo de personal.",
        "collaborationWorkTitles": {
          "BLOCKED": "Este creador está bloqueado.",
          "DONE": "Esta colaboración se gestiona",
          "PROPOSAL_REJECTED": "Propuesta rechazada; Se necesita seguimiento del personal.",
          "PROPOSAL_REVISION_REQUESTED": "Revisión de propuesta solicitada",
          "RESPOND_TO_CREATOR": "Responder al creador",
          "REVIEW_ACTION_PROPOSAL": "Revisar la propuesta del agente",
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Hacer seguimiento del contenido de muestra",
          "WAITING_CREATOR": "Esperando al creador",
          "WAITING_PLATFORM": "Esperando actualizaciones de la plataforma"
        },
        "empty": {
          "HISTORY": "Aún no hay historial laboral de afiliado.",
          "IN_PROGRESS": "Actualmente no hay colaboraciones con afiliados en curso.",
          "NEEDS_ATTENTION": "Ningún trabajo de afiliado necesita atención en este momento."
        },
        "labels": {
          "nextStep": "Siguiente paso"
        },
        "historyFilters": {
          "AGENT_REQUIRED": "Agente requerido",
          "STAFF_REQUIRED": "Personal requerido",
          "WAITING_EXTERNAL": "Esperando respuesta externa",
          "IDLE": "Inactivo"
        },
        "lifecycleEventPreview": "Evento de plataforma/sistema: {{eventType}}",
        "lifecycleEvents": {
          "PROPOSAL_REVISION_REQUESTED": "Revisión de propuesta solicitada"
        },
        "manualFollowUpNote": "La propuesta del agente fue rechazada. El personal debe manejar este elemento manualmente en la plataforma o en comunicaciones de seguimiento.",
        "processReasons": {
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Seguimiento del contenido de muestra pendiente"
        },
        "requiredActions": {
          "NONE": "No requiere acción",
          "NO_ACTION": "No requiere acción",
          "RESPOND_TO_CREATOR": "Responder al creador",
          "REPLY_TO_CREATOR": "Responder al creador",
          "REVIEW_SAMPLE_APPLICATION": "Revisar solicitud de muestra",
          "SHIP_SAMPLE": "Enviar muestra",
          "FOLLOW_UP_CREATOR": "Hacer seguimiento al creador",
          "COMPLETE_COLLABORATION_TASK": "Completar tarea de colaboración",
          "REVIEW_COLLABORATION": "Revisar colaboración",
          "RESOLVE_CREATOR_IDENTITY": "Resolver identidad del creador",
          "REVIEW_AGENT_FAILURE": "Revisar fallo del agente",
          "REVIEW_ACTION_PROPOSAL": "Revisar propuesta de acción",
          "REVIEW_AMBIGUOUS_CONTEXT": "Revisar contexto ambiguo",
          "WAIT_CREATOR_RESPONSE": "Esperar respuesta del creador",
          "WAIT_PLATFORM_UPDATE": "Esperar actualización de la plataforma"
        },
        "statusLabels": {
          "AGENT_REQUIRED": "Agente requerido",
          "STAFF_REQUIRED": "Personal requerido",
          "EXTERNAL_WAITING": "Esperando respuesta externa",
          "WAITING_EXTERNAL": "Esperando respuesta externa",
          "IDLE": "Inactivo"
        },
        "workKinds": {
          "RELATIONSHIP": "Relación con creador",
          "APPROVAL_REVIEW": "Revisión de aprobación",
          "CONTENT_FOLLOW_UP": "Seguimiento de contenido",
          "CREATOR_FOLLOW_UP": "Seguimiento del creador",
          "IDENTITY_RESOLUTION": "Resolución de identidad",
          "INBOUND_MESSAGE_TRIAGE": "Triaje de mensaje entrante",
          "MANUAL_REVIEW": "Revisión manual",
          "OBSERVATION_REVIEW": "Revisión de observación",
          "SAMPLE_APPLICATION_DECISION": "Decisión de solicitud de muestra",
          "SAMPLE_SHIPMENT": "Envío de muestra"
        },
        "sampleStatusPreview": "Estado de la muestra: {{status}}; Elementos de contenido {{contentCount}} observados.",
        "sectionHints": {
          "HISTORY": "Acciones ejecutadas, propuestas rechazadas, eventos de plataforma y acciones directas de agentes.",
          "IN_PROGRESS": "Las colaboraciones de creadores ya están avanzando sin que el personal tome medidas inmediatas.",
          "NEEDS_ATTENTION": "Trabajo de afiliado que necesita aprobación, seguimiento manual o manejo de agentes."
        },
        "sections": {
          "HISTORY": "Historia",
          "IN_PROGRESS": "En curso",
          "NEEDS_ATTENTION": "necesita atencion"
        },
        "summary": {
          "historyHint": "Registro de trabajo reciente",
          "inProgressHint": "Esperando al creador o plataforma",
          "needsAttentionHint": "Aprobaciones y seguimiento del personal"
        }
      },
      "customerServiceWorkspace": {
        "filterAiState": "Manejo de IA",
        "filterConversationStatus": "Estado de la conversación",
        "filterEscalationState": "Escalada",
        "filterPageSize": "Tamaño de página",
        "filterSearch": "Buscar",
        "filterShop": "Comercio",
        "filterStatus": "Estado"
      },
      "shopAdsStatus": {
        "connected": "Conectado",
        "hint_connected": "Esta tienda está vinculada a un enlace de tienda de TikTok Ads.",
        "hint_needs_advertiser": "Conecte una cuenta de TikTok Ads antes de que esta tienda pueda usarse para informes de anuncios.",
        "hint_needs_link": "Hay una cuenta de TikTok Ads conectada, pero esta tienda aún necesita verificación de visibilidad de la tienda de Ads.",
        "needs_advertiser": "Sin cuenta de anuncios",
        "needs_link": "Necesita revisión"
      },
      "table": {
        "headers": {
          "adsStatus": "Anuncios"
        },
        "manageAds": "Administrar anuncios"
      }
    },
    "nav": {
      "account": "Cuenta",
      "group": {
        "accountSystem": "Cuenta y sistema",
        "automation": "Automatización",
        "connections": "Conexiones y modelos",
        "shopOperations": "Operaciones de tienda"
      }
    },
    "tools": {
      "selector": {
        "name": {
          "CS_DISMISS_CONVERSATION_ESCALATIONS": "Descartar escaladas de conversación",
          "ECOM_GET_OPERATION_REPORT": "Obtener informe de operación",
          "ECOM_GET_SHOP_ORDER_SKU_EXPORT": "SKU de pedidos de exportación",
          "ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED": "Establecer conversación AI"
        }
      }
    },
    "tutorial": {
      "adsManagement": {
        "actionsBody": "Utilice Connect TikTok Business para autorizar el acceso de los anunciantes. Actualizar actualiza los anunciantes, las tiendas visibles y la cobertura de la tienda.",
        "actionsTitle": "Conectar y actualizar",
        "advertisersBody": "Cada fila es un anunciante disponible a través de la autorización de TikTok Business, incluida la función, el estado del token y el recuento de tiendas visibles.",
        "advertisersTitle": "Cuentas publicitarias",
        "shopCoverageBody": "Sólo los comercios ya autorizados en EasyClaw pasan a ser procesables. Las tiendas visibles para los anunciantes que no están incorporadas siguen siendo informativas.",
        "shopCoverageTitle": "Cobertura de tienda administrada",
        "summaryBody": "Estos contadores separan a los anunciantes autorizados de las tiendas que realmente se pueden gestionar en EasyClaw.",
        "summaryTitle": "Resumen de cobertura",
        "welcomeBody": "Esta página conecta el acceso a TikTok Business y muestra qué tiendas autorizadas por EasyClaw están cubiertas por tiendas visibles para los anunciantes.",
        "welcomeTitle": "Anuncios de TikTok"
      },
      "billing": {
        "accountActionsBody": "Utilice estos botones para iniciar el pago, administrar el método de pago o abrir el portal de facturación cuando esas acciones estén disponibles para su plan.",
        "accountActionsTitle": "Acciones de facturación de cuenta",
        "accountPlanBody": "Esta tarjeta muestra su derecho a IA a nivel de cuenta, el estado del plan, la validez y los límites de uso para ejecuciones generales de agentes.",
        "accountPlanTitle": "Plan de IA de cuenta",
        "overviewBody": "El encabezado explica qué datos de facturación se muestran aquí. Utilice esta página para revisar el acceso actual y administrar los servicios pagos.",
        "overviewTitle": "Resumen de facturación",
        "paymentsBody": "Los pagos y facturas completados aparecen aquí para que pueda auditar la actividad de facturación reciente sin salir de la aplicación de escritorio.",
        "paymentsTitle": "Registros de pago",
        "shopListBody": "Cada fila resume los servicios pagos habilitados, el estado, la información de renovación y las acciones de nivel de servicio de una tienda.",
        "shopListTitle": "Lista de suscripción de tienda",
        "shopServicesBody": "La facturación del servicio de tienda es independiente de la facturación de IA de la cuenta. Cada tienda conectada puede tener acceso a servicios específicos, como el servicio de atención al cliente mediante IA.",
        "shopServicesTitle": "Servicios de tienda",
        "subscribeFlowBody": "Este flujo le permite elegir una tienda y un plan de servicio antes de realizar el pago. Solo aparece cuando hay tiendas elegibles para acceso a servicios adicionales.",
        "subscribeFlowTitle": "Suscríbete a una tienda",
        "usageBody": "Las tarjetas de uso y los metadatos muestran la cuota restante, el momento de renovación y el estado de la suscripción. Estos detalles son instantáneas de solo lectura del backend de facturación.",
        "usageTitle": "Detalles de uso y plan",
        "welcomeBody": "Esta página reúne la suscripción a la cuenta AI, las suscripciones al servicio de la tienda y los registros de pago.",
        "welcomeTitle": "Bienvenido a Facturación"
      },
      "ecommerce": {
        "drawerBody": "El cajón es donde reside la configuración por tienda: descripción general, servicio al cliente de IA, inventario, gestión de afiliados, facturación y vinculación de dispositivos.",
        "drawerTitle": "Cajón de la tienda",
        "shopActionsBody": "Actualizar extrae el último estado de la tienda. Agregar tienda inicia el flujo OAuth de la plataforma para conectar otra cuenta de vendedor.",
        "shopActionsTitle": "Acciones de tienda",
        "shopAliasBody": "Los alias le permiten cambiar el nombre de una tienda localmente para facilitar su reconocimiento. Presione Enter o desenfoque el campo para guardar.",
        "shopAliasTitle": "Alias ​​de tienda",
        "shopRowActionsBody": "Abra el cajón para configurar servicios, reautorizar tokens caducados o desconectar una tienda.",
        "shopRowActionsTitle": "Acciones de fila",
        "shopTableBody": "La tabla muestra la identidad de la tienda, el alias, la plataforma, la región, el estado de autorización, el saldo y las acciones de fila.",
        "shopTableTitle": "Mesa de tienda",
        "shopsBody": "La sección de tienda enumera todas las cuentas de vendedor conectadas y le brinda los principales puntos de entrada operativos para cada tienda.",
        "shopsTitle": "Tiendas conectadas",
        "welcomeBody": "Esta página administra tiendas conectadas, servicio al cliente de IA, automatización de afiliados e integraciones de almacén para el módulo de comercio electrónico.",
        "welcomeTitle": "Bienvenido al comercio electrónico global",
        "wmsActionsBody": "Actualice el estado del inventario, revise los proveedores de WMS admitidos o agregue una cuenta de almacén.",
        "wmsActionsTitle": "Acciones de almacén",
        "wmsBody": "Las cuentas de almacén conectan los datos de su tienda con los sistemas de inventario y cumplimiento.",
        "wmsTableBody": "La tabla de almacén muestra almacenes sincronizados, puntos finales, monedas, tiempo de sincronización y acciones de gestión de inventario.",
        "wmsTableTitle": "Mesa de almacén",
        "wmsTitle": "Cuentas de almacén"
      },
      "ecommerceAffiliate": {
        "actionsBody": "Aprobar aplica la propuesta. Rechazar lo descarta con una nota de decisión para que la automatización no realice esa acción.",
        "actionsTitle": "Aprobar o rechazar",
        "panelBody": "El panel contiene propuestas de colaboración o creadores pendientes agrupadas por tienda y contexto de creador.",
        "panelTitle": "Panel de propuestas",
        "proposalCardBody": "Cada tarjeta explica el tipo de acción, el razonamiento, los ID de los objetivos y el contexto de la política para la operación de afiliación propuesta.",
        "proposalCardTitle": "Tarjeta de propuesta",
        "queueBody": "Los grupos de propuestas aparecen aquí. Los estados vacíos son normales cuando ninguna acción de la IA espera la aprobación humana.",
        "queueTitle": "Cola de propuestas",
        "shopFilterBody": "Utilice el filtro de tienda para centrarse en una cuenta de vendedor o revisar propuestas en todas las tiendas.",
        "shopFilterTitle": "Filtro de tienda",
        "toolbarBody": "La barra de herramientas muestra el recuento pendiente, el filtro de compra y la acción de actualización para obtener las últimas propuestas.",
        "toolbarTitle": "Barra de herramientas",
        "welcomeBody": "Este espacio de trabajo revisa las propuestas de acción de afiliados generadas por IA antes de aplicarlas.",
        "welcomeTitle": "Bienvenido a Gestión de Afiliados"
      },
      "ecommerceCustomerService": {
        "conversationDetailBody": "El panel de detalles muestra mensajes, herramientas de resumen, habilitación de IA, controles de respuesta manual y metadatos de la conversación seleccionada.",
        "conversationDetailTitle": "Detalle de la conversación",
        "conversationListBody": "Cada fila resume una conversación con el comprador con tienda, marca de tiempo, estado, insignia de escalamiento y texto de vista previa.",
        "conversationListTitle": "Lista de conversaciones",
        "conversationShellBody": "La vista dividida mantiene la cola a la izquierda y los detalles de la conversación seleccionada a la derecha.",
        "conversationShellTitle": "Espacio de trabajo de conversación",
        "escalationQueueBody": "La pestaña de escalada enumera los casos abiertos o pendientes que necesitan revisión, respuesta o desestimación.",
        "escalationQueueTitle": "Cola de escalada",
        "filtersBody": "Filtre por tienda, estado de la conversación, estado de la IA, estado de escalamiento y tamaño de la página para enfocar la cola.",
        "filtersTitle": "Filtros",
        "manualReplyBody": "Utilice la respuesta manual cuando un humano necesite responder directamente. Esto funciona junto con los controles de IA para la conversación.",
        "manualReplyTitle": "Respuesta manual",
        "searchBody": "La búsqueda reduce la cola por identificadores de comprador, pedido o conversación. Aplique la búsqueda para actualizar la vista del espacio de trabajo actual.",
        "searchTitle": "Buscar",
        "tabsBody": "Cambie entre la bandeja de entrada de conversaciones en vivo y la cola de escalada. Los recuentos le ayudan a ver la carga de trabajo actual de un vistazo.",
        "tabsTitle": "Pestañas del espacio de trabajo",
        "welcomeBody": "Este espacio de trabajo sirve para monitorear las conversaciones de los compradores y manejar las escaladas de IA en las tiendas conectadas.",
        "welcomeTitle": "Bienvenido al servicio de atención al cliente"
      },
      "settings": {
        "showAgentNameBody": "Controla si la etiqueta de marca de la barra lateral puede mostrar el nombre del agente actual en lugar del nombre de la aplicación. Actívelo cuando ejecute varios agentes con nombre y desee una verificación visual rápida de cuál está activo.",
        "showAgentNameTitle": "Nombre del agente de la barra lateral"
      }
    }
  },
  "fr": {
    "adsManagement": {
      "adsReadyShops": "Boutiques prêtes pour la publicité",
      "advertiserTableSubtitle": "Connectez TikTok Business ou Ads Manager, puis Airflow synchronise les données de campagne, de groupe d'annonces, d'annonces et de rapport GMV Max de ces annonceurs.",
      "advertiserTableTitle": "Comptes publicitaires",
      "authSeparationHint": "L’accès à TikTok Ads est accordé via Business/Ads Manager. EasyClaw gère uniquement les magasins également autorisés en tant que boutiques TikTok.",
      "authStatus": {
        "AUTHORIZED": "Autorisé",
        "DISCONNECTED": "Déconnecté",
        "REVOKED": "Révoqué",
        "TOKEN_EXPIRED": "Jeton expiré"
      },
      "authorizedAdvertisers": "Autorisé",
      "needsAttention": "À traiter",
      "businessAccountHint": "L’autorisation TikTok Ads accorde l’accès aux annonceurs. La couverture du magasin n'est exploitable que lorsqu'un magasin visible par l'annonceur correspond à un magasin autorisé par EasyClaw.",
      "columns": {
        "actions": "Actes",
        "advertiserId": "Numéro d'annonceur",
        "currency": "Devise",
        "name": "Annonceur",
        "role": "Rôle",
        "status": "Statut d'authentification",
        "syncHealth": "Synchro BI",
        "tokenExpiry": "Le jeton expire",
        "updatedAt": "Mis à jour",
        "visibleStores": "Magasins visibles"
      },
      "confirmDisconnect": "Déconnecter ce compte publicitaire ? La synchronisation BI s'arrêtera jusqu'à ce qu'elle soit à nouveau autorisée.",
      "connect": "Connectez les publicités TikTok",
      "connectAdvertiser": "Connecter le compte publicitaire",
      "connectBusiness": "Connectez votre entreprise TikTok",
      "copyFailed": "Échec de la copie du lien d'autorisation.",
      "disconnect": "Déconnecter",
      "disconnectFailed": "Échec de la déconnexion du compte publicitaire.",
      "disconnectSuccess": "Compte publicitaire déconnecté.",
      "emptyAdvertisersBody": "Connectez TikTok Business ou Ads Manager pour découvrir les annonceurs et leurs magasins visibles.",
      "emptyAdvertisersTitle": "Aucun compte publicitaire connecté",
      "loadFailed": "Échec du chargement des données de gestion des annonces.",
      "noShops": "Aucun magasin connecté pour l'instant.",
      "oauthFailed": "Échec du démarrage de l'autorisation TikTok Ads.",
      "oauthHint": "Ouvrez ce lien dans un navigateur connecté au compte TikTok Business Center ou Ads Manager propriétaire des annonceurs.",
      "oauthModalTitle": "Connectez les publicités TikTok",
      "oauthSuccess": "La connexion TikTok Business s’est terminée avec succès.",
      "oauthTimeout": "L'autorisation a expiré. Actualisez la page si l'autorisation est complétée dans le navigateur.",
      "openAuthLink": "Ouvrez le lien d'autorisation TikTok Ads",
      "syncHealth": {
        "FAILED": "Problème",
        "HEALTHY": "Sain"
      },
      "syncIssue": {
        "BACKEND_ERROR": "Problème de synchronisation backend",
        "PERMISSION_DENIED": "Autorisation annonceur perdue",
        "PLATFORM_ERROR": "Problème d'API TikTok Ads",
        "UNKNOWN": "Problème de synchronisation"
      },
      "shopAdsStatus": {
        "connected": "Couvert",
        "needs_advertiser": "Pas de compte publicitaire",
        "needs_link": "Non couvert"
      },
      "shopColumns": {
        "action": "Action",
        "adsStatus": "Statut des annonces",
        "advertiser": "Comptes publicitaires actifs",
        "coverage": "Couverture",
        "gmvMax": "Autorisation GMV Max actuelle",
        "region": "Région",
        "shop": "Boutique",
        "storeId": "Identifiant du magasin"
      },
      "currentGmvMaxAccount": "GMV Max actuel",
      "gmvMaxAvailable": "GMV Max disponible",
      "currentGmvMaxUnknown": "Le compte actuellement autorisé est en attente de synchronisation",
      "shopCoverageSubtitle": "Affiche tous les comptes publicitaires actuellement actifs pour chaque boutique et identifie séparément l'autorisation GMV Max actuelle. Il ne s'agit pas d'une vue datée du compte de diffusion.",
      "shopCoverageTitle": "Couverture gérée de la boutique",
      "shopReadinessSubtitle": "Examinez la couverture du compte Ads de chaque boutique connectée, la visibilité du magasin et la préparation au GMV Max.",
      "shopReadinessTitle": "Préparation aux annonces d'achat",
      "subtitle": "Connectez l'accès TikTok Business et vérifiez quels magasins autorisés sont couverts par ces comptes publicitaires.",
      "title": "Gestion des publicités TikTok",
      "totalAdvertisers": "Comptes publicitaires",
      "unonboardedStoreCount": "Les magasins {{count}} visibles par les annonceurs ne sont pas intégrés dans EasyClaw",
      "waitingAuth": "En attente de l'autorisation de TikTok Ads..."
    },
    "common": {
      "no": "Non",
      "website": "Site web",
      "yes": "Oui"
    },
    "ecommerce": {
      "affiliateWorkspace": {
        "approvalQueueTitle": "Propositions d'actions",
        "creatorRelationshipWorkPrimaryObject": "Dossier de collaboration",
        "creatorRelationshipPrimaryObject": "Relation créateur",
        "creatorRelationshipWorkItems": "Dossiers de collaboration",
        "creatorIdentityObject": "Identité créateur",
        "creatorIdentityId": "ID système de l'identité",
        "creatorBlocked": "Bloqué",
        "relationshipShopStates": "États boutique",
        "relationshipActiveCollaborations": "Collaborations actives",
        "relationshipTagCount": "{{count}} tag(s)",
        "relationshipWorkCollaborationCount": "{{count}} collaboration(s)",
        "relationshipWorkShortLabel": "Dossier {{id}}",
        "relationshipWorkActiveCollaborations": "Collaborations actives",
        "relationshipWorkPendingProposals": "Propositions en attente",
        "focusedProposal": "Proposition ciblée",
        "relationshipWorkbenchSubtitle": "Espace de travail pour le profil créateur, les échanges, les collaborations et l'historique des actions.",
        "relationshipProfileSummary": "Résumé du créateur",
        "relationshipCurrentDecision": "Travail en cours",
        "relationshipPanelCurrentWork": "Travail en cours",
        "relationshipPanelCommunication": "Historique des échanges",
        "relationshipPanelCollaborations": "Dossiers de collaboration",
        "relationshipPanelActivity": "Historique des actions",
        "activity": {
          "loadOlder": "Charger les actions plus anciennes"
        },
        "relationshipNoCurrentWork": "Aucun travail actif",
        "relationshipNoCurrentWorkHint": "Cette relation créateur n'a actuellement aucune proposition en attente ni tâche manuelle.",
        "relationshipNeedsManualReview": "Cette relation créateur doit être examinée par l'équipe avant de décider de la prochaine étape.",
        "relationshipAcrossShops": "Multi-boutiques",
        "relationshipCommunicationHint": "Fusionné depuis les données disponibles de boutique, chat plateforme, WhatsApp et e-mail.",
        "noRecentContact": "Aucun contact récent",
        "relationshipMoreShopStates": "+{{count}} autres états de boutique",
        "relationshipWorkUnread": "Non lu",
        "relationshipWorkMoreCollaborations": "+{{count}} collaborations supplémentaires",
        "relationshipWorkPlatformChat": "Conversation",
        "relationshipWorkLastInbound": "Dernier message créateur",
        "relationshipWorkLastOutbound": "Dernière réponse vendeur",
        "relationshipWorkContext": "Contexte du dossier",
        "relationshipWorkAmbiguousCollaborations": "Contextes de collaboration possibles",
        "relationshipWorkNoCollaborations": "Ce dossier de collaboration n'est pas encore lié à une collaboration produit.",
        "relationshipWorkNoPendingProposals": "Aucune proposition en attente dans ce dossier de collaboration.",
        "relationshipWorkActiveTitle": "{{count}} collaboration(s) active(s)",
        "relationshipConversationTitle": "Conversation de relation",
        "relationshipWorkAmbiguousSummary": "Ce dossier de collaboration a plusieurs contextes produit possibles. Vérifiez-les avant toute action liée à un produit.",
        "relationshipWorkDefaultSummary": "Dossier de collaboration entre boutique et créateur. Les collaborations produit apparaissent ici quand le contexte produit ou échantillon est connu.",
        "openCreatorRelationshipWorkDetailHint": "Ouvrir le dossier de collaboration pour voir conversation, propositions et collaborations liées.",
        "copyRelationshipWorkSystemId": "Copier l'ID système",
        "messageChannels": {
          "PLATFORM_CHAT": "TikTok Shop",
          "WHATSAPP": "WhatsApp",
          "EMAIL": "Email"
        },
        "collaborationRecordObject": "Collaboration",
        "attentionFilters": {
          "ALL": "Tous",
          "APPROVAL_REQUIRED": "Approbations",
          "MANUAL_FOLLOW_UP": "Suivi manuel",
          "STAFF_ACTION_REQUIRED": "Action du personnel"
        },
        "collaborationWorkBadges": {
          "agent": "Agent",
          "approval": "Approbation",
          "blocked": "Bloqué",
          "done": "Fait",
          "staff": "Personnel",
          "waitingCreator": "Créateur",
          "waitingExternal": "Externe",
          "waitingPlatform": "Plate-forme"
        },
        "collaborationFilters": {
          "AGENT_REQUIRED": "Agent requis",
          "STAFF_REQUIRED": "Personnel requis",
          "WAITING_EXTERNAL": "En attente externe",
          "IDLE": "Inactif"
        },
        "collaborationWorkDescriptions": {
          "BLOCKED": "Cette collaboration est bloquée et ne progressera pas automatiquement.",
          "DEFAULT": "Ouvrez la vue détaillée pour inspecter l'historique, les propositions et les événements de la plateforme.",
          "DONE": "Il n’y a pas de travail ouvert sur cette collaboration. Ouvrez la vue détaillée pour inspecter l'historique.",
          "FOLLOW_UP_CREATOR": "La prochaine étape du côté des créateurs est attendue depuis longtemps. Effectuer un suivi auprès du créateur en fonction du contexte de collaboration actuel.",
          "PROPOSAL_REJECTED": "Le personnel a rejeté la recommandation de l'agent. Le système n'exécutera pas cette proposition ; gérez-le manuellement ou attendez le prochain événement créateur/plateforme.",
          "RESOLVE_CREATOR_IDENTITY": "Le système ne peut pas encore identifier de manière fiable ce créateur. Confirmez l'identité manuellement ou attendez plus de données sur la plateforme.",
          "RESPOND_TO_CREATOR": "L'agent rédigera une réponse en utilisant la conversation récente, le contexte du produit et l'historique de collaboration. Si une approbation est requise, une proposition sera d'abord créée.",
          "REVIEW_ACTION_PROPOSAL": "L'agent a créé une proposition de plateforme-action. Approuvez-le ou rejetez-le sur la page Propositions d'action.",
          "REVIEW_AGENT_FAILURE": "L'agent n'a pas terminé cet élément de travail. Examinez l’enregistrement et décidez manuellement de l’étape suivante.",
          "REVIEW_COLLABORATION": "Cette collaboration nécessite le jugement du personnel. Ouvrez la vue détaillée, consultez l'historique, puis décidez si vous souhaitez le gérer sur la plateforme.",
          "REVIEW_SAMPLE_APPLICATION": "Le créateur a soumis un exemple de demande. L'agent utilisera les règles de l'atelier et les résultats des prédictions pour recommander l'approbation ou le rejet.",
          "SHIP_SAMPLE": "La demande d'échantillon a été approuvée. Le personnel doit organiser l’expédition dans le flux de la plate-forme ou de l’entrepôt.",
          "WAITING_CREATOR": "Aucune action du personnel n’est nécessaire pour le moment. En attente que le créateur réponde, reçoive l'échantillon ou publie le contenu.",
          "WAITING_PLATFORM": "Aucune action du personnel n’est nécessaire pour le moment. En attente que TikTok Shop synchronise les mises à jour d’échantillons, de contenu ou de collaboration."
        },
        "collaborationWorkQueueTitle": "Collaborations nécessitant une prise en charge par le personnel",
        "collaborationWorkTitles": {
          "BLOCKED": "Ce créateur est bloqué",
          "DONE": "Cette collaboration est gérée",
          "PROPOSAL_REJECTED": "Proposition rejetée ; suivi du personnel nécessaire",
          "PROPOSAL_REVISION_REQUESTED": "Révision de proposition demandée",
          "RESPOND_TO_CREATOR": "Répondre au créateur",
          "REVIEW_ACTION_PROPOSAL": "Examiner la proposition de l'agent",
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Relancer le contenu d'échantillon",
          "WAITING_CREATOR": "En attendant le créateur",
          "WAITING_PLATFORM": "En attente des mises à jour de la plateforme"
        },
        "empty": {
          "HISTORY": "Aucun historique de travail d'affilié pour l'instant.",
          "IN_PROGRESS": "Aucune collaboration d'affiliation n'est actuellement en cours.",
          "NEEDS_ATTENTION": "Aucun travail d’affiliation ne nécessite d’attention pour le moment."
        },
        "labels": {
          "nextStep": "Étape suivante"
        },
        "historyFilters": {
          "AGENT_REQUIRED": "Agent requis",
          "STAFF_REQUIRED": "Personnel requis",
          "WAITING_EXTERNAL": "En attente externe",
          "IDLE": "Inactif"
        },
        "lifecycleEventPreview": "Événement plateforme/système : {{eventType}}",
        "lifecycleEvents": {
          "PROPOSAL_REVISION_REQUESTED": "Révision de proposition demandée"
        },
        "manualFollowUpNote": "La proposition de l'agent a été rejetée. Le personnel doit gérer cet élément manuellement sur la plateforme ou lors d'une communication de suivi.",
        "processReasons": {
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Suivi du contenu d'échantillon attendu"
        },
        "requiredActions": {
          "NONE": "Aucune action requise",
          "NO_ACTION": "Aucune action requise",
          "RESPOND_TO_CREATOR": "Répondre au créateur",
          "REPLY_TO_CREATOR": "Répondre au créateur",
          "REVIEW_SAMPLE_APPLICATION": "Examiner la demande d'échantillon",
          "SHIP_SAMPLE": "Expédier l'échantillon",
          "FOLLOW_UP_CREATOR": "Relancer le créateur",
          "COMPLETE_COLLABORATION_TASK": "Terminer la tâche de collaboration",
          "REVIEW_COLLABORATION": "Examiner la collaboration",
          "RESOLVE_CREATOR_IDENTITY": "Résoudre l'identité du créateur",
          "REVIEW_AGENT_FAILURE": "Examiner l'échec de l'agent",
          "REVIEW_ACTION_PROPOSAL": "Examiner la proposition d'action",
          "REVIEW_AMBIGUOUS_CONTEXT": "Examiner le contexte ambigu",
          "WAIT_CREATOR_RESPONSE": "Attendre la réponse du créateur",
          "WAIT_PLATFORM_UPDATE": "Attendre la mise à jour de la plateforme"
        },
        "statusLabels": {
          "AGENT_REQUIRED": "Agent requis",
          "STAFF_REQUIRED": "Personnel requis",
          "EXTERNAL_WAITING": "En attente externe",
          "WAITING_EXTERNAL": "En attente externe",
          "IDLE": "Inactif"
        },
        "workKinds": {
          "RELATIONSHIP": "Relation créateur",
          "APPROVAL_REVIEW": "Examen d'approbation",
          "CONTENT_FOLLOW_UP": "Suivi du contenu",
          "CREATOR_FOLLOW_UP": "Suivi créateur",
          "IDENTITY_RESOLUTION": "Résolution d'identité",
          "INBOUND_MESSAGE_TRIAGE": "Tri des messages entrants",
          "MANUAL_REVIEW": "Examen manuel",
          "OBSERVATION_REVIEW": "Examen d'observation",
          "SAMPLE_APPLICATION_DECISION": "Décision de demande d'échantillon",
          "SAMPLE_SHIPMENT": "Expédition d'échantillon"
        },
        "sampleStatusPreview": "Statut de l'échantillon : {{status}} ; Élément(s) de contenu {{contentCount}} observé(s).",
        "sectionHints": {
          "HISTORY": "Actions exécutées, propositions rejetées, événements de plateforme et actions directes des agents.",
          "IN_PROGRESS": "Les collaborations entre créateurs progressent déjà sans action immédiate du personnel.",
          "NEEDS_ATTENTION": "Travail d'affiliation qui nécessite une approbation, un suivi manuel ou une gestion par un agent."
        },
        "sections": {
          "HISTORY": "Histoire",
          "IN_PROGRESS": "En cours",
          "NEEDS_ATTENTION": "A besoin d'attention"
        },
        "summary": {
          "historyHint": "Journal de travail récent",
          "inProgressHint": "En attente sur le créateur ou la plateforme",
          "needsAttentionHint": "Approbations et suivi du personnel"
        }
      },
      "customerServiceWorkspace": {
        "filterAiState": "Gestion de l'IA",
        "filterConversationStatus": "Statut de la conversation",
        "filterEscalationState": "Escalade",
        "filterPageSize": "Taille des pages",
        "filterSearch": "Recherche",
        "filterShop": "Boutique",
        "filterStatus": "Statut"
      },
      "shopAdsStatus": {
        "connected": "Connecté",
        "hint_connected": "Cette boutique est liée à une liaison de boutique TikTok Ads.",
        "hint_needs_advertiser": "Connectez un compte TikTok Ads avant que cette boutique puisse être utilisée pour les rapports publicitaires.",
        "hint_needs_link": "Un compte TikTok Ads est connecté, mais cette boutique nécessite toujours une vérification de la visibilité du magasin Ads.",
        "needs_advertiser": "Aucun compte publicitaire",
        "needs_link": "Besoin d'un examen"
      },
      "table": {
        "headers": {
          "adsStatus": "Annonces"
        },
        "manageAds": "Gérer les annonces"
      }
    },
    "nav": {
      "account": "Compte",
      "group": {
        "accountSystem": "Compte et système",
        "automation": "Automation",
        "connections": "Connexions et modèles",
        "shopOperations": "Opérations de magasin"
      }
    },
    "tools": {
      "selector": {
        "name": {
          "CS_DISMISS_CONVERSATION_ESCALATIONS": "Ignorer les escalades de conversations",
          "ECOM_GET_OPERATION_REPORT": "Obtenir le rapport d'opération",
          "ECOM_GET_SHOP_ORDER_SKU_EXPORT": "Numéros de commande d’exportation",
          "ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED": "Définir l'IA de conversation"
        }
      }
    },
    "tutorial": {
      "adsManagement": {
        "actionsBody": "Utilisez Connect TikTok Business pour autoriser l’accès des annonceurs. Actualiser met à jour les annonceurs, les magasins visibles et la couverture des magasins.",
        "actionsTitle": "Connectez-vous et actualisez",
        "advertisersBody": "Chaque ligne correspond à un annonceur disponible via l'autorisation TikTok Business, y compris le rôle, le statut du jeton et le nombre de magasins visibles.",
        "advertisersTitle": "Comptes publicitaires",
        "shopCoverageBody": "Seules les boutiques déjà autorisées dans EasyClaw deviennent exploitables. Les magasins visibles par les annonceurs qui ne sont pas intégrés restent informatifs.",
        "shopCoverageTitle": "Couverture gérée de la boutique",
        "summaryBody": "Ces compteurs séparent les annonceurs autorisés des boutiques qui peuvent réellement être gérées dans EasyClaw.",
        "summaryTitle": "Résumé de la couverture",
        "welcomeBody": "Cette page connecte l'accès à TikTok Business et indique quelles boutiques autorisées EasyClaw sont couvertes par les boutiques visibles par les annonceurs.",
        "welcomeTitle": "Publicités TikTok"
      },
      "billing": {
        "accountActionsBody": "Utilisez ces boutons pour lancer le paiement, gérer le mode de paiement ou ouvrir le portail de facturation lorsque ces actions sont disponibles pour votre forfait.",
        "accountActionsTitle": "Actions de facturation du compte",
        "accountPlanBody": "Cette carte indique vos droits à l'IA au niveau de votre compte, l'état du plan, la validité et les limites d'utilisation pour les exécutions d'agents généraux.",
        "accountPlanTitle": "Plan d'IA de compte",
        "overviewBody": "L'en-tête explique quelles données de facturation sont affichées ici. Utilisez cette page pour vérifier l'accès actuel et gérer les services payants.",
        "overviewTitle": "Aperçu de la facturation",
        "paymentsBody": "Les paiements et factures terminés apparaissent ici afin que vous puissiez vérifier l'activité de facturation récente sans quitter l'application de bureau.",
        "paymentsTitle": "Dossiers de paiement",
        "shopListBody": "Chaque ligne résume les services payants activés, le statut, les informations de renouvellement et les actions au niveau du service d'une boutique.",
        "shopListTitle": "Liste d'abonnement à la boutique",
        "shopServicesBody": "La facturation du service de boutique est distincte de la facturation du compte AI. Chaque boutique connectée peut disposer d'un accès spécifique à un service tel que le service client IA.",
        "shopServicesTitle": "Services de boutique",
        "subscribeFlowBody": "Ce flux vous permet de choisir une boutique et un plan de service avant de passer à la caisse. Il n'apparaît que lorsqu'il existe des magasins éligibles à un accès au service supplémentaire.",
        "subscribeFlowTitle": "Abonnez-vous à une boutique",
        "usageBody": "Les fiches d'utilisation et les métadonnées indiquent le quota restant, le délai de renouvellement et l'état de l'abonnement. Ces détails sont des instantanés en lecture seule du backend de facturation.",
        "usageTitle": "Détails d'utilisation et du forfait",
        "welcomeBody": "Cette page rassemble l'abonnement au compte AI, les abonnements aux services de boutique et les enregistrements de paiement.",
        "welcomeTitle": "Bienvenue sur Facturation"
      },
      "ecommerce": {
        "drawerBody": "Le tiroir est l'endroit où se trouve la configuration par boutique : présentation, service client IA, inventaire, gestion des affiliés, facturation et liaison des appareils.",
        "drawerTitle": "Tiroir de magasin",
        "shopActionsBody": "L'actualisation extrait le dernier état de la boutique. Add Shop démarre le flux OAuth de la plateforme pour connecter un autre compte vendeur.",
        "shopActionsTitle": "Actions d'achat",
        "shopAliasBody": "Les alias vous permettent de renommer une boutique localement pour une reconnaissance plus facile. Appuyez sur Entrée ou floutez le champ pour enregistrer.",
        "shopAliasTitle": "Alias ​​de la boutique",
        "shopRowActionsBody": "Ouvrez le tiroir pour configurer les services, réautoriser les jetons expirés ou déconnecter une boutique.",
        "shopRowActionsTitle": "Actions sur les lignes",
        "shopTableBody": "Le tableau affiche l'identité de la boutique, l'alias, la plateforme, la région, l'état d'autorisation, le solde et les actions de ligne.",
        "shopTableTitle": "Tableau de magasin",
        "shopsBody": "La section boutique répertorie tous les comptes vendeurs connectés et vous donne les principaux points d'entrée opérationnels pour chaque boutique.",
        "shopsTitle": "Boutiques connectées",
        "welcomeBody": "Cette page gère les boutiques connectées, le service client IA, l'automatisation des affiliations et les intégrations d'entrepôts pour le module de commerce électronique.",
        "welcomeTitle": "Bienvenue dans le commerce électronique mondial",
        "wmsActionsBody": "Actualisez l'état de l'inventaire, examinez les fournisseurs WMS pris en charge ou ajoutez un compte d'entrepôt.",
        "wmsActionsTitle": "Actions d'entrepôt",
        "wmsBody": "Les comptes d'entrepôt connectent les données de votre boutique aux systèmes d'inventaire et de traitement des commandes.",
        "wmsTableBody": "Le tableau des entrepôts affiche les entrepôts synchronisés, les points de terminaison, les devises, l'heure de synchronisation et les actions de gestion des stocks.",
        "wmsTableTitle": "Table d'entrepôt",
        "wmsTitle": "Comptes d'entrepôt"
      },
      "ecommerceAffiliate": {
        "actionsBody": "Approuver applique la proposition. Rejeter le rejette avec une note de décision afin que l'automatisation n'effectue pas cette action.",
        "actionsTitle": "Approuver ou rejeter",
        "panelBody": "Le panneau contient des propositions de créateurs ou de collaboration en attente regroupées par contexte de boutique et de créateur.",
        "panelTitle": "Panel de propositions",
        "proposalCardBody": "Chaque carte explique le type d'action, le raisonnement, les identifiants cibles et le contexte politique de l'opération d'affiliation proposée.",
        "proposalCardTitle": "Carte de proposition",
        "queueBody": "Les groupes de propositions apparaissent ici. Les états vides sont normaux lorsqu'aucune action de l'IA n'attend l'approbation humaine.",
        "queueTitle": "File d'attente des propositions",
        "shopFilterBody": "Utilisez le filtre de boutique pour vous concentrer sur un compte vendeur ou examiner les propositions dans toutes les boutiques.",
        "shopFilterTitle": "Filtrer la boutique",
        "toolbarBody": "La barre d'outils affiche le nombre en attente, le filtre de magasin et l'action d'actualisation pour extraire les dernières propositions.",
        "toolbarTitle": "Barre d'outils",
        "welcomeBody": "Cet espace de travail examine les propositions d'action d'affiliation générées par l'IA avant qu'elles ne soient appliquées.",
        "welcomeTitle": "Bienvenue dans la gestion des affiliations"
      },
      "ecommerceCustomerService": {
        "conversationDetailBody": "Le volet de détails affiche les messages, les outils de résumé, l'activation de l'IA, les contrôles de réponse manuelle et les métadonnées de la conversation sélectionnée.",
        "conversationDetailTitle": "Détail de la conversation",
        "conversationListBody": "Chaque ligne résume une conversation d'acheteur avec la boutique, l'horodatage, le statut, le badge d'escalade et le texte d'aperçu.",
        "conversationListTitle": "Liste de conversations",
        "conversationShellBody": "La vue fractionnée conserve la file d'attente à gauche et les détails de la conversation sélectionnée à droite.",
        "conversationShellTitle": "Espace de travail de conversation",
        "escalationQueueBody": "L'onglet escalade répertorie les dossiers ouverts ou en attente qui nécessitent un examen, une réponse ou un rejet.",
        "escalationQueueTitle": "File d'attente d'escalade",
        "filtersBody": "Filtrez par boutique, statut de conversation, état d'IA, état d'escalade et taille de page pour cibler la file d'attente.",
        "filtersTitle": "Filtres",
        "manualReplyBody": "Utilisez la réponse manuelle lorsqu'un humain a besoin de répondre directement. Cela fonctionne parallèlement aux commandes AI pour la conversation.",
        "manualReplyTitle": "Réponse manuelle",
        "searchBody": "La recherche réduit la file d'attente par identifiant d'acheteur, de commande ou de conversation. Appliquez la recherche pour actualiser la vue actuelle de l'espace de travail.",
        "searchTitle": "Recherche",
        "tabsBody": "Basculez entre la boîte de réception des conversations en direct et la file d'attente d'escalade. Les décomptes vous aident à voir la charge de travail actuelle en un coup d'œil.",
        "tabsTitle": "Onglets de l'espace de travail",
        "welcomeBody": "Cet espace de travail permet de surveiller les conversations des acheteurs et de gérer les escalades d'IA dans les boutiques connectées.",
        "welcomeTitle": "Bienvenue au service client"
      },
      "settings": {
        "showAgentNameBody": "Contrôle si l'étiquette de marque de la barre latérale peut afficher le nom de l'agent actuel au lieu du nom de l'application. Activez-le lorsque vous exécutez plusieurs agents nommés et souhaitez vérifier rapidement lequel est actif.",
        "showAgentNameTitle": "Nom de l'agent de la barre latérale"
      }
    }
  },
  "id": {
    "adsManagement": {
      "adsReadyShops": "Toko yang siap beriklan",
      "advertiserTableSubtitle": "Hubungkan TikTok Business atau Manajer Iklan, lalu Airflow menyinkronkan kampanye, grup iklan, iklan, dan data pelaporan GMV Max dari pengiklan ini.",
      "advertiserTableTitle": "Akun Periklanan",
      "authSeparationHint": "Akses Iklan TikTok diberikan melalui Manajer Bisnis/Iklan. EasyClaw hanya mengelola toko yang juga resmi sebagai Toko TikTok.",
      "authStatus": {
        "AUTHORIZED": "Resmi",
        "DISCONNECTED": "Terputus",
        "REVOKED": "Dicabut",
        "TOKEN_EXPIRED": "Token Kedaluwarsa"
      },
      "authorizedAdvertisers": "Resmi",
      "needsAttention": "Perlu perhatian",
      "businessAccountHint": "Otorisasi Iklan TikTok memberikan akses kepada pengiklan. Cakupan toko hanya dapat ditindaklanjuti ketika toko yang terlihat oleh pengiklan dipetakan kembali ke toko resmi EasyClaw.",
      "columns": {
        "actions": "Tindakan",
        "advertiserId": "ID Pengiklan",
        "currency": "Mata uang",
        "name": "Pemasang iklan",
        "role": "Peran",
        "status": "Status Otentikasi",
        "syncHealth": "Sinkronisasi BI",
        "tokenExpiry": "Token Kedaluwarsa",
        "updatedAt": "Diperbarui",
        "visibleStores": "Toko yang Terlihat"
      },
      "confirmDisconnect": "Putuskan sambungan akun iklan ini? Sinkronisasi BI akan berhenti hingga diotorisasi ulang.",
      "connect": "Hubungkan Iklan TikTok",
      "connectAdvertiser": "Hubungkan Akun Iklan",
      "connectBusiness": "Hubungkan Bisnis TikTok",
      "copyFailed": "Gagal menyalin tautan otorisasi.",
      "disconnect": "Memutuskan",
      "disconnectFailed": "Gagal memutuskan sambungan akun iklan.",
      "disconnectSuccess": "Akun periklanan terputus.",
      "emptyAdvertisersBody": "Hubungkan TikTok Business atau Manajer Iklan untuk menemukan pengiklan dan toko mereka yang terlihat.",
      "emptyAdvertisersTitle": "Tidak ada akun iklan yang terhubung",
      "loadFailed": "Gagal memuat data pengelolaan Iklan.",
      "noShops": "Belum ada toko yang terhubung.",
      "oauthFailed": "Gagal memulai otorisasi Iklan TikTok.",
      "oauthHint": "Buka tautan ini di browser yang masuk ke akun Pusat Bisnis TikTok atau Manajer Iklan milik pengiklan.",
      "oauthModalTitle": "Hubungkan Iklan TikTok",
      "oauthSuccess": "Koneksi TikTok Business berhasil diselesaikan.",
      "oauthTimeout": "Waktu otorisasi habis. Refresh halaman jika otorisasi selesai di browser.",
      "openAuthLink": "Buka tautan otorisasi Iklan TikTok",
      "syncHealth": {
        "FAILED": "Masalah",
        "HEALTHY": "Sehat"
      },
      "syncIssue": {
        "BACKEND_ERROR": "Masalah sinkronisasi backend",
        "PERMISSION_DENIED": "Izin pengiklan hilang",
        "PLATFORM_ERROR": "Masalah API TikTok Ads",
        "UNKNOWN": "Masalah sinkronisasi"
      },
      "shopAdsStatus": {
        "connected": "Tercakup",
        "needs_advertiser": "Tidak ada akun iklan",
        "needs_link": "Tidak tercakup"
      },
      "shopColumns": {
        "action": "Tindakan",
        "adsStatus": "Status Iklan",
        "advertiser": "Akun iklan aktif",
        "coverage": "Cakupan",
        "gmvMax": "Otorisasi GMV Max saat ini",
        "region": "Wilayah",
        "shop": "Toko",
        "storeId": "ID toko"
      },
      "currentGmvMaxAccount": "GMV Max saat ini",
      "gmvMaxAvailable": "GMV Max tersedia",
      "currentGmvMaxUnknown": "Akun yang diotorisasi saat ini menunggu sinkronisasi",
      "shopCoverageSubtitle": "Menampilkan semua akun iklan yang sedang aktif untuk setiap toko dan menandai otorisasi GMV Max saat ini secara terpisah. Ini bukan tampilan akun penayangan berdasarkan tanggal.",
      "shopCoverageTitle": "Cakupan Toko Terkelola",
      "shopReadinessSubtitle": "Tinjau cakupan akun Iklan setiap toko yang terhubung, visibilitas toko, dan kesiapan GMV Max.",
      "shopReadinessTitle": "Kesiapan Iklan Toko",
      "subtitle": "Hubungkan akses TikTok Business dan verifikasi toko resmi mana yang dicakup oleh akun iklan tersebut.",
      "title": "Manajemen Iklan TikTok",
      "totalAdvertisers": "Akun iklan",
      "unonboardedStoreCount": "Toko {{count}} yang terlihat oleh pengiklan tidak disertakan di EasyClaw",
      "waitingAuth": "Menunggu otorisasi Iklan TikTok..."
    },
    "common": {
      "no": "Tidak",
      "website": "Situs web",
      "yes": "Ya"
    },
    "ecommerce": {
      "affiliateWorkspace": {
        "approvalQueueTitle": "Usulan tindakan",
        "creatorRelationshipWorkPrimaryObject": "Catatan kolaborasi",
        "creatorRelationshipPrimaryObject": "Relasi kreator",
        "creatorRelationshipWorkItems": "Catatan kolaborasi",
        "creatorIdentityObject": "Identitas kreator",
        "creatorIdentityId": "ID sistem identitas",
        "creatorBlocked": "Diblokir",
        "relationshipShopStates": "Status toko",
        "relationshipActiveCollaborations": "Kolaborasi aktif",
        "relationshipTagCount": "{{count}} tag",
        "relationshipWorkCollaborationCount": "{{count}} kolaborasi",
        "relationshipWorkShortLabel": "Catatan {{id}}",
        "relationshipWorkActiveCollaborations": "Kolaborasi aktif",
        "relationshipWorkPendingProposals": "Proposal tertunda",
        "focusedProposal": "Proposal terpilih",
        "relationshipWorkbenchSubtitle": "Panel kerja untuk profil creator, komunikasi, kolaborasi, dan riwayat tindakan.",
        "relationshipProfileSummary": "Ringkasan creator",
        "relationshipCurrentDecision": "Pekerjaan saat ini",
        "relationshipPanelCurrentWork": "Pekerjaan saat ini",
        "relationshipPanelCommunication": "Riwayat komunikasi",
        "relationshipPanelCollaborations": "Catatan kolaborasi",
        "relationshipPanelActivity": "Riwayat tindakan",
        "activity": {
          "loadOlder": "Muat aktivitas lebih lama"
        },
        "relationshipNoCurrentWork": "Tidak ada pekerjaan aktif",
        "relationshipNoCurrentWorkHint": "Relasi creator ini belum memiliki proposal tertunda atau tugas manual saat ini.",
        "relationshipNeedsManualReview": "Relasi creator ini perlu ditinjau staf sebelum langkah berikutnya diputuskan.",
        "relationshipAcrossShops": "Lintas toko",
        "relationshipCommunicationHint": "Digabung dari catatan toko, chat platform, WhatsApp, dan email yang tersedia.",
        "noRecentContact": "Belum ada kontak terbaru",
        "relationshipMoreShopStates": "+{{count}} status toko lainnya",
        "relationshipWorkUnread": "Belum dibaca",
        "relationshipWorkMoreCollaborations": "+{{count}} kolaborasi lainnya",
        "relationshipWorkPlatformChat": "Percakapan",
        "relationshipWorkLastInbound": "Pesan kreator terakhir",
        "relationshipWorkLastOutbound": "Balasan penjual terakhir",
        "relationshipWorkContext": "Konteks catatan",
        "relationshipWorkAmbiguousCollaborations": "Kandidat konteks kolaborasi",
        "relationshipWorkNoCollaborations": "Catatan kolaborasi ini belum tertaut ke kolaborasi produk.",
        "relationshipWorkNoPendingProposals": "Tidak ada proposal tertunda di catatan kolaborasi ini.",
        "relationshipWorkActiveTitle": "{{count}} kolaborasi aktif",
        "relationshipConversationTitle": "Percakapan relasi",
        "relationshipWorkAmbiguousSummary": "Catatan kolaborasi ini memiliki beberapa konteks produk yang mungkin. Tinjau sebelum melakukan tindakan khusus produk.",
        "relationshipWorkDefaultSummary": "Catatan kolaborasi antara toko dan kreator. Kolaborasi produk muncul di sini ketika konteks produk atau sampel sudah diketahui.",
        "openCreatorRelationshipWorkDetailHint": "Buka catatan kolaborasi untuk melihat percakapan, proposal, dan kolaborasi terkait.",
        "copyRelationshipWorkSystemId": "Salin ID sistem",
        "messageChannels": {
          "PLATFORM_CHAT": "TikTok Shop",
          "WHATSAPP": "WhatsApp",
          "EMAIL": "Email"
        },
        "collaborationRecordObject": "Kolaborasi",
        "attentionFilters": {
          "ALL": "Semua",
          "APPROVAL_REQUIRED": "Persetujuan",
          "MANUAL_FOLLOW_UP": "Tindak lanjut secara manual",
          "STAFF_ACTION_REQUIRED": "Tindakan staf"
        },
        "collaborationWorkBadges": {
          "agent": "Agen",
          "approval": "Persetujuan",
          "blocked": "Diblokir",
          "done": "Selesai",
          "staff": "Staf",
          "waitingCreator": "Pencipta",
          "waitingExternal": "Eksternal",
          "waitingPlatform": "Platform"
        },
        "collaborationFilters": {
          "AGENT_REQUIRED": "Agen diperlukan",
          "STAFF_REQUIRED": "Staf diperlukan",
          "WAITING_EXTERNAL": "Menunggu pihak eksternal",
          "IDLE": "Diam"
        },
        "collaborationWorkDescriptions": {
          "BLOCKED": "Kolaborasi ini diblokir dan tidak akan dilanjutkan secara otomatis.",
          "DEFAULT": "Buka tampilan detail untuk memeriksa riwayat, proposal, dan peristiwa platform.",
          "DONE": "Tidak ada kerja terbuka dalam kolaborasi ini. Buka tampilan detail untuk memeriksa riwayat.",
          "FOLLOW_UP_CREATOR": "Langkah selanjutnya dari pihak pencipta sudah terlambat. Tindak lanjuti pembuatnya berdasarkan konteks kolaborasi saat ini.",
          "PROPOSAL_REJECTED": "Staf menolak rekomendasi agen. Sistem tidak akan melaksanakan proposal tersebut; tangani secara manual atau tunggu acara pembuat/platform berikutnya.",
          "RESOLVE_CREATOR_IDENTITY": "Sistem belum dapat mengidentifikasi pencipta ini dengan pasti. Konfirmasikan identitas secara manual atau tunggu data platform lainnya.",
          "RESPOND_TO_CREATOR": "Agen akan menyusun balasan menggunakan percakapan terkini, konteks produk, dan riwayat kolaborasi. Jika diperlukan persetujuan, maka akan dibuat proposal terlebih dahulu.",
          "REVIEW_ACTION_PROPOSAL": "Agen telah membuat proposal tindakan platform. Menyetujui atau menolaknya di halaman Usulan tindakan.",
          "REVIEW_AGENT_FAILURE": "Agen tidak menyelesaikan item pekerjaan ini. Tinjau catatan dan putuskan langkah berikutnya secara manual.",
          "REVIEW_COLLABORATION": "Kolaborasi ini memerlukan penilaian staf. Buka tampilan detail, tinjau riwayat, lalu putuskan apakah akan menanganinya di platform.",
          "REVIEW_SAMPLE_APPLICATION": "Pencipta mengajukan permintaan sampel. Agen akan menggunakan peraturan toko dan hasil prediksi untuk merekomendasikan persetujuan atau penolakan.",
          "SHIP_SAMPLE": "Permintaan sampel telah disetujui. Staf harus mengatur pengiriman di platform atau aliran gudang.",
          "WAITING_CREATOR": "Tidak diperlukan tindakan staf saat ini. Menunggu pencipta membalas, menerima sampel, atau mempublikasikan konten.",
          "WAITING_PLATFORM": "Tidak diperlukan tindakan staf saat ini. Menunggu TikTok Shop menyinkronkan pembaruan sampel, konten, atau kolaborasi."
        },
        "collaborationWorkQueueTitle": "Kolaborasi memerlukan penanganan staf",
        "collaborationWorkTitles": {
          "BLOCKED": "Pembuat konten ini diblokir",
          "DONE": "Kolaborasi ini ditangani",
          "PROPOSAL_REJECTED": "Usulan ditolak; diperlukan tindak lanjut staf",
          "PROPOSAL_REVISION_REQUESTED": "Revisi proposal diminta",
          "RESPOND_TO_CREATOR": "Balas ke penciptanya",
          "REVIEW_ACTION_PROPOSAL": "Tinjau proposal agen",
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Tindak lanjuti konten sampel",
          "WAITING_CREATOR": "Menunggu penciptanya",
          "WAITING_PLATFORM": "Menunggu pembaruan platform"
        },
        "empty": {
          "HISTORY": "Belum ada riwayat kerja afiliasi.",
          "IN_PROGRESS": "Tidak ada kolaborasi afiliasi yang sedang berlangsung.",
          "NEEDS_ATTENTION": "Tidak ada pekerjaan afiliasi yang memerlukan perhatian saat ini."
        },
        "labels": {
          "nextStep": "Langkah selanjutnya"
        },
        "historyFilters": {
          "AGENT_REQUIRED": "Agen diperlukan",
          "STAFF_REQUIRED": "Staf diperlukan",
          "WAITING_EXTERNAL": "Menunggu pihak eksternal",
          "IDLE": "Diam"
        },
        "lifecycleEventPreview": "Acara platform/sistem: {{eventType}}",
        "lifecycleEvents": {
          "PROPOSAL_REVISION_REQUESTED": "Revisi proposal diminta"
        },
        "manualFollowUpNote": "Proposal agen ditolak. Staf harus menangani item ini secara manual di platform atau dalam komunikasi tindak lanjut.",
        "processReasons": {
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Tindak lanjut konten sampel jatuh tempo"
        },
        "requiredActions": {
          "NONE": "Tidak perlu tindakan",
          "NO_ACTION": "Tidak perlu tindakan",
          "RESPOND_TO_CREATOR": "Balas kreator",
          "REPLY_TO_CREATOR": "Balas kreator",
          "REVIEW_SAMPLE_APPLICATION": "Tinjau permintaan sampel",
          "SHIP_SAMPLE": "Kirim sampel",
          "FOLLOW_UP_CREATOR": "Tindak lanjuti kreator",
          "COMPLETE_COLLABORATION_TASK": "Selesaikan tugas kolaborasi",
          "REVIEW_COLLABORATION": "Tinjau kolaborasi",
          "RESOLVE_CREATOR_IDENTITY": "Selesaikan identitas kreator",
          "REVIEW_AGENT_FAILURE": "Tinjau kegagalan agen",
          "REVIEW_ACTION_PROPOSAL": "Tinjau proposal tindakan",
          "REVIEW_AMBIGUOUS_CONTEXT": "Tinjau konteks ambigu",
          "WAIT_CREATOR_RESPONSE": "Tunggu balasan kreator",
          "WAIT_PLATFORM_UPDATE": "Tunggu pembaruan platform"
        },
        "statusLabels": {
          "AGENT_REQUIRED": "Agen diperlukan",
          "STAFF_REQUIRED": "Staf diperlukan",
          "EXTERNAL_WAITING": "Menunggu pihak eksternal",
          "WAITING_EXTERNAL": "Menunggu pihak eksternal",
          "IDLE": "Diam"
        },
        "workKinds": {
          "RELATIONSHIP": "Relasi kreator",
          "APPROVAL_REVIEW": "Tinjauan persetujuan",
          "CONTENT_FOLLOW_UP": "Tindak lanjut konten",
          "CREATOR_FOLLOW_UP": "Tindak lanjut kreator",
          "IDENTITY_RESOLUTION": "Penyelesaian identitas",
          "INBOUND_MESSAGE_TRIAGE": "Triase pesan masuk",
          "MANUAL_REVIEW": "Tinjauan manual",
          "OBSERVATION_REVIEW": "Tinjauan observasi",
          "SAMPLE_APPLICATION_DECISION": "Keputusan permintaan sampel",
          "SAMPLE_SHIPMENT": "Pengiriman sampel"
        },
        "sampleStatusPreview": "Status sampel: {{status}}; Item konten {{contentCount}} diamati.",
        "sectionHints": {
          "HISTORY": "Tindakan yang dijalankan, proposal yang ditolak, peristiwa platform, dan tindakan agen langsung.",
          "IN_PROGRESS": "Kolaborasi pembuat konten sudah berjalan tanpa adanya tindakan langsung dari staf.",
          "NEEDS_ATTENTION": "Pekerjaan afiliasi yang memerlukan persetujuan, tindak lanjut manual, atau penanganan agen."
        },
        "sections": {
          "HISTORY": "Sejarah",
          "IN_PROGRESS": "Sedang berlangsung",
          "NEEDS_ATTENTION": "Perlu perhatian"
        },
        "summary": {
          "historyHint": "Log pekerjaan terkini",
          "inProgressHint": "Menunggu pencipta atau platform",
          "needsAttentionHint": "Persetujuan dan tindak lanjut staf"
        }
      },
      "customerServiceWorkspace": {
        "filterAiState": "Penanganan AI",
        "filterConversationStatus": "Status percakapan",
        "filterEscalationState": "Eskalasi",
        "filterPageSize": "Ukuran halaman",
        "filterSearch": "Mencari",
        "filterShop": "Toko",
        "filterStatus": "Status"
      },
      "shopAdsStatus": {
        "connected": "Terhubung",
        "hint_connected": "Toko ini terhubung dengan pengikatan toko Iklan TikTok.",
        "hint_needs_advertiser": "Hubungkan akun Iklan TikTok sebelum toko ini dapat digunakan untuk pelaporan Iklan.",
        "hint_needs_link": "Akun Iklan TikTok telah terhubung, namun toko ini masih memerlukan verifikasi visibilitas toko Iklan.",
        "needs_advertiser": "Tidak ada akun Iklan",
        "needs_link": "Perlu peninjauan"
      },
      "table": {
        "headers": {
          "adsStatus": "Iklan"
        },
        "manageAds": "Kelola Iklan"
      }
    },
    "nav": {
      "account": "Akun",
      "group": {
        "accountSystem": "Akun & Sistem",
        "automation": "Otomatisasi",
        "connections": "Koneksi & Model",
        "shopOperations": "Operasional Toko"
      }
    },
    "tools": {
      "selector": {
        "name": {
          "CS_DISMISS_CONVERSATION_ESCALATIONS": "Tutup Eskalasi Percakapan",
          "ECOM_GET_OPERATION_REPORT": "Dapatkan Laporan Operasi",
          "ECOM_GET_SHOP_ORDER_SKU_EXPORT": "Ekspor SKU Pesanan",
          "ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED": "Atur AI Percakapan"
        }
      }
    },
    "tutorial": {
      "adsManagement": {
        "actionsBody": "Gunakan Connect TikTok Business untuk mengotorisasi akses pengiklan. Segarkan pembaruan pengiklan, toko yang terlihat, dan cakupan toko.",
        "actionsTitle": "Hubungkan dan Segarkan",
        "advertisersBody": "Setiap baris adalah pengiklan yang tersedia melalui otorisasi TikTok Business, termasuk peran, status token, dan jumlah toko yang terlihat.",
        "advertisersTitle": "Akun Periklanan",
        "shopCoverageBody": "Hanya toko yang sudah diotorisasi di EasyClaw yang dapat ditindaklanjuti. Toko yang terlihat oleh pengiklan yang tidak disertakan tetap bersifat informatif.",
        "shopCoverageTitle": "Cakupan Toko Terkelola",
        "summaryBody": "Penghitung ini memisahkan pengiklan resmi dari toko yang sebenarnya dapat dikelola di EasyClaw.",
        "summaryTitle": "Ringkasan Cakupan",
        "welcomeBody": "Halaman ini menghubungkan akses TikTok Business dan menunjukkan toko resmi EasyClaw mana yang dicakup oleh toko yang terlihat oleh pengiklan.",
        "welcomeTitle": "Iklan TikTok"
      },
      "billing": {
        "accountActionsBody": "Gunakan tombol ini untuk memulai pembayaran, mengelola metode pembayaran, atau membuka portal penagihan saat tindakan tersebut tersedia untuk paket Anda.",
        "accountActionsTitle": "Tindakan Penagihan Akun",
        "accountPlanBody": "Kartu ini menunjukkan hak AI tingkat akun, status paket, validitas, dan batas penggunaan untuk pengoperasian agen umum.",
        "accountPlanTitle": "Paket AI Akun",
        "overviewBody": "Header menjelaskan data penagihan apa yang ditampilkan di sini. Gunakan halaman ini untuk meninjau akses saat ini dan mengelola layanan berbayar.",
        "overviewTitle": "Ikhtisar Penagihan",
        "paymentsBody": "Pembayaran dan faktur yang telah selesai muncul di sini sehingga Anda dapat mengaudit aktivitas penagihan terkini tanpa meninggalkan aplikasi desktop.",
        "paymentsTitle": "Catatan Pembayaran",
        "shopListBody": "Setiap baris merangkum layanan berbayar yang diaktifkan toko, status, informasi perpanjangan, dan tindakan tingkat layanan.",
        "shopListTitle": "Daftar Langganan Toko",
        "shopServicesBody": "Penagihan layanan toko terpisah dari penagihan akun AI. Setiap toko yang terhubung dapat memiliki akses khusus layanan seperti layanan pelanggan AI.",
        "shopServicesTitle": "Layanan Toko",
        "subscribeFlowBody": "Alur ini memungkinkan Anda memilih toko dan paket layanan sebelum checkout. Ini hanya muncul ketika ada toko yang memenuhi syarat untuk mendapatkan akses layanan tambahan.",
        "subscribeFlowTitle": "Berlangganan Toko",
        "usageBody": "Kartu penggunaan dan metadata menunjukkan sisa kuota, waktu perpanjangan, dan status langganan. Detail ini adalah cuplikan hanya-baca dari backend penagihan.",
        "usageTitle": "Detail Penggunaan dan Paket",
        "welcomeBody": "Halaman ini menyatukan langganan akun AI, langganan layanan toko, dan catatan pembayaran.",
        "welcomeTitle": "Selamat datang di Penagihan"
      },
      "ecommerce": {
        "drawerBody": "Laci adalah tempat konfigurasi per toko berada: ikhtisar, layanan pelanggan AI, inventaris, manajemen afiliasi, penagihan, dan pengikatan perangkat.",
        "drawerTitle": "Laci Toko",
        "shopActionsBody": "Refresh menarik status toko terbaru. Tambahkan Toko memulai aliran OAuth platform untuk menghubungkan akun penjual lain.",
        "shopActionsTitle": "Aksi Toko",
        "shopAliasBody": "Alias ​​memungkinkan Anda mengganti nama toko secara lokal agar lebih mudah dikenali. Tekan Enter atau buramkan bidang untuk menyimpan.",
        "shopAliasTitle": "Belanja Alias",
        "shopRowActionsBody": "Buka laci untuk mengonfigurasi layanan, mengotorisasi ulang token yang kedaluwarsa, atau memutuskan sambungan toko.",
        "shopRowActionsTitle": "Tindakan Baris",
        "shopTableBody": "Tabel menunjukkan identitas toko, alias, platform, wilayah, status otorisasi, saldo, dan tindakan baris.",
        "shopTableTitle": "Meja Toko",
        "shopsBody": "Bagian toko mencantumkan setiap akun penjual yang terhubung dan memberi Anda titik masuk operasional utama untuk setiap toko.",
        "shopsTitle": "Toko yang Terhubung",
        "welcomeBody": "Halaman ini mengelola toko-toko yang terhubung, layanan pelanggan AI, otomatisasi afiliasi, dan integrasi gudang untuk modul e-commerce.",
        "welcomeTitle": "Selamat datang di E-niaga Global",
        "wmsActionsBody": "Segarkan status inventaris, tinjau penyedia WMS yang didukung, atau tambahkan akun gudang.",
        "wmsActionsTitle": "Tindakan Gudang",
        "wmsBody": "Akun gudang menghubungkan data toko Anda ke sistem inventaris dan pemenuhan.",
        "wmsTableBody": "Tabel gudang memperlihatkan gudang, titik akhir, mata uang, waktu sinkronisasi, dan tindakan manajemen inventaris yang disinkronkan.",
        "wmsTableTitle": "Meja Gudang",
        "wmsTitle": "Akun Gudang"
      },
      "ecommerceAffiliate": {
        "actionsBody": "Menyetujui menerapkan usulan tersebut. Tolak menolaknya dengan catatan keputusan sehingga otomatisasi tidak melakukan tindakan itu.",
        "actionsTitle": "Menyetujui Atau Menolak",
        "panelBody": "Panel berisi proposal kreator atau kolaborasi yang menunggu keputusan, dikelompokkan berdasarkan toko dan konteks kreator.",
        "panelTitle": "Panel Usulan",
        "proposalCardBody": "Setiap kartu menjelaskan jenis tindakan, alasan, ID target, dan konteks kebijakan untuk operasi afiliasi yang diusulkan.",
        "proposalCardTitle": "Kartu Usulan",
        "queueBody": "Grup proposal muncul di sini. Keadaan kosong adalah hal yang normal ketika tidak ada tindakan AI yang menunggu persetujuan manusia.",
        "queueTitle": "Antrian Usulan",
        "shopFilterBody": "Gunakan filter toko untuk fokus pada satu akun penjual atau meninjau proposal di semua toko.",
        "shopFilterTitle": "Filter Toko",
        "toolbarBody": "Bilah alat menampilkan jumlah yang tertunda, filter toko, dan tindakan penyegaran untuk menarik proposal terbaru.",
        "toolbarTitle": "Bilah Alat",
        "welcomeBody": "Ruang kerja ini meninjau proposal tindakan afiliasi yang dihasilkan AI sebelum diterapkan.",
        "welcomeTitle": "Selamat datang di Manajemen Afiliasi"
      },
      "ecommerceCustomerService": {
        "conversationDetailBody": "Panel detail menampilkan pesan, alat ringkasan, pengaktifan AI, kontrol balasan manual, dan metadata untuk percakapan yang dipilih.",
        "conversationDetailTitle": "Detil Percakapan",
        "conversationListBody": "Setiap baris merangkum percakapan pembeli dengan toko, stempel waktu, status, lencana eskalasi, dan teks pratinjau.",
        "conversationListTitle": "Daftar Percakapan",
        "conversationShellBody": "Tampilan terpisah mempertahankan antrean di sebelah kiri dan detail percakapan yang dipilih di sebelah kanan.",
        "conversationShellTitle": "Ruang Kerja Percakapan",
        "escalationQueueBody": "Tab eskalasi mencantumkan kasus yang terbuka atau tertunda yang perlu ditinjau, ditanggapi, atau ditutup.",
        "escalationQueueTitle": "Antrian Eskalasi",
        "filtersBody": "Filter berdasarkan toko, status percakapan, status AI, status eskalasi, dan ukuran halaman untuk memfokuskan antrean.",
        "filtersTitle": "Filter",
        "manualReplyBody": "Gunakan balasan manual ketika manusia perlu merespons secara langsung. Ini berfungsi bersamaan dengan kontrol AI untuk percakapan.",
        "manualReplyTitle": "Balasan Manual",
        "searchBody": "Pencarian mempersempit antrean berdasarkan pembeli, pesanan, atau pengidentifikasi percakapan. Terapkan pencarian untuk menyegarkan tampilan ruang kerja saat ini.",
        "searchTitle": "Mencari",
        "tabsBody": "Beralih antara kotak masuk percakapan langsung dan antrean eskalasi. Hitungan membantu Anda melihat beban kerja saat ini secara sekilas.",
        "tabsTitle": "Tab Ruang Kerja",
        "welcomeBody": "Ruang kerja ini untuk memantau percakapan pembeli dan menangani eskalasi AI di seluruh toko yang terhubung.",
        "welcomeTitle": "Selamat datang di Layanan Pelanggan"
      },
      "settings": {
        "showAgentNameBody": "Mengontrol apakah label merek sidebar dapat menampilkan nama agen saat ini dan bukan nama aplikasi. Aktifkan ketika Anda menjalankan beberapa agen bernama dan ingin memeriksa secara visual agen mana yang aktif.",
        "showAgentNameTitle": "Nama Agen Sidebar"
      }
    }
  },
  "it": {
    "adsManagement": {
      "adsReadyShops": "Negozi pronti per gli annunci",
      "advertiserTableSubtitle": "Collega TikTok Business o Gestione annunci, quindi Airflow sincronizza i dati della campagna, del gruppo di annunci, dell'annuncio e dei rapporti GMV Max di questi inserzionisti.",
      "advertiserTableTitle": "Conti pubblicitari",
      "authSeparationHint": "L'accesso a TikTok Ads viene concesso tramite Business/Ads Manager. EasyClaw gestisce solo negozi autorizzati anche come TikTok Shops.",
      "authStatus": {
        "AUTHORIZED": "Autorizzato",
        "DISCONNECTED": "Disconnesso",
        "REVOKED": "Revocato",
        "TOKEN_EXPIRED": "Gettone scaduto"
      },
      "authorizedAdvertisers": "Autorizzato",
      "needsAttention": "Richiede attenzione",
      "businessAccountHint": "L'autorizzazione di TikTok Ads garantisce l'accesso all'inserzionista. La copertura del negozio è utilizzabile solo quando un negozio visibile dall'inserzionista corrisponde a un negozio autorizzato da EasyClaw.",
      "columns": {
        "actions": "Azioni",
        "advertiserId": "ID inserzionista",
        "currency": "Valuta",
        "name": "Inserzionista",
        "role": "Ruolo",
        "status": "Stato di autenticazione",
        "syncHealth": "Sincronizzazione BI",
        "tokenExpiry": "Il token scade",
        "updatedAt": "Aggiornato",
        "visibleStores": "Negozi visibili"
      },
      "confirmDisconnect": "Scollegare questo account pubblicitario? La sincronizzazione BI verrà interrotta finché non verrà nuovamente autorizzata.",
      "connect": "Connetti gli annunci TikTok",
      "connectAdvertiser": "Collega l'account pubblicitario",
      "connectBusiness": "Connetti TikTok Business",
      "copyFailed": "Impossibile copiare il collegamento di autorizzazione.",
      "disconnect": "Disconnetti",
      "disconnectFailed": "Impossibile disconnettere l'account pubblicitario.",
      "disconnectSuccess": "Account pubblicitario disconnesso.",
      "emptyAdvertisersBody": "Connetti TikTok Business o Ads Manager per scoprire gli inserzionisti e i loro negozi visibili.",
      "emptyAdvertisersTitle": "Nessun account pubblicitario collegato",
      "loadFailed": "Impossibile caricare i dati di gestione degli annunci.",
      "noShops": "Nessun negozio ancora collegato.",
      "oauthFailed": "Impossibile avviare l'autorizzazione per TikTok Ads.",
      "oauthHint": "Apri questo collegamento in un browser connesso al TikTok Business Center o all'account Gestione annunci a cui appartengono gli inserzionisti.",
      "oauthModalTitle": "Connetti gli annunci TikTok",
      "oauthSuccess": "Connessione TikTok Business completata con successo.",
      "oauthTimeout": "Autorizzazione scaduta. Aggiorna la pagina se l'autorizzazione è stata completata nel browser.",
      "openAuthLink": "Apri il link di autorizzazione per TikTok Ads",
      "syncHealth": {
        "FAILED": "Problema",
        "HEALTHY": "Integro"
      },
      "syncIssue": {
        "BACKEND_ERROR": "Problema di sincronizzazione backend",
        "PERMISSION_DENIED": "Autorizzazione inserzionista persa",
        "PLATFORM_ERROR": "Problema API TikTok Ads",
        "UNKNOWN": "Problema di sincronizzazione"
      },
      "shopAdsStatus": {
        "connected": "Coperto",
        "needs_advertiser": "Nessun account pubblicitario",
        "needs_link": "Non coperto"
      },
      "shopColumns": {
        "action": "Azione",
        "adsStatus": "Stato degli annunci",
        "advertiser": "Account pubblicitari attivi",
        "coverage": "Copertura",
        "gmvMax": "Autorizzazione GMV Max attuale",
        "region": "Regione",
        "shop": "Negozio",
        "storeId": "ID del negozio"
      },
      "currentGmvMaxAccount": "GMV Max attuale",
      "gmvMaxAvailable": "GMV Max disponibile",
      "currentGmvMaxUnknown": "L'account attualmente autorizzato è in attesa di sincronizzazione",
      "shopCoverageSubtitle": "Mostra tutti gli account pubblicitari attualmente attivi per ogni negozio e identifica separatamente l'autorizzazione GMV Max attuale. Non è una vista per data dell'account di pubblicazione.",
      "shopCoverageTitle": "Copertura del negozio gestito",
      "shopReadinessSubtitle": "Esamina la copertura dell'account Ads di ciascun negozio connesso, la visibilità del negozio e la preparazione a GMV Max.",
      "shopReadinessTitle": "Acquista disponibilità degli annunci",
      "subtitle": "Connetti l'accesso a TikTok Business e verifica quali negozi autorizzati sono coperti da tali account pubblicitari.",
      "title": "Gestione degli annunci TikTok",
      "totalAdvertisers": "Account pubblicitari",
      "unonboardedStoreCount": "I negozi {{count}} visibili agli inserzionisti non sono integrati in EasyClaw",
      "waitingAuth": "In attesa dell'autorizzazione per TikTok Ads..."
    },
    "common": {
      "no": "No",
      "website": "Sito web",
      "yes": "Sì"
    },
    "ecommerce": {
      "affiliateWorkspace": {
        "approvalQueueTitle": "Proposte di azione",
        "collaborationRecordObject": "Collaborazione",
        "creatorBlocked": "Bloccato",
        "creatorIdentityId": "ID sistema identità",
        "creatorIdentityObject": "Identità creator",
        "creatorRelationshipPrimaryObject": "Relazione creator",
        "creatorRelationshipWorkPrimaryObject": "Record di collaborazione",
        "creatorRelationshipWorkItems": "Record di collaborazione",
        "openCreatorRelationshipWorkDetailHint": "Apri il record di collaborazione per vedere conversazione, proposte e collaborazioni correlate.",
        "messageChannels": {
          "PLATFORM_CHAT": "TikTok Shop",
          "WHATSAPP": "WhatsApp",
          "EMAIL": "Email"
        },
        "relationshipActiveCollaborations": "Collaborazioni attive",
        "relationshipShopStates": "Stati negozio",
        "relationshipTagCount": "{{count}} tag",
        "relationshipWorkCollaborationCount": "{{count}} collaborazione/i",
        "relationshipWorkActiveCollaborations": "Collaborazioni attive",
        "relationshipWorkActiveTitle": "{{count}} collaborazione/i attiva/e",
        "relationshipWorkAmbiguousCollaborations": "Possibili contesti di collaborazione",
        "relationshipWorkAmbiguousSummary": "Questo record di collaborazione ha più contesti prodotto possibili. Verificali prima di eseguire azioni specifiche sul prodotto.",
        "relationshipWorkPlatformChat": "Conversazione",
        "relationshipWorkDefaultSummary": "Record di collaborazione tra negozio e creator. Le collaborazioni prodotto appaiono qui quando il contesto prodotto o campione è noto.",
        "relationshipWorkLastInbound": "Ultimo messaggio creator",
        "relationshipWorkLastOutbound": "Ultima risposta venditore",
        "relationshipWorkContext": "Contesto del record",
        "relationshipWorkMoreCollaborations": "+{{count}} altre collaborazioni",
        "relationshipWorkNoCollaborations": "Questo record di collaborazione non è ancora collegato a una collaborazione prodotto.",
        "relationshipWorkNoPendingProposals": "Nessuna proposta in sospeso in questo record di collaborazione.",
        "relationshipWorkPendingProposals": "Proposte in sospeso",
        "focusedProposal": "Proposta selezionata",
        "relationshipWorkbenchSubtitle": "Pannello di lavoro per profilo creator, comunicazioni, collaborazioni e cronologia azioni.",
        "relationshipProfileSummary": "Riepilogo creator",
        "relationshipCurrentDecision": "Lavoro corrente",
        "relationshipPanelCurrentWork": "Lavoro corrente",
        "relationshipPanelCommunication": "Cronologia comunicazioni",
        "relationshipPanelCollaborations": "Record di collaborazione",
        "relationshipPanelActivity": "Cronologia azioni",
        "activity": {
          "loadOlder": "Carica attività precedenti"
        },
        "relationshipNoCurrentWork": "Nessun lavoro attivo",
        "relationshipNoCurrentWorkHint": "Questa relazione creator non ha proposte in sospeso o attività manuali al momento.",
        "relationshipNeedsManualReview": "Questa relazione creator richiede revisione dello staff prima del prossimo passo.",
        "relationshipAcrossShops": "Multi-store",
        "relationshipCommunicationHint": "Unito dai dati disponibili di store, chat piattaforma, WhatsApp ed email.",
        "noRecentContact": "Nessun contatto recente",
        "relationshipMoreShopStates": "+{{count}} altri stati store",
        "relationshipConversationTitle": "Conversazione di relazione",
        "relationshipWorkShortLabel": "Record {{id}}",
        "relationshipWorkUnread": "Non letto",
        "copyRelationshipWorkSystemId": "Copia ID sistema",
        "attentionFilters": {
          "ALL": "Tutto",
          "APPROVAL_REQUIRED": "Approvazioni",
          "MANUAL_FOLLOW_UP": "Follow-up manuale",
          "STAFF_ACTION_REQUIRED": "Azione del personale"
        },
        "collaborationWorkBadges": {
          "agent": "Agente",
          "approval": "Approvazione",
          "blocked": "Bloccato",
          "done": "Fatto",
          "staff": "Personale",
          "waitingCreator": "Creatore",
          "waitingExternal": "Esterno",
          "waitingPlatform": "Piattaforma"
        },
        "collaborationFilters": {
          "AGENT_REQUIRED": "Agente richiesto",
          "IDLE": "Inattivo",
          "STAFF_REQUIRED": "Personale richiesto",
          "WAITING_EXTERNAL": "In attesa esterna"
        },
        "collaborationWorkDescriptions": {
          "BLOCKED": "Questa collaborazione è bloccata e non verrà avanzata automaticamente.",
          "DEFAULT": "Apri la visualizzazione dettagli per esaminare la cronologia, le proposte e gli eventi della piattaforma.",
          "DONE": "Non esiste alcun lavoro aperto su questa collaborazione. Apri la visualizzazione dettagliata per esaminare la cronologia.",
          "FOLLOW_UP_CREATOR": "Il passaggio successivo da parte del creatore è in ritardo. Segui il creatore in base all'attuale contesto di collaborazione.",
          "PROPOSAL_REJECTED": "Il personale ha rifiutato la raccomandazione dell'agente. Il sistema non eseguirà tale proposta; gestiscilo manualmente o attendi il prossimo evento creatore/piattaforma.",
          "RESOLVE_CREATOR_IDENTITY": "Il sistema non è ancora in grado di identificare in modo affidabile questo creatore. Conferma l'identità manualmente o attendi ulteriori dati dalla piattaforma.",
          "RESPOND_TO_CREATOR": "L'agente redigerà una risposta utilizzando la conversazione recente, il contesto del prodotto e la cronologia della collaborazione. Se è richiesta l'approvazione, verrà prima creata una proposta.",
          "REVIEW_ACTION_PROPOSAL": "L'agente ha creato una proposta di azione della piattaforma. Approvalo o rifiutalo nella pagina Proposte di azioni.",
          "REVIEW_AGENT_FAILURE": "L'agente non ha completato questo elemento di lavoro. Esamina il record e decidi manualmente il passaggio successivo.",
          "REVIEW_COLLABORATION": "Questa collaborazione necessita del giudizio del personale. Apri la visualizzazione dettagliata, esamina la cronologia, quindi decidi se gestirla sulla piattaforma.",
          "REVIEW_SAMPLE_APPLICATION": "Il creatore ha inviato una richiesta di esempio. L'agente utilizzerà le regole del negozio e i risultati delle previsioni per consigliare l'approvazione o il rifiuto.",
          "SHIP_SAMPLE": "La richiesta del campione è stata approvata. Il personale deve organizzare la spedizione nella piattaforma o nel flusso del magazzino.",
          "WAITING_CREATOR": "Al momento non è necessaria alcuna azione da parte del personale. In attesa che il creatore risponda, riceva il campione o pubblichi contenuto.",
          "WAITING_PLATFORM": "Al momento non è necessaria alcuna azione da parte del personale. In attesa che TikTok Shop sincronizzi gli aggiornamenti di campioni, contenuti o collaborazione."
        },
        "collaborationWorkQueueTitle": "Collaborazioni che necessitano di gestione del personale",
        "collaborationWorkTitles": {
          "BLOCKED": "Questo creatore è bloccato",
          "DONE": "Questa collaborazione viene gestita",
          "PROPOSAL_REJECTED": "Proposta respinta; necessario il follow-up del personale",
          "PROPOSAL_REVISION_REQUESTED": "Richiesta revisione della proposta",
          "RESPOND_TO_CREATOR": "Rispondi al creatore",
          "REVIEW_ACTION_PROPOSAL": "Esaminare la proposta dell'agente",
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Seguire il contenuto del campione",
          "WAITING_CREATOR": "Aspettando il creatore",
          "WAITING_PLATFORM": "In attesa di aggiornamenti della piattaforma"
        },
        "empty": {
          "HISTORY": "Nessuna storia lavorativa di affiliazione ancora.",
          "IN_PROGRESS": "Al momento non sono in corso collaborazioni di affiliazione.",
          "NEEDS_ATTENTION": "Nessun lavoro di affiliazione richiede attenzione in questo momento."
        },
        "labels": {
          "nextStep": "Prossimo passo"
        },
        "historyFilters": {
          "AGENT_REQUIRED": "Agente richiesto",
          "IDLE": "Inattivo",
          "STAFF_REQUIRED": "Personale richiesto",
          "WAITING_EXTERNAL": "In attesa esterna"
        },
        "lifecycleEventPreview": "Evento piattaforma/sistema: {{eventType}}",
        "lifecycleEvents": {
          "PROPOSAL_REVISION_REQUESTED": "Richiesta revisione della proposta"
        },
        "manualFollowUpNote": "La proposta dell'agente è stata respinta. Il personale dovrebbe gestire questo elemento manualmente sulla piattaforma o nelle comunicazioni di follow-up.",
        "processReasons": {
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "Follow-up del contenuto del campione dovuto"
        },
        "requiredActions": {
          "COMPLETE_COLLABORATION_TASK": "Completare attività collaborazione",
          "FOLLOW_UP_CREATOR": "Seguire il creator",
          "NONE": "Nessuna azione richiesta",
          "NO_ACTION": "Nessuna azione richiesta",
          "RESPOND_TO_CREATOR": "Rispondere al creator",
          "REPLY_TO_CREATOR": "Rispondere al creator",
          "RESOLVE_CREATOR_IDENTITY": "Risolvere identità creator",
          "REVIEW_ACTION_PROPOSAL": "Rivedere proposta di azione",
          "REVIEW_AGENT_FAILURE": "Rivedere errore agente",
          "REVIEW_AMBIGUOUS_CONTEXT": "Rivedere contesto ambiguo",
          "REVIEW_COLLABORATION": "Rivedere collaborazione",
          "REVIEW_SAMPLE_APPLICATION": "Rivedere richiesta campione",
          "SHIP_SAMPLE": "Spedire campione",
          "WAIT_CREATOR_RESPONSE": "Attendere risposta creator",
          "WAIT_PLATFORM_UPDATE": "Attendere aggiornamento piattaforma"
        },
        "sampleStatusPreview": "Stato del campione: {{status}}; Elementi di contenuto {{contentCount}} osservati.",
        "sectionHints": {
          "HISTORY": "Azioni eseguite, proposte rifiutate, eventi della piattaforma e azioni dell'agente diretto.",
          "IN_PROGRESS": "Le collaborazioni con i creatori stanno già andando avanti senza alcuna azione immediata da parte del personale.",
          "NEEDS_ATTENTION": "Lavoro di affiliazione che necessita di approvazione, follow-up manuale o gestione da parte di agenti."
        },
        "sections": {
          "HISTORY": "Storia",
          "IN_PROGRESS": "In corso",
          "NEEDS_ATTENTION": "Ha bisogno di attenzione"
        },
        "summary": {
          "historyHint": "Registro dei lavori recenti",
          "inProgressHint": "In attesa del creatore o della piattaforma",
          "needsAttentionHint": "Approvazioni e follow-up del personale"
        },
        "statusLabels": {
          "AGENT_REQUIRED": "Agente richiesto",
          "EXTERNAL_WAITING": "In attesa esterna",
          "IDLE": "Inattivo",
          "STAFF_REQUIRED": "Personale richiesto",
          "WAITING_EXTERNAL": "In attesa esterna"
        },
        "workKinds": {
          "APPROVAL_REVIEW": "Revisione approvazione",
          "CONTENT_FOLLOW_UP": "Follow-up contenuto",
          "CREATOR_FOLLOW_UP": "Follow-up creator",
          "IDENTITY_RESOLUTION": "Risoluzione identità",
          "INBOUND_MESSAGE_TRIAGE": "Smistamento messaggio in arrivo",
          "MANUAL_REVIEW": "Revisione manuale",
          "OBSERVATION_REVIEW": "Revisione osservazione",
          "SAMPLE_APPLICATION_DECISION": "Decisione richiesta campione",
          "SAMPLE_SHIPMENT": "Spedizione campione",
          "RELATIONSHIP": "Relazione creator"
        }
      },
      "customerServiceWorkspace": {
        "filterAiState": "Gestione dell'intelligenza artificiale",
        "filterConversationStatus": "Stato della conversazione",
        "filterEscalationState": "Escalation",
        "filterPageSize": "Dimensioni della pagina",
        "filterSearch": "Ricerca",
        "filterShop": "Negozio",
        "filterStatus": "Stato"
      },
      "shopAdsStatus": {
        "connected": "Collegato",
        "hint_connected": "Questo negozio è collegato a un'associazione del negozio TikTok Ads.",
        "hint_needs_advertiser": "Collega un account TikTok Ads prima che questo negozio possa essere utilizzato per i report sugli annunci.",
        "hint_needs_link": "Un account TikTok Ads è collegato, ma questo negozio necessita ancora della verifica della visibilità del negozio Ads.",
        "needs_advertiser": "Nessun account pubblicitario",
        "needs_link": "Necessita di revisione"
      },
      "table": {
        "headers": {
          "adsStatus": "Annunci"
        },
        "manageAds": "Gestisci annunci"
      }
    },
    "nav": {
      "account": "Account",
      "group": {
        "accountSystem": "Conto e sistema",
        "automation": "Automazione",
        "connections": "Connessioni e modelli",
        "shopOperations": "Operazioni di negozio"
      }
    },
    "tools": {
      "selector": {
        "name": {
          "CS_DISMISS_CONVERSATION_ESCALATIONS": "Ignora escalation di conversazione",
          "ECOM_GET_OPERATION_REPORT": "Ottieni il rapporto sull'operazione",
          "ECOM_GET_SHOP_ORDER_SKU_EXPORT": "Esporta SKU dell'ordine",
          "ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED": "Imposta l'intelligenza artificiale della conversazione"
        }
      }
    },
    "tutorial": {
      "adsManagement": {
        "actionsBody": "Utilizza Connect TikTok Business per autorizzare l'accesso degli inserzionisti. Aggiorna aggiorna inserzionisti, negozi visibili e copertura del negozio.",
        "actionsTitle": "Connetti e aggiorna",
        "advertisersBody": "Ogni riga rappresenta un inserzionista disponibile tramite l'autorizzazione TikTok Business, inclusi ruolo, stato del token e conteggio dei negozi visibili.",
        "advertisersTitle": "Conti pubblicitari",
        "shopCoverageBody": "Solo i negozi già autorizzati in EasyClaw diventano perseguibili. I negozi visibili agli inserzionisti che non sono stati inseriti rimangono informativi.",
        "shopCoverageTitle": "Copertura del negozio gestito",
        "summaryBody": "Questi contatori separano gli inserzionisti autorizzati dai negozi che possono effettivamente essere gestiti in EasyClaw.",
        "summaryTitle": "Riepilogo della copertura",
        "welcomeBody": "Questa pagina collega l'accesso a TikTok Business e mostra quali negozi autorizzati EasyClaw sono coperti dai negozi visibili agli inserzionisti.",
        "welcomeTitle": "Annunci TikTok"
      },
      "billing": {
        "accountActionsBody": "Utilizza questi pulsanti per avviare il pagamento, gestire il metodo di pagamento o aprire il portale di fatturazione quando tali azioni sono disponibili per il tuo piano.",
        "accountActionsTitle": "Azioni di fatturazione dell'account",
        "accountPlanBody": "Questa scheda mostra il diritto AI a livello di account, lo stato del piano, la validità e i limiti di utilizzo per le esecuzioni generali dell'agente.",
        "accountPlanTitle": "Piano AI dell'account",
        "overviewBody": "L'intestazione spiega quali dati di fatturazione vengono mostrati qui. Utilizza questa pagina per verificare l'accesso corrente e gestire i servizi a pagamento.",
        "overviewTitle": "Panoramica sulla fatturazione",
        "paymentsBody": "I pagamenti e le fatture completati vengono visualizzati qui in modo da poter controllare l'attività di fatturazione recente senza uscire dall'app desktop.",
        "paymentsTitle": "Registrazioni dei pagamenti",
        "shopListBody": "Ogni riga riepiloga i servizi a pagamento abilitati di un negozio, lo stato, le informazioni sul rinnovo e le azioni a livello di servizio.",
        "shopListTitle": "Acquista l'elenco degli abbonamenti",
        "shopServicesBody": "La fatturazione del servizio di negozio è separata dalla fatturazione dell'account AI. Ogni negozio connesso può avere un accesso specifico al servizio come il servizio clienti AI.",
        "shopServicesTitle": "Servizi di negozio",
        "subscribeFlowBody": "Questo flusso ti consente di scegliere un negozio e un piano di servizio prima del pagamento. Appare solo quando ci sono negozi idonei per l'accesso al servizio aggiuntivo.",
        "subscribeFlowTitle": "Iscriviti a un negozio",
        "usageBody": "Le schede di utilizzo e i metadati mostrano la quota rimanente, i tempi di rinnovo e lo stato dell'abbonamento. Questi dettagli sono istantanee di sola lettura dal backend di fatturazione.",
        "usageTitle": "Dettagli sull'utilizzo e sul piano",
        "welcomeBody": "Questa pagina riunisce l'abbonamento all'account AI, gli abbonamenti ai servizi di negozio e i record di pagamento.",
        "welcomeTitle": "Benvenuto in Fatturazione"
      },
      "ecommerce": {
        "drawerBody": "Il drawer è il luogo in cui risiede la configurazione per negozio: panoramica, servizio clienti AI, inventario, gestione affiliati, fatturazione e associazione del dispositivo.",
        "drawerTitle": "Cassetto del negozio",
        "shopActionsBody": "Aggiorna richiama l'ultimo stato del negozio. Aggiungi negozio avvia il flusso OAuth della piattaforma per connettere un altro account venditore.",
        "shopActionsTitle": "Acquista azioni",
        "shopAliasBody": "Gli alias ti consentono di rinominare un negozio localmente per riconoscerlo più facilmente. Premi Invio o sfoca il campo per salvare.",
        "shopAliasTitle": "Acquista Alias",
        "shopRowActionsBody": "Apri il drawer per configurare servizi, autorizzare nuovamente i token scaduti o disconnettere un negozio.",
        "shopRowActionsTitle": "Azioni di riga",
        "shopTableBody": "La tabella mostra l'identità del negozio, l'alias, la piattaforma, la regione, lo stato di autorizzazione, il saldo e le azioni sulle righe.",
        "shopTableTitle": "Tavolo del negozio",
        "shopsBody": "La sezione negozio elenca tutti gli account venditore collegati e fornisce i principali punti di ingresso operativi per ciascun negozio.",
        "shopsTitle": "Negozi connessi",
        "welcomeBody": "Questa pagina gestisce i negozi connessi, il servizio clienti AI, l'automazione degli affiliati e le integrazioni del magazzino per il modulo e-commerce.",
        "welcomeTitle": "Benvenuti nell'e-commerce globale",
        "wmsActionsBody": "Aggiorna lo stato dell'inventario, esamina i fornitori WMS supportati o aggiungi un account di magazzino.",
        "wmsActionsTitle": "Azioni di magazzino",
        "wmsBody": "Gli account di magazzino collegano i dati del tuo negozio ai sistemi di inventario e di evasione ordini.",
        "wmsTableBody": "La tabella del magazzino mostra i magazzini sincronizzati, gli endpoint, le valute, il tempo di sincronizzazione e le azioni di gestione dell'inventario.",
        "wmsTableTitle": "Tavolo del magazzino",
        "wmsTitle": "Conti di magazzino"
      },
      "ecommerceAffiliate": {
        "actionsBody": "Approva applica la proposta. Rifiuta lo respinge con una nota decisionale in modo che l'automazione non esegua tale azione.",
        "actionsTitle": "Approva o rifiuta",
        "panelBody": "Il pannello contiene proposte di collaborazione o creatori in sospeso raggruppate per negozio e contesto del creatore.",
        "panelTitle": "Pannello delle proposte",
        "proposalCardBody": "Ogni scheda spiega il tipo di azione, il ragionamento, gli ID target e il contesto politico per l'operazione di affiliazione proposta.",
        "proposalCardTitle": "Scheda proposta",
        "queueBody": "I gruppi di proposte vengono visualizzati qui. Gli stati vuoti sono normali quando nessuna azione dell'IA attende l'approvazione umana.",
        "queueTitle": "Coda di proposte",
        "shopFilterBody": "Utilizza il filtro del negozio per concentrarti su un account venditore o esaminare le proposte di tutti i negozi.",
        "shopFilterTitle": "Acquista filtro",
        "toolbarBody": "La barra degli strumenti mostra il conteggio in sospeso, il filtro del negozio e l'azione di aggiornamento per estrarre le ultime proposte.",
        "toolbarTitle": "Barra degli strumenti",
        "welcomeBody": "Questa area di lavoro esamina le proposte di azioni di affiliazione generate dall'intelligenza artificiale prima che vengano applicate.",
        "welcomeTitle": "Benvenuto nella gestione degli affiliati"
      },
      "ecommerceCustomerService": {
        "conversationDetailBody": "Il riquadro dei dettagli mostra messaggi, strumenti di riepilogo, abilitazione dell'intelligenza artificiale, controlli di risposta manuale e metadati per la conversazione selezionata.",
        "conversationDetailTitle": "Dettagli della conversazione",
        "conversationListBody": "Ogni riga riassume una conversazione dell'acquirente con negozio, timestamp, stato, badge di escalation e testo di anteprima.",
        "conversationListTitle": "Elenco conversazioni",
        "conversationShellBody": "La visualizzazione divisa mantiene la coda a sinistra e i dettagli della conversazione selezionata a destra.",
        "conversationShellTitle": "Area di lavoro di conversazione",
        "escalationQueueBody": "La scheda dell'escalation elenca i casi aperti o pendenti che necessitano di revisione, risposta o archiviazione.",
        "escalationQueueTitle": "Coda di escalation",
        "filtersBody": "Filtra per negozio, stato della conversazione, stato dell'intelligenza artificiale, stato dell'escalation e dimensione della pagina per focalizzare la coda.",
        "filtersTitle": "Filtri",
        "manualReplyBody": "Utilizza la risposta manuale quando un essere umano ha bisogno di rispondere direttamente. Funziona insieme ai controlli AI per la conversazione.",
        "manualReplyTitle": "Risposta manuale",
        "searchBody": "La ricerca restringe la coda in base agli identificatori dell'acquirente, dell'ordine o della conversazione. Applica la ricerca per aggiornare la visualizzazione corrente dell'area di lavoro.",
        "searchTitle": "Ricerca",
        "tabsBody": "Passa dalla casella di posta delle conversazioni in tempo reale alla coda di escalation. I conteggi ti aiutano a vedere il carico di lavoro corrente a colpo d'occhio.",
        "tabsTitle": "Schede dell'area di lavoro",
        "welcomeBody": "Questo spazio di lavoro serve per monitorare le conversazioni degli acquirenti e gestire le escalation dell'intelligenza artificiale tra i negozi connessi.",
        "welcomeTitle": "Benvenuto nel Servizio Clienti"
      },
      "settings": {
        "showAgentNameBody": "Controlla se l'etichetta del marchio della barra laterale può mostrare il nome dell'agente corrente anziché il nome dell'app. Attivalo quando esegui più agenti denominati e desideri un rapido controllo visivo di quale è attivo.",
        "showAgentNameTitle": "Nome dell'agente nella barra laterale"
      }
    }
  },
  "th": {
    "adsManagement": {
      "adsReadyShops": "ร้านค้าพร้อมโฆษณา",
      "advertiserTableSubtitle": "เชื่อมต่อ TikTok Business หรือตัวจัดการโฆษณา จากนั้น Airflow จะซิงค์แคมเปญ กลุ่มโฆษณา โฆษณา และข้อมูลการรายงาน GMV Max จากผู้ลงโฆษณาเหล่านี้",
      "advertiserTableTitle": "บัญชีโฆษณา",
      "authSeparationHint": "การเข้าถึงโฆษณา TikTok ได้รับอนุญาตผ่านตัวจัดการธุรกิจ/โฆษณา EasyClaw จัดการเฉพาะร้านค้าที่ได้รับอนุญาตเป็น TikTok Shops เท่านั้น",
      "authStatus": {
        "AUTHORIZED": "ได้รับอนุญาต",
        "DISCONNECTED": "ตัดการเชื่อมต่อแล้ว",
        "REVOKED": "เพิกถอนแล้ว",
        "TOKEN_EXPIRED": "โทเค็นหมดอายุ"
      },
      "authorizedAdvertisers": "ได้รับอนุญาต",
      "needsAttention": "ต้องตรวจสอบ",
      "businessAccountHint": "การอนุญาตโฆษณา TikTok ให้สิทธิ์การเข้าถึงแก่ผู้ลงโฆษณา ความครอบคลุมของร้านค้าจะดำเนินการได้ก็ต่อเมื่อร้านค้าที่ผู้ลงโฆษณามองเห็นได้แม็ปกลับไปยังร้านค้าที่ได้รับอนุญาตจาก EasyClaw เท่านั้น",
      "columns": {
        "actions": "การดำเนินการ",
        "advertiserId": "รหัสผู้ลงโฆษณา",
        "currency": "สกุลเงิน",
        "name": "ผู้ลงโฆษณา",
        "role": "บทบาท",
        "status": "สถานะการรับรองความถูกต้อง",
        "syncHealth": "ซิงค์ BI",
        "tokenExpiry": "โทเค็นหมดอายุ",
        "updatedAt": "อัปเดตแล้ว",
        "visibleStores": "ร้านค้าที่มองเห็นได้"
      },
      "confirmDisconnect": "ยกเลิกการเชื่อมต่อบัญชีโฆษณานี้ใช่ไหม การซิงค์ BI จะหยุดจนกว่าจะได้รับอนุญาตอีกครั้ง",
      "connect": "เชื่อมต่อโฆษณา TikTok",
      "connectAdvertiser": "เชื่อมต่อบัญชีโฆษณา",
      "connectBusiness": "เชื่อมต่อธุรกิจ TikTok",
      "copyFailed": "คัดลอกลิงก์การให้สิทธิ์ไม่สำเร็จ",
      "disconnect": "ตัดการเชื่อมต่อ",
      "disconnectFailed": "ไม่สามารถยกเลิกการเชื่อมต่อบัญชีโฆษณาได้",
      "disconnectSuccess": "บัญชีโฆษณาถูกตัดการเชื่อมต่อ",
      "emptyAdvertisersBody": "เชื่อมต่อ TikTok Business หรือตัวจัดการโฆษณาเพื่อค้นหาผู้ลงโฆษณาและร้านค้าที่มองเห็นได้",
      "emptyAdvertisersTitle": "ไม่มีบัญชีโฆษณาที่เชื่อมต่อ",
      "loadFailed": "โหลดข้อมูลการจัดการโฆษณาไม่สำเร็จ",
      "noShops": "ยังไม่มีร้านค้าที่เชื่อมต่อ",
      "oauthFailed": "ไม่สามารถเริ่มการอนุญาตโฆษณา TikTok",
      "oauthHint": "เปิดลิงก์นี้ในเบราว์เซอร์ที่ลงชื่อเข้าใช้บัญชี TikTok Business Center หรือตัวจัดการโฆษณาที่เป็นเจ้าของผู้ลงโฆษณา",
      "oauthModalTitle": "เชื่อมต่อโฆษณา TikTok",
      "oauthSuccess": "การเชื่อมต่อ TikTok Business เสร็จสมบูรณ์แล้ว",
      "oauthTimeout": "การอนุญาตหมดเวลา รีเฟรชหน้าหากการอนุญาตเสร็จสมบูรณ์ในเบราว์เซอร์",
      "openAuthLink": "เปิดลิงก์การอนุญาตโฆษณา TikTok",
      "syncHealth": {
        "FAILED": "มีปัญหา",
        "HEALTHY": "ปกติ"
      },
      "syncIssue": {
        "BACKEND_ERROR": "ปัญหาการซิงค์ backend",
        "PERMISSION_DENIED": "สิทธิ์ผู้ลงโฆษณาหายไป",
        "PLATFORM_ERROR": "ปัญหา API ของ TikTok Ads",
        "UNKNOWN": "ปัญหาการซิงค์"
      },
      "shopAdsStatus": {
        "connected": "ครอบคลุม",
        "needs_advertiser": "ไม่มีบัญชีโฆษณา",
        "needs_link": "ไม่ครอบคลุม"
      },
      "shopColumns": {
        "action": "การกระทำ",
        "adsStatus": "สถานะโฆษณา",
        "advertiser": "บัญชีโฆษณาที่ใช้งานอยู่",
        "coverage": "ความคุ้มครอง",
        "gmvMax": "การอนุญาต GMV Max ปัจจุบัน",
        "region": "ภูมิภาค",
        "shop": "ร้านค้า",
        "storeId": "รหัสร้านค้า"
      },
      "currentGmvMaxAccount": "GMV Max ปัจจุบัน",
      "gmvMaxAvailable": "GMV Max พร้อมใช้งาน",
      "currentGmvMaxUnknown": "บัญชีที่ได้รับอนุญาตในปัจจุบันกำลังรอการซิงค์",
      "shopCoverageSubtitle": "แสดงบัญชีโฆษณาที่ใช้งานอยู่ทั้งหมดของแต่ละร้านค้า และระบุการอนุญาต GMV Max ปัจจุบันแยกต่างหาก ไม่ใช่มุมมองบัญชีที่ใช้เผยแพร่ตามวันที่",
      "shopCoverageTitle": "ครอบคลุมร้านค้าที่ได้รับการจัดการ",
      "shopReadinessSubtitle": "ตรวจสอบความครอบคลุมของบัญชี Ads ของร้านค้าที่เชื่อมต่อกัน การมองเห็นร้านค้า และความพร้อมของ GMV Max",
      "shopReadinessTitle": "ความพร้อมของโฆษณาร้านค้า",
      "subtitle": "เชื่อมต่อการเข้าถึง TikTok Business และตรวจสอบว่าร้านค้าที่ได้รับอนุญาตแห่งใดอยู่ภายใต้บัญชีโฆษณาเหล่านั้น",
      "title": "การจัดการโฆษณา TikTok",
      "totalAdvertisers": "บัญชีโฆษณา",
      "unonboardedStoreCount": "ร้านค้าที่ผู้ลงโฆษณามองเห็น {{count}} ไม่ได้เปิดใช้งานใน EasyClaw",
      "waitingAuth": "กำลังรอการอนุญาตโฆษณา TikTok..."
    },
    "common": {
      "no": "ไม่ใช่",
      "website": "เว็บไซต์",
      "yes": "ใช่"
    },
    "ecommerce": {
      "affiliateWorkspace": {
        "approvalQueueTitle": "ข้อเสนอการดำเนินการ",
        "collaborationRecordObject": "ความร่วมมือ",
        "creatorBlocked": "ถูกบล็อก",
        "creatorIdentityId": "ID ระบบของตัวตน",
        "creatorIdentityObject": "ตัวตนครีเอเตอร์",
        "creatorRelationshipPrimaryObject": "ความสัมพันธ์กับครีเอเตอร์",
        "creatorRelationshipWorkPrimaryObject": "บันทึกความร่วมมือ",
        "creatorRelationshipWorkItems": "บันทึกความร่วมมือ",
        "openCreatorRelationshipWorkDetailHint": "เปิดบันทึกความร่วมมือเพื่อดูการสนทนา ข้อเสนอ และความร่วมมือที่เกี่ยวข้อง",
        "messageChannels": {
          "PLATFORM_CHAT": "TikTok Shop",
          "WHATSAPP": "WhatsApp",
          "EMAIL": "Email"
        },
        "relationshipActiveCollaborations": "ความร่วมมือที่ใช้งานอยู่",
        "relationshipShopStates": "สถานะร้านค้า",
        "relationshipTagCount": "{{count}} แท็ก",
        "relationshipWorkCollaborationCount": "{{count}} ความร่วมมือ",
        "relationshipWorkActiveCollaborations": "ความร่วมมือที่ใช้งานอยู่",
        "relationshipWorkActiveTitle": "{{count}} ความร่วมมือที่ใช้งานอยู่",
        "relationshipWorkAmbiguousCollaborations": "บริบทความร่วมมือที่เป็นไปได้",
        "relationshipWorkAmbiguousSummary": "บันทึกความร่วมมือนี้มีบริบทสินค้าที่เป็นไปได้หลายรายการ โปรดตรวจสอบก่อนดำเนินการเฉพาะสินค้า",
        "relationshipWorkPlatformChat": "การสนทนา",
        "relationshipWorkDefaultSummary": "บันทึกความร่วมมือระหว่างร้านค้ากับครีเอเตอร์ ความร่วมมือระดับสินค้าจะแสดงที่นี่เมื่อทราบบริบทสินค้า หรือตัวอย่างสินค้า",
        "relationshipWorkLastInbound": "ข้อความล่าสุดจากครีเอเตอร์",
        "relationshipWorkLastOutbound": "คำตอบล่าสุดจากผู้ขาย",
        "relationshipWorkContext": "บริบทของบันทึก",
        "relationshipWorkMoreCollaborations": "+{{count}} ความร่วมมือเพิ่มเติม",
        "relationshipWorkNoCollaborations": "บันทึกความร่วมมือนี้ยังไม่ได้เชื่อมกับความร่วมมือระดับสินค้า",
        "relationshipWorkNoPendingProposals": "ไม่มีข้อเสนอที่รออนุมัติในบันทึกความร่วมมือนี้",
        "relationshipWorkPendingProposals": "ข้อเสนอที่รออนุมัติ",
        "focusedProposal": "ข้อเสนอที่เลือก",
        "relationshipWorkbenchSubtitle": "พื้นที่ทำงานสำหรับโปรไฟล์ครีเอเตอร์ การสื่อสาร ความร่วมมือ และประวัติการดำเนินการ",
        "relationshipProfileSummary": "สรุปครีเอเตอร์",
        "relationshipCurrentDecision": "งานปัจจุบัน",
        "relationshipPanelCurrentWork": "งานปัจจุบัน",
        "relationshipPanelCommunication": "ประวัติการสื่อสาร",
        "relationshipPanelCollaborations": "บันทึกความร่วมมือ",
        "relationshipPanelActivity": "ประวัติการดำเนินการ",
        "activity": {
          "loadOlder": "โหลดกิจกรรมก่อนหน้า"
        },
        "relationshipNoCurrentWork": "ไม่มีงานที่กำลังดำเนินอยู่",
        "relationshipNoCurrentWorkHint": "ความสัมพันธ์กับครีเอเตอร์นี้ยังไม่มีข้อเสนอที่รออนุมัติหรืองานที่ต้องจัดการด้วยตนเอง",
        "relationshipNeedsManualReview": "ความสัมพันธ์กับครีเอเตอร์นี้ต้องให้พนักงานตรวจสอบก่อนตัดสินใจขั้นต่อไป",
        "relationshipAcrossShops": "ข้ามร้านค้า",
        "relationshipCommunicationHint": "รวมจากข้อมูลร้านค้า แชตแพลตฟอร์ม WhatsApp และอีเมลที่มีอยู่",
        "noRecentContact": "ไม่มีการติดต่อล่าสุด",
        "relationshipMoreShopStates": "+อีก {{count}} สถานะร้านค้า",
        "relationshipConversationTitle": "การสนทนาในความสัมพันธ์",
        "relationshipWorkShortLabel": "บันทึก {{id}}",
        "relationshipWorkUnread": "ยังไม่ได้อ่าน",
        "copyRelationshipWorkSystemId": "คัดลอก ID ระบบ",
        "attentionFilters": {
          "ALL": "ทั้งหมด",
          "APPROVAL_REQUIRED": "การอนุมัติ",
          "MANUAL_FOLLOW_UP": "การติดตามผลด้วยตนเอง",
          "STAFF_ACTION_REQUIRED": "การกระทำของพนักงาน"
        },
        "collaborationWorkBadges": {
          "agent": "ตัวแทน",
          "approval": "การอนุมัติ",
          "blocked": "ถูกบล็อก",
          "done": "เสร็จแล้ว",
          "staff": "พนักงาน",
          "waitingCreator": "ผู้สร้าง",
          "waitingExternal": "ภายนอก",
          "waitingPlatform": "แพลตฟอร์ม"
        },
        "collaborationFilters": {
          "AGENT_REQUIRED": "ต้องใช้ Agent",
          "IDLE": "ว่าง",
          "STAFF_REQUIRED": "ต้องให้พนักงานจัดการ",
          "WAITING_EXTERNAL": "รอการตอบกลับภายนอก"
        },
        "collaborationWorkDescriptions": {
          "BLOCKED": "การทำงานร่วมกันนี้ถูกบล็อกและจะไม่ก้าวหน้าโดยอัตโนมัติ",
          "DEFAULT": "เปิดมุมมองรายละเอียดเพื่อตรวจสอบประวัติ ข้อเสนอ และกิจกรรมแพลตฟอร์ม",
          "DONE": "ไม่มีงานเปิดเกี่ยวกับความร่วมมือนี้ เปิดมุมมองรายละเอียดเพื่อตรวจสอบประวัติ",
          "FOLLOW_UP_CREATOR": "ขั้นตอนต่อไปฝั่งผู้สร้างเกินกำหนด ติดตามผลกับผู้สร้างตามบริบทการทำงานร่วมกันในปัจจุบัน",
          "PROPOSAL_REJECTED": "พนักงานปฏิเสธคำแนะนำของตัวแทน ระบบจะไม่ดำเนินการตามข้อเสนอนั้น จัดการด้วยตนเองหรือรอกิจกรรมของผู้สร้าง/แพลตฟอร์มครั้งถัดไป",
          "RESOLVE_CREATOR_IDENTITY": "ระบบยังไม่สามารถระบุผู้สร้างรายนี้ได้อย่างน่าเชื่อถือ ยืนยันตัวตนด้วยตนเองหรือรอข้อมูลแพลตฟอร์มเพิ่มเติม",
          "RESPOND_TO_CREATOR": "ตัวแทนจะร่างการตอบกลับโดยใช้การสนทนาล่าสุด บริบทผลิตภัณฑ์ และประวัติการทำงานร่วมกัน หากจำเป็นต้องได้รับการอนุมัติ ระบบจะสร้างข้อเสนอก่อน",
          "REVIEW_ACTION_PROPOSAL": "ตัวแทนได้สร้างข้อเสนอการดำเนินการตามแพลตฟอร์ม อนุมัติหรือปฏิเสธในหน้าข้อเสนอการดำเนินการ",
          "REVIEW_AGENT_FAILURE": "เอเจนต์ไม่ได้ดำเนินการไอเท็มงานนี้ให้เสร็จสมบูรณ์ ตรวจสอบบันทึกและตัดสินใจขั้นตอนถัดไปด้วยตนเอง",
          "REVIEW_COLLABORATION": "ความร่วมมือนี้จำเป็นต้องมีวิจารณญาณของพนักงาน เปิดมุมมองรายละเอียด ตรวจสอบประวัติ จากนั้นตัดสินใจว่าจะจัดการบนแพลตฟอร์มหรือไม่",
          "REVIEW_SAMPLE_APPLICATION": "ผู้สร้างได้ส่งคำขอตัวอย่าง ตัวแทนจะใช้กฎของร้านค้าและผลการคาดการณ์เพื่อแนะนำการอนุมัติหรือการปฏิเสธ",
          "SHIP_SAMPLE": "คำขอตัวอย่างได้รับการอนุมัติแล้ว พนักงานควรจัดเตรียมการจัดส่งในแพลตฟอร์มหรือโฟลว์คลังสินค้า",
          "WAITING_CREATOR": "ไม่จำเป็นต้องดำเนินการใดๆ จากเจ้าหน้าที่ในขณะนี้ กำลังรอให้ผู้สร้างตอบกลับ รับตัวอย่าง หรือเผยแพร่เนื้อหา",
          "WAITING_PLATFORM": "ไม่จำเป็นต้องดำเนินการใดๆ จากเจ้าหน้าที่ในขณะนี้ กำลังรอให้ TikTok Shop ซิงค์ตัวอย่าง เนื้อหา หรือการอัปเดตการทำงานร่วมกัน"
        },
        "collaborationWorkQueueTitle": "การทำงานร่วมกันที่จำเป็นต้องมีการจัดการพนักงาน",
        "collaborationWorkTitles": {
          "BLOCKED": "ผู้สร้างรายนี้ถูกบล็อก",
          "DONE": "ความร่วมมือนี้ได้รับการจัดการ",
          "PROPOSAL_REJECTED": "ข้อเสนอถูกปฏิเสธ จำเป็นต้องมีการติดตามผลจากเจ้าหน้าที่",
          "PROPOSAL_REVISION_REQUESTED": "มีการขอแก้ไขข้อเสนอ",
          "RESPOND_TO_CREATOR": "ตอบกลับผู้สร้าง",
          "REVIEW_ACTION_PROPOSAL": "ตรวจสอบข้อเสนอตัวแทน",
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "ติดตามคอนเทนต์ตัวอย่าง",
          "WAITING_CREATOR": "รอผู้สร้างครับ",
          "WAITING_PLATFORM": "รอการอัพเดตแพลตฟอร์ม"
        },
        "empty": {
          "HISTORY": "ยังไม่มีประวัติการทำงานในเครือ",
          "IN_PROGRESS": "ขณะนี้ไม่มีความร่วมมือ Affiliate อยู่ระหว่างดำเนินการ",
          "NEEDS_ATTENTION": "ไม่มีงานพันธมิตรที่ต้องการความสนใจในขณะนี้"
        },
        "labels": {
          "nextStep": "ขั้นตอนต่อไป"
        },
        "historyFilters": {
          "AGENT_REQUIRED": "ต้องใช้ Agent",
          "IDLE": "ว่าง",
          "STAFF_REQUIRED": "ต้องให้พนักงานจัดการ",
          "WAITING_EXTERNAL": "รอการตอบกลับภายนอก"
        },
        "lifecycleEventPreview": "เหตุการณ์แพลตฟอร์ม/ระบบ: {{eventType}}",
        "lifecycleEvents": {
          "PROPOSAL_REVISION_REQUESTED": "มีการขอแก้ไขข้อเสนอ"
        },
        "manualFollowUpNote": "ข้อเสนอตัวแทนถูกปฏิเสธ เจ้าหน้าที่ควรจัดการรายการนี้ด้วยตนเองบนแพลตฟอร์มหรือในการสื่อสารเพื่อติดตามผล",
        "processReasons": {
          "SAMPLE_CONTENT_FOLLOW_UP_DUE": "ถึงกำหนดติดตามคอนเทนต์ตัวอย่าง"
        },
        "requiredActions": {
          "COMPLETE_COLLABORATION_TASK": "ทำงานความร่วมมือให้เสร็จ",
          "FOLLOW_UP_CREATOR": "ติดตามครีเอเตอร์",
          "NONE": "ไม่ต้องดำเนินการ",
          "NO_ACTION": "ไม่ต้องดำเนินการ",
          "RESPOND_TO_CREATOR": "ตอบกลับครีเอเตอร์",
          "REPLY_TO_CREATOR": "ตอบกลับครีเอเตอร์",
          "RESOLVE_CREATOR_IDENTITY": "ระบุตัวตนครีเอเตอร์",
          "REVIEW_ACTION_PROPOSAL": "ตรวจสอบข้อเสนอการดำเนินการ",
          "REVIEW_AGENT_FAILURE": "ตรวจสอบความล้มเหลวของ Agent",
          "REVIEW_AMBIGUOUS_CONTEXT": "ตรวจสอบบริบทที่ไม่ชัดเจน",
          "REVIEW_COLLABORATION": "ตรวจสอบความร่วมมือ",
          "REVIEW_SAMPLE_APPLICATION": "ตรวจสอบคำขอตัวอย่าง",
          "SHIP_SAMPLE": "จัดส่งตัวอย่าง",
          "WAIT_CREATOR_RESPONSE": "รอครีเอเตอร์ตอบกลับ",
          "WAIT_PLATFORM_UPDATE": "รอแพลตฟอร์มอัปเดต"
        },
        "sampleStatusPreview": "สถานะตัวอย่าง: {{status}}; พบรายการเนื้อหา {{contentCount}}",
        "sectionHints": {
          "HISTORY": "การดำเนินการที่ดำเนินการ ข้อเสนอที่ถูกปฏิเสธ กิจกรรมแพลตฟอร์ม และการดำเนินการของตัวแทนโดยตรง",
          "IN_PROGRESS": "การทำงานร่วมกันของครีเอเตอร์กำลังก้าวไปข้างหน้าโดยไม่มีการดำเนินการจากเจ้าหน้าที่ทันที",
          "NEEDS_ATTENTION": "งานในเครือที่ต้องได้รับการอนุมัติ การติดตามผลด้วยตนเอง หรือการจัดการตัวแทน"
        },
        "sections": {
          "HISTORY": "ประวัติศาสตร์",
          "IN_PROGRESS": "อยู่ระหว่างดำเนินการ",
          "NEEDS_ATTENTION": "ต้องการความสนใจ"
        },
        "summary": {
          "historyHint": "บันทึกการทำงานล่าสุด",
          "inProgressHint": "กำลังรอผู้สร้างหรือแพลตฟอร์ม",
          "needsAttentionHint": "การอนุมัติและการติดตามผลพนักงาน"
        },
        "statusLabels": {
          "AGENT_REQUIRED": "ต้องใช้ Agent",
          "EXTERNAL_WAITING": "รอการตอบกลับภายนอก",
          "IDLE": "ว่าง",
          "STAFF_REQUIRED": "ต้องให้พนักงานจัดการ",
          "WAITING_EXTERNAL": "รอการตอบกลับภายนอก"
        },
        "workKinds": {
          "APPROVAL_REVIEW": "ตรวจสอบการอนุมัติ",
          "CONTENT_FOLLOW_UP": "ติดตามคอนเทนต์",
          "CREATOR_FOLLOW_UP": "ติดตามครีเอเตอร์",
          "IDENTITY_RESOLUTION": "ระบุตัวตน",
          "INBOUND_MESSAGE_TRIAGE": "คัดแยกข้อความขาเข้า",
          "MANUAL_REVIEW": "ตรวจสอบโดยพนักงาน",
          "OBSERVATION_REVIEW": "ตรวจสอบผลการสังเกต",
          "SAMPLE_APPLICATION_DECISION": "ตัดสินใจคำขอตัวอย่าง",
          "SAMPLE_SHIPMENT": "จัดส่งตัวอย่าง",
          "RELATIONSHIP": "ความสัมพันธ์ครีเอเตอร์"
        }
      },
      "customerServiceWorkspace": {
        "filterAiState": "การจัดการเอไอ",
        "filterConversationStatus": "สถานะการสนทนา",
        "filterEscalationState": "การยกระดับ",
        "filterPageSize": "ขนาดหน้า",
        "filterSearch": "ค้นหา",
        "filterShop": "ร้านค้า",
        "filterStatus": "สถานะ"
      },
      "shopAdsStatus": {
        "connected": "เชื่อมต่อแล้ว",
        "hint_connected": "ร้านค้านี้เชื่อมโยงกับการผูกร้านค้า TikTok Ads",
        "hint_needs_advertiser": "เชื่อมต่อบัญชีโฆษณา TikTok ก่อนที่จะใช้ร้านนี้เพื่อรายงานโฆษณา",
        "hint_needs_link": "เชื่อมต่อบัญชีโฆษณา TikTok แล้ว แต่ร้านค้านี้ยังต้องมีการตรวจสอบการเปิดเผยร้านค้าโฆษณา",
        "needs_advertiser": "ไม่มีบัญชีโฆษณา",
        "needs_link": "จำเป็นต้องตรวจสอบ"
      },
      "table": {
        "headers": {
          "adsStatus": "โฆษณา"
        },
        "manageAds": "จัดการโฆษณา"
      }
    },
    "nav": {
      "account": "บัญชี",
      "group": {
        "accountSystem": "บัญชีและระบบ",
        "automation": "ระบบอัตโนมัติ",
        "connections": "การเชื่อมต่อและรุ่น",
        "shopOperations": "การดำเนินงานร้านค้า"
      }
    },
    "tools": {
      "selector": {
        "name": {
          "CS_DISMISS_CONVERSATION_ESCALATIONS": "ยกเลิกการยกระดับการสนทนา",
          "ECOM_GET_OPERATION_REPORT": "รับรายงานการดำเนินงาน",
          "ECOM_GET_SHOP_ORDER_SKU_EXPORT": "ส่งออก SKU ของคำสั่งซื้อ",
          "ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED": "ตั้งค่า AI การสนทนา"
        }
      }
    },
    "tutorial": {
      "adsManagement": {
        "actionsBody": "ใช้เชื่อมต่อ TikTok Business เพื่ออนุญาตการเข้าถึงของผู้ลงโฆษณา รีเฟรชการอัปเดตผู้ลงโฆษณา ร้านค้าที่มองเห็นได้ และความครอบคลุมของร้านค้า",
        "actionsTitle": "เชื่อมต่อและรีเฟรช",
        "advertisersBody": "แต่ละแถวคือผู้ลงโฆษณาที่พร้อมให้บริการผ่านการอนุญาตของ TikTok Business รวมถึงบทบาท สถานะโทเค็น และจำนวนร้านค้าที่มองเห็นได้",
        "advertisersTitle": "บัญชีโฆษณา",
        "shopCoverageBody": "เฉพาะร้านค้าที่ได้รับอนุญาตใน EasyClaw เท่านั้นที่สามารถดำเนินการได้ ร้านค้าที่ผู้ลงโฆษณามองเห็นได้ซึ่งไม่ได้เริ่มต้นระบบจะยังคงให้ข้อมูลอยู่",
        "shopCoverageTitle": "ครอบคลุมร้านค้าที่ได้รับการจัดการ",
        "summaryBody": "ตัวนับเหล่านี้จะแยกผู้โฆษณาที่ได้รับอนุญาตออกจากร้านค้าที่สามารถจัดการได้ใน EasyClaw",
        "summaryTitle": "สรุปความคุ้มครอง",
        "welcomeBody": "หน้านี้เชื่อมโยงการเข้าถึง TikTok Business และแสดงให้เห็นว่าร้านค้าที่ได้รับอนุญาตจาก EasyClaw แห่งใดบ้างที่อยู่ภายใต้ร้านค้าที่ผู้ลงโฆษณามองเห็นได้",
        "welcomeTitle": "โฆษณาติ๊กต๊อก"
      },
      "billing": {
        "accountActionsBody": "ใช้ปุ่มเหล่านี้เพื่อเริ่มการชำระเงิน จัดการวิธีการชำระเงิน หรือเปิดพอร์ทัลการเรียกเก็บเงินเมื่อมีการดำเนินการเหล่านั้นสำหรับแผนของคุณ",
        "accountActionsTitle": "การดำเนินการเรียกเก็บเงินของบัญชี",
        "accountPlanBody": "การ์ดใบนี้แสดงสิทธิ์ AI ระดับบัญชีของคุณ สถานะแผน ความถูกต้อง และขีดจำกัดการใช้งานสำหรับการเรียกใช้ตัวแทนทั่วไป",
        "accountPlanTitle": "แผนบัญชี AI",
        "overviewBody": "ส่วนหัวจะอธิบายว่าข้อมูลการเรียกเก็บเงินใดที่แสดงที่นี่ ใช้หน้านี้เพื่อตรวจสอบการเข้าถึงปัจจุบันและจัดการบริการแบบชำระเงิน",
        "overviewTitle": "ภาพรวมการเรียกเก็บเงิน",
        "paymentsBody": "การชำระเงินและใบแจ้งหนี้ที่เสร็จสมบูรณ์จะปรากฏที่นี่ เพื่อให้คุณสามารถตรวจสอบกิจกรรมการเรียกเก็บเงินล่าสุดได้โดยไม่ต้องออกจากแอปเดสก์ท็อป",
        "paymentsTitle": "บันทึกการชำระเงิน",
        "shopListBody": "แต่ละแถวสรุปบริการแบบชำระเงินที่เปิดใช้งาน สถานะ ข้อมูลการต่ออายุ และการดำเนินการระดับบริการของร้านค้า",
        "shopListTitle": "รายการสมัครสมาชิกร้านค้า",
        "shopServicesBody": "การเรียกเก็บเงินบริการของร้านค้าจะแยกจากการเรียกเก็บเงินของบัญชี AI ร้านค้าที่เชื่อมต่อกันแต่ละแห่งสามารถเข้าถึงบริการเฉพาะได้ เช่น การบริการลูกค้าแบบ AI",
        "shopServicesTitle": "บริการร้านค้า",
        "subscribeFlowBody": "ขั้นตอนนี้ให้คุณเลือกร้านค้าและแผนบริการก่อนชำระเงิน จะปรากฏเฉพาะเมื่อมีร้านค้าที่มีสิทธิ์เข้าถึงบริการเพิ่มเติมเท่านั้น",
        "subscribeFlowTitle": "สมัครสมาชิกร้านค้า",
        "usageBody": "การ์ดการใช้งานและข้อมูลเมตาแสดงโควต้าที่เหลือ ระยะเวลาการต่ออายุ และสถานะการสมัครใช้งาน รายละเอียดเหล่านี้เป็นภาพรวมแบบอ่านอย่างเดียวจากแบ็กเอนด์การเรียกเก็บเงิน",
        "usageTitle": "รายละเอียดการใช้งานและแผน",
        "welcomeBody": "หน้านี้รวบรวมการสมัครสมาชิก AI ของบัญชี การสมัครสมาชิกบริการร้านค้า และบันทึกการชำระเงิน",
        "welcomeTitle": "ยินดีต้อนรับสู่การเรียกเก็บเงิน"
      },
      "ecommerce": {
        "drawerBody": "ลิ้นชักคือที่ที่การกำหนดค่าของแต่ละร้านมีอยู่: ภาพรวม, การบริการลูกค้า AI, สินค้าคงคลัง, การจัดการ Affiliate, การเรียกเก็บเงิน และการเชื่อมโยงอุปกรณ์",
        "drawerTitle": "ลิ้นชักร้าน",
        "shopActionsBody": "Refresh ดึงสถานะร้านค้าล่าสุด Add Shop เริ่มขั้นตอน OAuth ของแพลตฟอร์มสำหรับการเชื่อมต่อบัญชีผู้ขายอื่น",
        "shopActionsTitle": "การดำเนินการของร้านค้า",
        "shopAliasBody": "นามแฝงช่วยให้คุณสามารถเปลี่ยนชื่อร้านค้าในพื้นที่เพื่อให้จดจำได้ง่ายขึ้น กด Enter หรือเบลอช่องเพื่อบันทึก",
        "shopAliasTitle": "ร้านค้านามแฝง",
        "shopRowActionsBody": "เปิดลิ้นชักเพื่อกำหนดค่าบริการ ให้สิทธิ์โทเค็นที่หมดอายุอีกครั้ง หรือยกเลิกการเชื่อมต่อร้านค้า",
        "shopRowActionsTitle": "การกระทำของแถว",
        "shopTableBody": "ตารางแสดงข้อมูลประจำตัวของร้านค้า นามแฝง แพลตฟอร์ม ภูมิภาค สถานะการอนุญาต ยอดคงเหลือ และการดำเนินการของแถว",
        "shopTableTitle": "โต๊ะร้านค้า",
        "shopsBody": "ส่วนร้านค้าจะแสดงรายการบัญชีผู้ขายที่เชื่อมต่อทุกบัญชี และให้จุดเริ่มต้นการดำเนินงานหลักสำหรับร้านค้าแต่ละแห่ง",
        "shopsTitle": "ร้านค้าที่เชื่อมต่อ",
        "welcomeBody": "หน้านี้จัดการร้านค้าที่เชื่อมต่อ การบริการลูกค้า AI ระบบอัตโนมัติของพันธมิตร และการบูรณาการคลังสินค้าสำหรับโมดูลอีคอมเมิร์ซ",
        "welcomeTitle": "ยินดีต้อนรับสู่อีคอมเมิร์ซระดับโลก",
        "wmsActionsBody": "รีเฟรชสถานะสินค้าคงคลัง ตรวจสอบผู้ให้บริการ WMS ที่รองรับ หรือเพิ่มบัญชีคลังสินค้า",
        "wmsActionsTitle": "การดำเนินการคลังสินค้า",
        "wmsBody": "บัญชีคลังสินค้าเชื่อมต่อข้อมูลร้านค้าของคุณกับระบบสินค้าคงคลังและการจัดการคำสั่งซื้อ",
        "wmsTableBody": "ตารางคลังสินค้าแสดงคลังสินค้าที่ซิงค์ จุดสิ้นสุด สกุลเงิน เวลาในการซิงค์ และการดำเนินการการจัดการสินค้าคงคลัง",
        "wmsTableTitle": "ตารางคลังสินค้า",
        "wmsTitle": "บัญชีคลังสินค้า"
      },
      "ecommerceAffiliate": {
        "actionsBody": "อนุมัติใช้ข้อเสนอ ปฏิเสธ ยกเลิกพร้อมกับบันทึกการตัดสินใจ เพื่อให้ระบบอัตโนมัติไม่ดำเนินการดังกล่าว",
        "actionsTitle": "อนุมัติหรือปฏิเสธ",
        "panelBody": "แผงประกอบด้วยผู้สร้างที่รอดำเนินการหรือข้อเสนอการทำงานร่วมกันซึ่งจัดกลุ่มตามร้านค้าและบริบทของผู้สร้าง",
        "panelTitle": "แผงข้อเสนอ",
        "proposalCardBody": "การ์ดแต่ละใบจะอธิบายประเภทการดำเนินการ การใช้เหตุผล รหัสเป้าหมาย และบริบทนโยบายสำหรับการดำเนินงานของบริษัทในเครือที่เสนอ",
        "proposalCardTitle": "การ์ดข้อเสนอ",
        "queueBody": "กลุ่มข้อเสนอจะปรากฏที่นี่ สถานะว่างเปล่าถือเป็นเรื่องปกติ เมื่อไม่มีการดำเนินการของ AI ที่รอการอนุมัติจากมนุษย์",
        "queueTitle": "คิวข้อเสนอ",
        "shopFilterBody": "ใช้ตัวกรองร้านค้าเพื่อเน้นไปที่บัญชีผู้ขายเพียงบัญชีเดียวหรือตรวจสอบข้อเสนอในร้านค้าทั้งหมด",
        "shopFilterTitle": "ตัวกรองร้านค้า",
        "toolbarBody": "แถบเครื่องมือแสดงจำนวนที่รอดำเนินการ ตัวกรองร้านค้า และการดำเนินการรีเฟรชสำหรับการดึงข้อเสนอล่าสุด",
        "toolbarTitle": "แถบเครื่องมือ",
        "welcomeBody": "พื้นที่ทำงานนี้จะตรวจสอบข้อเสนอการดำเนินการของพันธมิตรที่สร้างโดย AI ก่อนที่จะนำไปใช้",
        "welcomeTitle": "ยินดีต้อนรับสู่การจัดการพันธมิตร"
      },
      "ecommerceCustomerService": {
        "conversationDetailBody": "บานหน้าต่างรายละเอียดจะแสดงข้อความ เครื่องมือสรุป การเปิดใช้งาน AI การควบคุมการตอบกลับด้วยตนเอง และข้อมูลเมตาสำหรับการสนทนาที่เลือก",
        "conversationDetailTitle": "รายละเอียดการสนทนา",
        "conversationListBody": "แต่ละแถวสรุปการสนทนาของผู้ซื้อพร้อมร้านค้า การประทับเวลา สถานะ ป้ายการยกระดับ และข้อความแสดงตัวอย่าง",
        "conversationListTitle": "รายการสนทนา",
        "conversationShellBody": "มุมมองแบบแยกจะเก็บคิวไว้ทางด้านซ้ายและรายละเอียดการสนทนาที่เลือกไว้ทางด้านขวา",
        "conversationShellTitle": "พื้นที่ทำงานการสนทนา",
        "escalationQueueBody": "แท็บการยกระดับแสดงรายการกรณีและปัญหาที่เปิดอยู่หรืออยู่ระหว่างดำเนินการซึ่งต้องมีการตรวจสอบ การตอบกลับ หรือการยกเลิก",
        "escalationQueueTitle": "คิวการยกระดับ",
        "filtersBody": "กรองตามร้านค้า สถานะการสนทนา สถานะ AI สถานะการยกระดับ และขนาดหน้าเพื่อเน้นคิว",
        "filtersTitle": "ตัวกรอง",
        "manualReplyBody": "ใช้การตอบกลับด้วยตนเองเมื่อมนุษย์ต้องการตอบกลับโดยตรง ซึ่งทำงานควบคู่ไปกับการควบคุม AI สำหรับการสนทนา",
        "manualReplyTitle": "การตอบกลับด้วยตนเอง",
        "searchBody": "การค้นหาจะจำกัดคิวให้แคบลงตามผู้ซื้อ คำสั่งซื้อ หรือตัวระบุการสนทนา ใช้การค้นหาเพื่อรีเฟรชมุมมองพื้นที่ทำงานปัจจุบัน",
        "searchTitle": "ค้นหา",
        "tabsBody": "สลับระหว่างกล่องจดหมายการสนทนาสดและคิวการยกระดับ การนับช่วยให้คุณเห็นปริมาณงานปัจจุบันได้อย่างรวดเร็ว",
        "tabsTitle": "แท็บพื้นที่ทำงาน",
        "welcomeBody": "พื้นที่ทำงานนี้มีไว้สำหรับติดตามการสนทนาของผู้ซื้อและจัดการการยกระดับ AI ในร้านค้าที่เชื่อมต่อกัน",
        "welcomeTitle": "ยินดีต้อนรับสู่การบริการลูกค้า"
      },
      "settings": {
        "showAgentNameBody": "ควบคุมว่าป้ายกำกับแบรนด์แถบด้านข้างอาจแสดงชื่อตัวแทนปัจจุบันแทนชื่อแอปหรือไม่ เปิดใช้งานเมื่อคุณเรียกใช้เอเจนต์ที่มีชื่อหลายรายการ และต้องการตรวจสอบด้วยภาพอย่างรวดเร็วว่าเอเจนต์ใดที่ใช้งานอยู่",
        "showAgentNameTitle": "ชื่อตัวแทนแถบด้านข้าง"
      }
    }
  }
} as const;
