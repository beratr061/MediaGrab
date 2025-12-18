import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import tr from "./locales/tr.json";
import de from "./locales/de.json";

export const resources = {
  en: { translation: en },
  tr: { translation: tr },
  de: { translation: de },
} as const;

export const supportedLanguages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "de", name: "German", nativeName: "Deutsch" },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS: "translation",
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "mediagrab-language",
    },
  });

export default i18n;
