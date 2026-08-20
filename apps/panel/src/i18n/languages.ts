import en from "./en.js";
import zh from "./zh.js";
import de from "./de.js";
import es from "./es.js";
import fr from "./fr.js";
import id from "./id.js";
import it from "./it.js";
import th from "./th.js";
import { LEGACY_I18N_BACKFILL } from "./legacy-backfill.js";
import { RECENT_TRANSLATIONS } from "./recent-translations.js";
import { AFFILIATE_TEAM_TRANSLATIONS } from "./affiliate-team-translations.js";
import { AFFILIATE_CHANNEL_TRANSLATIONS } from "./affiliate-channel-translations.js";
import { AFFILIATE_PROJECTION_TRANSLATIONS } from "./affiliate-projection-translations.js";
import { AFFILIATE_CREATOR_PROFILE_TRANSLATIONS } from "./affiliate-creator-profile-translations.js";
import { AFFILIATE_CAMPAIGN_TRANSLATIONS } from "./affiliate-campaign-translations.js";
import { AFFILIATE_EXPECTED_SALES_TRANSLATIONS } from "./affiliate-expected-sales-translations.js";
import { AFFILIATE_PROPOSAL_TRANSLATIONS } from "./affiliate-proposal-translations.js";
import { AFFILIATE_NO_ACTION_GATE_TRANSLATIONS } from "./affiliate-no-action-gate-translations.js";
import { AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS } from "./affiliate-delivered-message-translations.js";
import { AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS } from "./affiliate-collaboration-operations-translations.js";
import { GOOGLE_AUTH_TRANSLATIONS } from "./google-auth-translations.js";
import { BROWSER_AUTH_TRANSLATIONS } from "./browser-auth-translations.js";
import { CUSTOMER_SERVICE_DEVICE_TRANSLATIONS } from "./customer-service-device-translations.js";
import { PRODUCT_KNOWLEDGE_TRANSLATIONS } from "./product-knowledge-translations.js";
import { AFFILIATE_TUTORIAL_TRANSLATIONS } from "./affiliate-tutorial-translations.js";
import {
  TUTORIAL_CATCHUP_EN,
  TUTORIAL_CATCHUP_ZH,
  TUTORIAL_NEW_KEYS_EN,
} from "./tutorial-catchup-translations.js";

type TranslationResource = object;
export type SupportedLanguageCode = "en" | "zh" | "de" | "es" | "fr" | "id" | "it" | "th";

type TranslationResourceRecord = Record<string, unknown>;

interface LanguageOption {
  code: SupportedLanguageCode;
  label: string;
  resource: TranslationResource;
}

function isRecord(value: unknown): value is TranslationResourceRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeTranslationResource<T extends TranslationResourceRecord>(
  resource: T,
  backfill: TranslationResourceRecord = {},
): T {
  const merged: TranslationResourceRecord = { ...resource };
  for (const [key, value] of Object.entries(backfill)) {
    const existing = merged[key];
    merged[key] = isRecord(existing) && isRecord(value)
      ? mergeTranslationResource(existing, value)
      : value;
  }
  return merged as T;
}

function mergeTranslationResources<T extends TranslationResourceRecord>(
  resource: T,
  ...backfills: TranslationResourceRecord[]
): T {
  return backfills.reduce<TranslationResourceRecord>(
    (merged, backfill) => mergeTranslationResource(merged, backfill),
    resource,
  ) as T;
}

