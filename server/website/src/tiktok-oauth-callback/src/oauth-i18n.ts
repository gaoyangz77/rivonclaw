export enum OAuthLanguage {
  EN = "en",
  ZH = "zh",
  JA = "ja",
  FR = "fr",
  ES = "es",
  PT = "pt",
  RU = "ru",
  AR = "ar",
  DE = "de",
  ID = "id",
  IT = "it",
  TH = "th",
}

export interface OAuthCopy {
  pageTitle: string;
  loadingEyebrow: string;
  loadingTitle: string;
  loadingBody: string;
  successEyebrow: string;
  successTitle: string;
  successBody: string;
  errorEyebrow: string;
  errorTitle: string;
  errorBody: string;
  missingParams: string;
  shop: string;
  platform: string;
  returnHome: string;
  closeTab: string;
}

const STORAGE_KEY = "rivonclaw-lang";
const SUPPORTED_LANGUAGES = Object.values(OAuthLanguage);

const ENGLISH_COPY: OAuthCopy = {
  pageTitle: "TikTok Authorization | RivonClaw",
  loadingEyebrow: "TikTok Shop",
  loadingTitle: "Authorizing shop",
  loadingBody: "We are completing the OAuth callback with RivonClaw Cloud.",
  successEyebrow: "Authorization complete",
  successTitle: "Shop connected",
  successBody: "Your TikTok Shop is authorized. You can return to RivonClaw and continue setup.",
  errorEyebrow: "Authorization failed",
  errorTitle: "We could not connect this shop",
  errorBody: "The authorization callback could not be completed. Please return to RivonClaw and start authorization again.",
  missingParams: "The callback is missing code or state.",
  shop: "Shop",
  platform: "Platform",
  returnHome: "Return home",
  closeTab: "Close this tab",
};

