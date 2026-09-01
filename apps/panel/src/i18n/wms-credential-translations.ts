interface WmsCredentialTranslationValues {
  apiKey: string;
  apiSecret: string;
  refreshToken: string;
  providerUserId: string;
  authorizationMode: string;
  authorize: string;
  existing: string;
  authorizationUser: string;
  authorizationToken: string;
  authorizationDomain: string;
  authorizationDomainPlaceholder: string;
  keepCredentialPlaceholder: string;
  credentialsWriteOnlyHint: string;
  credentialMissingFields: string;
}

function build(values: WmsCredentialTranslationValues) {
  return {
    ecommerce: {
      inventory: {
        providers: {
          LINGXING: "Lingxing ERP",
          SELLFOX: "Sellfox",
          JFWMS: "JFWMS",
        },
        warehouseProviders: {
          LINGXING: "Lingxing ERP",
          SELLFOX: "Sellfox",
          JFWMS: "JFWMS",
        },
        apiKey: values.apiKey,
        apiSecret: values.apiSecret,
        refreshToken: values.refreshToken,
        providerUserId: values.providerUserId,
        authorizationMode: values.authorizationMode,
        authorizationModes: {
          AUTHORIZE: values.authorize,
          EXISTING: values.existing,
        },
        authorizationUser: values.authorizationUser,
        authorizationToken: values.authorizationToken,
        authorizationDomain: values.authorizationDomain,
        authorizationDomainPlaceholder: values.authorizationDomainPlaceholder,
        keepCredentialPlaceholder: values.keepCredentialPlaceholder,
        credentialsWriteOnlyHint: values.credentialsWriteOnlyHint,
        credentialMissingFields: values.credentialMissingFields,
        credentialFields: {
          apiKey: values.apiKey,
          apiSecret: values.apiSecret,
          apiToken: "API Token",
          refreshToken: values.refreshToken,
          providerUserId: values.providerUserId,
          authorizationUser: values.authorizationUser,
          authorizationToken: values.authorizationToken,
        },
      },
    },
  };
}