const AFFILIATE_TIMELINE_TRANSLATIONS = {
  de: {
    tools: { selector: { name: { ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "Bewertung unbezahlter Bestellungen abrufen", AFFILIATE_LIST_SHOPS: "Affiliate-Shops auflisten" } } },
    ecommerce: { affiliateWorkspace: { timePassed: "Verstrichene Zeit", timePassedDuration: "{{duration}} vergangen", timePassedDaysHours: "{{days}} T {{hours}} Std.", timePassedDays: "{{days}} T", timePassedHours: "{{hours}} Std.", timePassedHint: "Verstrichene Zeit zwischen Zeitleisteneinträgen; ausgefilterte Ereignisse können dazwischen liegen." } },
  },
  es: {
    tools: { selector: { name: { ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "Obtener evaluación de pedidos impagados", AFFILIATE_LIST_SHOPS: "Listar tiendas de afiliados" } } },
    ecommerce: { affiliateWorkspace: { timePassed: "Tiempo transcurrido", timePassedDuration: "Han pasado {{duration}}", timePassedDaysHours: "{{days}} d {{hours}} h", timePassedDays: "{{days}} d", timePassedHours: "{{hours}} h", timePassedHint: "Tiempo transcurrido entre elementos de la cronología; puede haber eventos filtrados." } },
  },
  fr: {
    tools: { selector: { name: { ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "Obtenir l’évaluation des commandes impayées", AFFILIATE_LIST_SHOPS: "Lister les boutiques Affiliate" } } },
    ecommerce: { affiliateWorkspace: { timePassed: "Temps écoulé", timePassedDuration: "{{duration}} écoulé", timePassedDaysHours: "{{days}} j {{hours}} h", timePassedDays: "{{days}} j", timePassedHours: "{{hours}} h", timePassedHint: "Temps écoulé entre les éléments de la chronologie ; des événements filtrés peuvent exister." } },
  },
  id: {
    tools: { selector: { name: { ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "Dapatkan evaluasi pesanan belum dibayar", AFFILIATE_LIST_SHOPS: "Daftar toko Affiliate" } } },
    ecommerce: { affiliateWorkspace: { timePassed: "Waktu berlalu", timePassedDuration: "{{duration}} berlalu", timePassedDaysHours: "{{days}} h {{hours}} j", timePassedDays: "{{days}} h", timePassedHours: "{{hours}} j", timePassedHint: "Waktu antara item linimasa; peristiwa yang difilter mungkin ada di antaranya." } },
  },
  it: {
    tools: { selector: { name: { ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "Ottieni valutazione ordini non pagati", AFFILIATE_LIST_SHOPS: "Elenca negozi Affiliate" } } },
    ecommerce: { affiliateWorkspace: { timePassed: "Tempo trascorso", timePassedDuration: "Trascorsi {{duration}}", timePassedDaysHours: "{{days}} g {{hours}} h", timePassedDays: "{{days}} g", timePassedHours: "{{hours}} h", timePassedHint: "Tempo trascorso tra gli elementi della cronologia; potrebbero esserci eventi filtrati." } },
  },
  th: {
    tools: { selector: { name: { ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "ดูการประเมินคำสั่งซื้อที่ยังไม่ชำระ", AFFILIATE_LIST_SHOPS: "แสดงร้านค้า Affiliate" } } },
    ecommerce: { affiliateWorkspace: { timePassed: "เวลาที่ผ่านไป", timePassedDuration: "ผ่านไป {{duration}}", timePassedDaysHours: "{{days}} วัน {{hours}} ชม.", timePassedDays: "{{days}} วัน", timePassedHours: "{{hours}} ชม.", timePassedHint: "เวลาระหว่างรายการบนไทม์ไลน์ อาจมีเหตุการณ์ที่ถูกกรองออกอยู่ระหว่างนั้น" } },
  },
} as const;

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "English", resource: mergeTranslationResources(en, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.en, GOOGLE_AUTH_TRANSLATIONS.en, BROWSER_AUTH_TRANSLATIONS.en, AFFILIATE_TEAM_TRANSLATIONS.en, AFFILIATE_CHANNEL_TRANSLATIONS.en, AFFILIATE_PROJECTION_TRANSLATIONS.en, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.en, AFFILIATE_CAMPAIGN_TRANSLATIONS.en, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.en, AFFILIATE_PROPOSAL_TRANSLATIONS.en, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.en, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.en, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.en, PRODUCT_KNOWLEDGE_TRANSLATIONS.en, TUTORIAL_CATCHUP_EN) },
  { code: "zh", label: "中文", resource: mergeTranslationResources(zh, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.zh, GOOGLE_AUTH_TRANSLATIONS.zh, BROWSER_AUTH_TRANSLATIONS.zh, AFFILIATE_TEAM_TRANSLATIONS.zh, AFFILIATE_CHANNEL_TRANSLATIONS.zh, AFFILIATE_PROJECTION_TRANSLATIONS.zh, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.zh, AFFILIATE_CAMPAIGN_TRANSLATIONS.zh, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.zh, AFFILIATE_PROPOSAL_TRANSLATIONS.zh, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.zh, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.zh, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.zh, PRODUCT_KNOWLEDGE_TRANSLATIONS.zh, TUTORIAL_CATCHUP_ZH) },
  { code: "de", label: "Deutsch", resource: mergeTranslationResources(de, LEGACY_I18N_BACKFILL.de, RECENT_TRANSLATIONS.de, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.de, GOOGLE_AUTH_TRANSLATIONS.de, BROWSER_AUTH_TRANSLATIONS.de, AFFILIATE_TIMELINE_TRANSLATIONS.de, AFFILIATE_TEAM_TRANSLATIONS.de, AFFILIATE_CHANNEL_TRANSLATIONS.de, AFFILIATE_PROJECTION_TRANSLATIONS.de, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.de, AFFILIATE_CAMPAIGN_TRANSLATIONS.de, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.de, AFFILIATE_PROPOSAL_TRANSLATIONS.de, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.de, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.de, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.de, PRODUCT_KNOWLEDGE_TRANSLATIONS.de, TUTORIAL_NEW_KEYS_EN, AFFILIATE_TUTORIAL_TRANSLATIONS.de) },
  { code: "es", label: "Español", resource: mergeTranslationResources(es, LEGACY_I18N_BACKFILL.es, RECENT_TRANSLATIONS.es, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.es, GOOGLE_AUTH_TRANSLATIONS.es, BROWSER_AUTH_TRANSLATIONS.es, AFFILIATE_TIMELINE_TRANSLATIONS.es, AFFILIATE_TEAM_TRANSLATIONS.es, AFFILIATE_CHANNEL_TRANSLATIONS.es, AFFILIATE_PROJECTION_TRANSLATIONS.es, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.es, AFFILIATE_CAMPAIGN_TRANSLATIONS.es, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.es, AFFILIATE_PROPOSAL_TRANSLATIONS.es, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.es, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.es, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.es, PRODUCT_KNOWLEDGE_TRANSLATIONS.es, TUTORIAL_NEW_KEYS_EN, AFFILIATE_TUTORIAL_TRANSLATIONS.es) },
  { code: "fr", label: "Français", resource: mergeTranslationResources(fr, LEGACY_I18N_BACKFILL.fr, RECENT_TRANSLATIONS.fr, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.fr, GOOGLE_AUTH_TRANSLATIONS.fr, BROWSER_AUTH_TRANSLATIONS.fr, AFFILIATE_TIMELINE_TRANSLATIONS.fr, AFFILIATE_TEAM_TRANSLATIONS.fr, AFFILIATE_CHANNEL_TRANSLATIONS.fr, AFFILIATE_PROJECTION_TRANSLATIONS.fr, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.fr, AFFILIATE_CAMPAIGN_TRANSLATIONS.fr, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.fr, AFFILIATE_PROPOSAL_TRANSLATIONS.fr, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.fr, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.fr, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.fr, PRODUCT_KNOWLEDGE_TRANSLATIONS.fr, TUTORIAL_NEW_KEYS_EN, AFFILIATE_TUTORIAL_TRANSLATIONS.fr) },
  { code: "id", label: "Bahasa Indonesia", resource: mergeTranslationResources(id, LEGACY_I18N_BACKFILL.id, RECENT_TRANSLATIONS.id, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.id, GOOGLE_AUTH_TRANSLATIONS.id, BROWSER_AUTH_TRANSLATIONS.id, AFFILIATE_TIMELINE_TRANSLATIONS.id, AFFILIATE_TEAM_TRANSLATIONS.id, AFFILIATE_CHANNEL_TRANSLATIONS.id, AFFILIATE_PROJECTION_TRANSLATIONS.id, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.id, AFFILIATE_CAMPAIGN_TRANSLATIONS.id, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.id, AFFILIATE_PROPOSAL_TRANSLATIONS.id, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.id, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.id, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.id, PRODUCT_KNOWLEDGE_TRANSLATIONS.id, TUTORIAL_NEW_KEYS_EN, AFFILIATE_TUTORIAL_TRANSLATIONS.id) },
  { code: "it", label: "Italiano", resource: mergeTranslationResources(it, LEGACY_I18N_BACKFILL.it, RECENT_TRANSLATIONS.it, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.it, GOOGLE_AUTH_TRANSLATIONS.it, BROWSER_AUTH_TRANSLATIONS.it, AFFILIATE_TIMELINE_TRANSLATIONS.it, AFFILIATE_TEAM_TRANSLATIONS.it, AFFILIATE_CHANNEL_TRANSLATIONS.it, AFFILIATE_PROJECTION_TRANSLATIONS.it, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.it, AFFILIATE_CAMPAIGN_TRANSLATIONS.it, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.it, AFFILIATE_PROPOSAL_TRANSLATIONS.it, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.it, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.it, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.it, PRODUCT_KNOWLEDGE_TRANSLATIONS.it, TUTORIAL_NEW_KEYS_EN, AFFILIATE_TUTORIAL_TRANSLATIONS.it) },
  { code: "th", label: "ไทย", resource: mergeTranslationResources(th, LEGACY_I18N_BACKFILL.th, RECENT_TRANSLATIONS.th, CUSTOMER_SERVICE_DEVICE_TRANSLATIONS.th, GOOGLE_AUTH_TRANSLATIONS.th, BROWSER_AUTH_TRANSLATIONS.th, AFFILIATE_TIMELINE_TRANSLATIONS.th, AFFILIATE_TEAM_TRANSLATIONS.th, AFFILIATE_CHANNEL_TRANSLATIONS.th, AFFILIATE_PROJECTION_TRANSLATIONS.th, AFFILIATE_CREATOR_PROFILE_TRANSLATIONS.th, AFFILIATE_CAMPAIGN_TRANSLATIONS.th, AFFILIATE_EXPECTED_SALES_TRANSLATIONS.th, AFFILIATE_PROPOSAL_TRANSLATIONS.th, AFFILIATE_NO_ACTION_GATE_TRANSLATIONS.th, AFFILIATE_DELIVERED_MESSAGE_TRANSLATIONS.th, AFFILIATE_COLLABORATION_OPERATION_TRANSLATIONS.th, PRODUCT_KNOWLEDGE_TRANSLATIONS.th, TUTORIAL_NEW_KEYS_EN, AFFILIATE_TUTORIAL_TRANSLATIONS.th) },
] as const;

export const SUPPORTED_LANGUAGE_CODES: readonly SupportedLanguageCode[] = LANGUAGE_OPTIONS.map((language) => language.code);

export function normalizeLanguageCode(locale: string | undefined | null): SupportedLanguageCode {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGE_CODES.includes(language as SupportedLanguageCode)
    ? language as SupportedLanguageCode
    : "en";
}

export const LANGUAGE_RESOURCES = Object.fromEntries(
  LANGUAGE_OPTIONS.map((language) => [language.code, { translation: language.resource }]),
) as Record<SupportedLanguageCode, { translation: TranslationResource }>;
