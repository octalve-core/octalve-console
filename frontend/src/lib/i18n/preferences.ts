import {api} from "@/lib/api/client";

export const localeCodes = ["en", "fr"] as const;
export type SupportedLocale = (typeof localeCodes)[number];
export type LanguagePreference = {
  language: SupportedLocale;
  enabled: boolean;
  scope: "english-only" | "partial-console";
  available_languages: {code: SupportedLocale; name: string}[];
};
export const isSupportedLocale = (code: string): code is SupportedLocale =>
  localeCodes.some(item => item === code);

export const languagePreferenceApi = {
  get: () => api.get<LanguagePreference>("/auth/language/"),
  save: (language: SupportedLocale) =>
    api.patch<LanguagePreference>("/auth/language/", {language}),
};
