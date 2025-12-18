/**
 * useLanguage hook - Manages language selection
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLanguage } from "@/i18n";

interface UseLanguageReturn {
  currentLanguage: SupportedLanguage;
  languages: typeof supportedLanguages;
  changeLanguage: (lang: SupportedLanguage) => void;
  t: ReturnType<typeof useTranslation>["t"];
}

export function useLanguage(): UseLanguageReturn {
  const { i18n, t } = useTranslation();

  const changeLanguage = useCallback(
    (lang: SupportedLanguage) => {
      i18n.changeLanguage(lang);
    },
    [i18n]
  );

  return {
    currentLanguage: (i18n.language?.split("-")[0] || "en") as SupportedLanguage,
    languages: supportedLanguages,
    changeLanguage,
    t,
  };
}