const COPY: Record<OAuthLanguage, OAuthCopy> = {
  [OAuthLanguage.EN]: ENGLISH_COPY,
  [OAuthLanguage.ZH]: {
    ...ENGLISH_COPY,
    pageTitle: "TikTok 店铺授权 | RivonClaw",
    loadingEyebrow: "TikTok Shop",
    loadingTitle: "正在授权店铺",
    loadingBody: "我们正在通过 RivonClaw Cloud 完成店铺授权回调。",
    successEyebrow: "授权完成",
    successTitle: "店铺已连接",
    successBody: "你的 TikTok Shop 已经授权成功。你可以回到 RivonClaw 继续配置。",
    errorEyebrow: "授权失败",
    errorTitle: "无法连接这个店铺",
    errorBody: "本次授权回调未能完成。请返回 RivonClaw 重新发起授权。",
    missingParams: "授权回调缺少 code 或 state。",
    shop: "店铺",
    platform: "平台",
    returnHome: "返回首页",
    closeTab: "关闭此页面",
  },
  [OAuthLanguage.JA]: {
    ...ENGLISH_COPY,
    pageTitle: "TikTok Shop 認可 | RivonClaw",
    loadingTitle: "ショップを認可中",
    loadingBody: "RivonClaw Cloud でショップ認可コールバックを完了しています。",
    successEyebrow: "認可完了",
    successTitle: "ショップが接続されました",
    successBody: "TikTok Shop の認可が完了しました。RivonClaw に戻って設定を続けられます。",
    errorEyebrow: "認可に失敗しました",
    errorTitle: "このショップを接続できませんでした",
    errorBody: "認可コールバックを完了できませんでした。RivonClaw に戻って認可をやり直してください。",
    missingParams: "認可コールバックに code または state がありません。",
    shop: "ショップ",
    platform: "プラットフォーム",
    returnHome: "ホームへ戻る",
    closeTab: "このタブを閉じる",
  },
  [OAuthLanguage.FR]: {
    ...ENGLISH_COPY,
    pageTitle: "Autorisation TikTok Shop | RivonClaw",
    loadingTitle: "Autorisation de la boutique",
    loadingBody: "Nous finalisons le callback d'autorisation avec RivonClaw Cloud.",
    successEyebrow: "Autorisation terminée",
    successTitle: "Boutique connectée",
    successBody: "Votre TikTok Shop est autorisée. Vous pouvez revenir à RivonClaw pour continuer la configuration.",
    errorEyebrow: "Échec de l'autorisation",
    errorTitle: "Impossible de connecter cette boutique",
    errorBody: "Le callback d'autorisation n'a pas pu être finalisé. Revenez à RivonClaw et relancez l'autorisation.",
    missingParams: "Le callback d'autorisation ne contient pas code ou state.",
    shop: "Boutique",
    platform: "Plateforme",
    returnHome: "Retour accueil",
    closeTab: "Fermer cet onglet",
  },
  [OAuthLanguage.ES]: {
    ...ENGLISH_COPY,
    pageTitle: "Autorización de TikTok Shop | RivonClaw",
    loadingTitle: "Autorizando tienda",
    loadingBody: "Estamos completando el callback de autorización con RivonClaw Cloud.",
    successEyebrow: "Autorización completada",
    successTitle: "Tienda conectada",
    successBody: "Tu TikTok Shop está autorizada. Puedes volver a RivonClaw y continuar la configuración.",
    errorEyebrow: "Error de autorización",
    errorTitle: "No pudimos conectar esta tienda",
    errorBody: "No se pudo completar el callback de autorización. Vuelve a RivonClaw e inicia la autorización de nuevo.",
    missingParams: "Al callback de autorización le falta code o state.",
    shop: "Tienda",
    platform: "Plataforma",
    returnHome: "Volver al inicio",
    closeTab: "Cerrar esta pestaña",
  },
  [OAuthLanguage.PT]: {
    ...ENGLISH_COPY,
    pageTitle: "Autorização TikTok Shop | RivonClaw",
    loadingTitle: "Autorizando loja",
    loadingBody: "Estamos concluindo o callback de autorização com a RivonClaw Cloud.",
    successEyebrow: "Autorização concluída",
    successTitle: "Loja conectada",
    successBody: "Sua TikTok Shop foi autorizada. Você pode voltar ao RivonClaw e continuar a configuração.",
    errorEyebrow: "Falha na autorização",
    errorTitle: "Não foi possível conectar esta loja",
    errorBody: "Não foi possível concluir o callback de autorização. Volte ao RivonClaw e inicie a autorização novamente.",
    missingParams: "O callback de autorização está sem code ou state.",
    shop: "Loja",
    platform: "Plataforma",
    returnHome: "Voltar ao início",
    closeTab: "Fechar esta aba",
  },
  [OAuthLanguage.RU]: {
    ...ENGLISH_COPY,
    pageTitle: "Авторизация TikTok Shop | RivonClaw",
    loadingTitle: "Авторизуем магазин",
    loadingBody: "Завершаем callback авторизации через RivonClaw Cloud.",
    successEyebrow: "Авторизация завершена",
    successTitle: "Магазин подключен",
    successBody: "Ваш TikTok Shop авторизован. Можно вернуться в RivonClaw и продолжить настройку.",
    errorEyebrow: "Ошибка авторизации",
    errorTitle: "Не удалось подключить этот магазин",
    errorBody: "Не удалось завершить callback авторизации. Вернитесь в RivonClaw и запустите авторизацию снова.",
    missingParams: "В callback авторизации отсутствует code или state.",
    shop: "Магазин",
    platform: "Платформа",
    returnHome: "На главную",
    closeTab: "Закрыть вкладку",
  },
  [OAuthLanguage.AR]: {
    ...ENGLISH_COPY,
    pageTitle: "تفويض TikTok Shop | RivonClaw",
    loadingTitle: "جار تفويض المتجر",
    loadingBody: "نكمل رد التفويض عبر RivonClaw Cloud.",
    successEyebrow: "اكتمل التفويض",
    successTitle: "تم ربط المتجر",
    successBody: "تم تفويض TikTok Shop الخاص بك. يمكنك العودة إلى RivonClaw ومتابعة الإعداد.",
    errorEyebrow: "فشل التفويض",
    errorTitle: "تعذر ربط هذا المتجر",
    errorBody: "تعذر إكمال رد التفويض. ارجع إلى RivonClaw وابدأ التفويض مرة أخرى.",
    missingParams: "ينقص رد التفويض code أو state.",
    shop: "المتجر",
    platform: "المنصة",
    returnHome: "العودة للرئيسية",
    closeTab: "إغلاق هذه الصفحة",
  },
  [OAuthLanguage.DE]: {
    ...ENGLISH_COPY,
    pageTitle: "TikTok Shop-Autorisierung | RivonClaw",
    loadingTitle: "Shop wird autorisiert",
    loadingBody: "Wir schließen den Autorisierungs-Callback mit RivonClaw Cloud ab.",
    successEyebrow: "Autorisierung abgeschlossen",
    successTitle: "Shop verbunden",
    successBody: "Ihr TikTok Shop wurde autorisiert. Sie können zu RivonClaw zurückkehren und die Einrichtung fortsetzen.",
    errorEyebrow: "Autorisierung fehlgeschlagen",
    errorTitle: "Dieser Shop konnte nicht verbunden werden",
    errorBody: "Der Autorisierungs-Callback konnte nicht abgeschlossen werden. Kehren Sie zu RivonClaw zurück und starten Sie die Autorisierung erneut.",
    missingParams: "Im Autorisierungs-Callback fehlt code oder state.",
    shop: "Shop",
    platform: "Plattform",
    returnHome: "Zur Startseite",
    closeTab: "Diese Seite schließen",
  },
  [OAuthLanguage.ID]: {
    ...ENGLISH_COPY,
    pageTitle: "Otorisasi TikTok Shop | RivonClaw",
    loadingTitle: "Mengotorisasi toko",
    loadingBody: "Kami sedang menyelesaikan callback otorisasi dengan RivonClaw Cloud.",
    successEyebrow: "Otorisasi selesai",
    successTitle: "Toko terhubung",
    successBody: "TikTok Shop Anda sudah diotorisasi. Anda dapat kembali ke RivonClaw dan melanjutkan konfigurasi.",
    errorEyebrow: "Otorisasi gagal",
    errorTitle: "Kami tidak dapat menghubungkan toko ini",
    errorBody: "Callback otorisasi tidak dapat diselesaikan. Kembali ke RivonClaw dan mulai otorisasi lagi.",
    missingParams: "Callback otorisasi tidak memiliki code atau state.",
    shop: "Toko",
    platform: "Platform",
    returnHome: "Kembali ke beranda",
    closeTab: "Tutup halaman ini",
  },
  [OAuthLanguage.IT]: {
    ...ENGLISH_COPY,
    pageTitle: "Autorizzazione TikTok Shop | RivonClaw",
    loadingTitle: "Autorizzazione dello shop",
    loadingBody: "Stiamo completando il callback di autorizzazione con RivonClaw Cloud.",
    successEyebrow: "Autorizzazione completata",
    successTitle: "Shop collegato",
    successBody: "Il tuo TikTok Shop è autorizzato. Puoi tornare a RivonClaw e continuare la configurazione.",
    errorEyebrow: "Autorizzazione non riuscita",
    errorTitle: "Non siamo riusciti a collegare questo shop",
    errorBody: "Non è stato possibile completare il callback di autorizzazione. Torna a RivonClaw e avvia di nuovo l'autorizzazione.",
    missingParams: "Nel callback di autorizzazione manca code o state.",
    shop: "Shop",
    platform: "Piattaforma",
    returnHome: "Torna alla home",
    closeTab: "Chiudi questa pagina",
  },
  [OAuthLanguage.TH]: {
    ...ENGLISH_COPY,
    pageTitle: "การอนุญาต TikTok Shop | RivonClaw",
    loadingTitle: "กำลังอนุญาตร้านค้า",
    loadingBody: "เรากำลังดำเนินการ callback การอนุญาตผ่าน RivonClaw Cloud",
    successEyebrow: "อนุญาตสำเร็จ",
    successTitle: "เชื่อมต่อร้านค้าแล้ว",
    successBody: "TikTok Shop ของคุณได้รับอนุญาตแล้ว คุณสามารถกลับไปที่ RivonClaw เพื่อกำหนดค่าต่อได้",
    errorEyebrow: "การอนุญาตล้มเหลว",
    errorTitle: "ไม่สามารถเชื่อมต่อร้านค้านี้ได้",
    errorBody: "ไม่สามารถดำเนินการ callback การอนุญาตให้เสร็จสิ้นได้ โปรดกลับไปที่ RivonClaw แล้วเริ่มการอนุญาตอีกครั้ง",
    missingParams: "callback การอนุญาตขาด code หรือ state",
    shop: "ร้านค้า",
    platform: "แพลตฟอร์ม",
    returnHome: "กลับหน้าแรก",
    closeTab: "ปิดหน้านี้",
  },
};

function parseLanguage(value: string | null | undefined): OAuthLanguage | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace("_", "-").split("-")[0];
  return SUPPORTED_LANGUAGES.includes(normalized as OAuthLanguage)
    ? normalized as OAuthLanguage
    : null;
}

function readSavedLanguage(): OAuthLanguage | null {
  try {
    return parseLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function detectOAuthLanguage(): OAuthLanguage {
  const params = new URLSearchParams(window.location.search);
  return (
    parseLanguage(params.get("lang")) ??
    parseLanguage(params.get("locale")) ??
    readSavedLanguage() ??
    parseLanguage(window.navigator.language) ??
    OAuthLanguage.EN
  );
}

export function getOAuthCopy(language: OAuthLanguage): OAuthCopy {
  return COPY[language] ?? ENGLISH_COPY;
}

export function applyOAuthDocumentLanguage(language: OAuthLanguage): void {
  document.documentElement.lang = language;
  document.documentElement.dir = language === OAuthLanguage.AR ? "rtl" : "ltr";
  document.title = getOAuthCopy(language).pageTitle;
}
