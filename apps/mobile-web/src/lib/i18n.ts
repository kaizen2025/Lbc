import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";
import i18next from "i18next";
import { normalizeLanguage, resources } from "@cardtrade/i18n";

const deviceLanguage = getLocales()[0]?.languageCode ?? "fr";

void i18next.use(initReactI18next).init({
  resources,
  // Jamais de comparaison stricte : normalizeLanguage tolère "fr-FR", "en-US"…
  lng: normalizeLanguage(deviceLanguage),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18next;
