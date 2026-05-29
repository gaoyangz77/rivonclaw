import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { LANGUAGE_RESOURCES, SUPPORTED_LANGUAGE_CODES, normalizeLanguageCode } from "./languages.js";

const lng = normalizeLanguageCode(navigator.language);

i18n.use(initReactI18next).init({
  resources: LANGUAGE_RESOURCES,
  lng,
  supportedLngs: SUPPORTED_LANGUAGE_CODES,
  fallbackLng: "en",
  load: "languageOnly",
  interpolation: { escapeValue: false },
});

export default i18n;
