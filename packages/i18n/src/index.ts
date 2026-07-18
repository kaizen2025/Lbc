import i18next, { type i18n as I18nInstance } from "i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

export const supportedLanguages = ["fr", "en"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/**
 * Normalise un code de langue détecté vers une langue supportée.
 * IMPORTANT : ne JAMAIS comparer strictement (`lang === "fr"`) — les
 * détecteurs renvoient souvent des variantes régionales ("fr-FR", "en-US").
 */
export function normalizeLanguage(lang: string | undefined | null): SupportedLanguage {
  if (lang && lang.toLowerCase().startsWith("en")) return "en";
  return "fr";
}

/**
 * Initialise une instance i18next partagée (client Expo et serveur).
 * `detected` est le code brut du device / navigateur — il est normalisé ici.
 */
export function createI18n(detected?: string | null): I18nInstance {
  const instance = i18next.createInstance();
  void instance.init({
    resources,
    lng: normalizeLanguage(detected),
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

/** Formatte un montant en centimes vers une devise localisée. */
export function formatCurrency(
  cents: number,
  currency: "EUR" | "USD",
  lang: string = "fr",
): string {
  return new Intl.NumberFormat(normalizeLanguage(lang) === "en" ? "en-US" : "fr-FR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