export const WMS_CREDENTIAL_TRANSLATIONS = {
  de: build({
    apiKey: "API-Schlussel / Client-ID",
    apiSecret: "API-Geheimnis",
    refreshToken: "Refresh-Token",
    providerUserId: "Anbieter-Benutzer-ID",
    authorizationMode: "Verbindungsmethode",
    authorize: "OMS autorisieren",
    existing: "Vorhandene Autorisierung",
    authorizationUser: "OMS-Konto-E-Mail",
    authorizationToken: "Einmaliges Autorisierungstoken",
    authorizationDomain: "Autorisierungsdomain",
    authorizationDomainPlaceholder:
      "Optional; standardmassig der Hostname des Endpunkts",
    keepCredentialPlaceholder:
      "Leer lassen, um den gespeicherten Wert beizubehalten",
    credentialsWriteOnlyHint:
      "Zugangsdaten werden nur geschrieben und nicht erneut angezeigt.",
    credentialMissingFields:
      "Vervollstandigen Sie diese Zugangsdaten: {{fields}}.",
  }),
  es: build({
    apiKey: "Clave API / ID de cliente",
    apiSecret: "Secreto API",
    refreshToken: "Token de actualizacion",
    providerUserId: "ID de usuario del proveedor",
    authorizationMode: "Metodo de conexion",
    authorize: "Autorizar OMS",
    existing: "Autorizacion existente",
    authorizationUser: "Correo de la cuenta OMS",
    authorizationToken: "Token de autorizacion de un solo uso",
    authorizationDomain: "Dominio de autorizacion",
    authorizationDomainPlaceholder:
      "Opcional; usa el host del endpoint por defecto",
    keepCredentialPlaceholder: "Dejar vacio para conservar el valor guardado",
    credentialsWriteOnlyHint:
      "Las credenciales son de solo escritura y no se volveran a mostrar.",
    credentialMissingFields:
      "Complete estos campos de credenciales: {{fields}}.",
  }),
  fr: build({
    apiKey: "Cle API / ID client",
    apiSecret: "Secret API",
    refreshToken: "Jeton d'actualisation",
    providerUserId: "ID utilisateur du fournisseur",
    authorizationMode: "Mode de connexion",
    authorize: "Autoriser OMS",
    existing: "Autorisation existante",
    authorizationUser: "E-mail du compte OMS",
    authorizationToken: "Jeton d'autorisation a usage unique",
    authorizationDomain: "Domaine d'autorisation",
    authorizationDomainPlaceholder:
      "Facultatif ; utilise par defaut l'hote du point d'acces",
    keepCredentialPlaceholder:
      "Laisser vide pour conserver la valeur enregistree",
    credentialsWriteOnlyHint:
      "Les identifiants sont en ecriture seule et ne seront plus affiches.",
    credentialMissingFields:
      "Completez ces champs d'identification : {{fields}}.",
  }),
  id: build({
    apiKey: "Kunci API / ID Klien",
    apiSecret: "Rahasia API",
    refreshToken: "Token Penyegaran",
    providerUserId: "ID Pengguna Penyedia",
    authorizationMode: "Metode koneksi",
    authorize: "Otorisasi OMS",
    existing: "Otorisasi yang ada",
    authorizationUser: "Email akun OMS",
    authorizationToken: "Token otorisasi sekali pakai",
    authorizationDomain: "Domain otorisasi",
    authorizationDomainPlaceholder: "Opsional; default ke hostname endpoint",
    keepCredentialPlaceholder:
      "Biarkan kosong untuk mempertahankan nilai tersimpan",
    credentialsWriteOnlyHint:
      "Kredensial hanya dapat ditulis dan tidak akan ditampilkan lagi.",
    credentialMissingFields: "Lengkapi bidang kredensial berikut: {{fields}}.",
  }),
  it: build({
    apiKey: "Chiave API / ID client",
    apiSecret: "Segreto API",
    refreshToken: "Token di aggiornamento",
    providerUserId: "ID utente del provider",
    authorizationMode: "Metodo di connessione",
    authorize: "Autorizza OMS",
    existing: "Autorizzazione esistente",
    authorizationUser: "Email account OMS",
    authorizationToken: "Token di autorizzazione monouso",
    authorizationDomain: "Dominio di autorizzazione",
    authorizationDomainPlaceholder:
      "Facoltativo; usa l'host dell'endpoint per impostazione predefinita",
    keepCredentialPlaceholder: "Lascia vuoto per mantenere il valore salvato",
    credentialsWriteOnlyHint:
      "Le credenziali sono di sola scrittura e non verranno mostrate di nuovo.",
    credentialMissingFields:
      "Completa questi campi delle credenziali: {{fields}}.",
  }),
  th: build({
    apiKey: "คีย์ API / รหัสไคลเอนต์",
    apiSecret: "รหัสลับ API",
    refreshToken: "โทเค็นรีเฟรช",
    providerUserId: "รหัสผู้ใช้ของผู้ให้บริการ",
    authorizationMode: "วิธีเชื่อมต่อ",
    authorize: "อนุญาต OMS",
    existing: "สิทธิ์ที่มีอยู่",
    authorizationUser: "อีเมลบัญชี OMS",
    authorizationToken: "โทเค็นอนุญาตแบบใช้ครั้งเดียว",
    authorizationDomain: "โดเมนการอนุญาต",
    authorizationDomainPlaceholder: "ไม่บังคับ ค่าเริ่มต้นคือโฮสต์ของ endpoint",
    keepCredentialPlaceholder: "เว้นว่างเพื่อเก็บค่าที่บันทึกไว้",
    credentialsWriteOnlyHint:
      "ข้อมูลรับรองเป็นแบบเขียนอย่างเดียวและจะไม่แสดงอีก",
    credentialMissingFields: "กรอกข้อมูลรับรองต่อไปนี้ให้ครบ: {{fields}}",
  }),
} as const;
