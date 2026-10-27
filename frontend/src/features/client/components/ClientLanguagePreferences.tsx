"use client";

import {useEffect, useState} from "react";
import {Languages} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {
  languagePreferenceApi, isSupportedLocale,
  type LanguagePreference, type SupportedLocale,
} from "@/lib/i18n/preferences";

const copy = {
  en: {
    title: "Language", description: "Choose the language you prefer for your account.",
    current: "Current preference:", save: "Save language", saved: "Language preference saved.",
    failed: "Language preference could not be saved. Please try again.",
    loadFailed: "Language settings are unavailable. Please try again later.",
    pending: "English is the currently supported Console language. Other languages will be available after review.",
    pilot: "Translation pilot: only this Settings panel is translated. Other Console pages, invoices and legal text remain in English.",
  },
  fr: {
    title: "Langue", description: "Choisissez la langue de préférence de votre compte.",
    current: "Langue choisie :", save: "Enregistrer la langue",
    saved: "Votre préférence linguistique a été enregistrée.",
    failed: "Impossible d’enregistrer la langue. Veuillez réessayer.",
    loadFailed: "Les paramètres linguistiques sont indisponibles.",
    pending: "L’anglais est actuellement la seule langue disponible.",
    pilot: "Version pilote : seul ce panneau des paramètres est traduit. Les autres pages, les factures et les textes juridiques restent en anglais.",
  },
} as const;

export function ClientLanguagePreferences() {
  const [profile, setProfile] = useState<LanguagePreference | null>(null);
  const [chosen, setChosen] = useState<SupportedLocale>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    languagePreferenceApi.get().then(value => {
      if (!alive) return;
      const options = value.available_languages.filter(item => isSupportedLocale(item.code));
      const language = isSupportedLocale(value.language) && options.some(x => x.code === value.language)
        ? value.language : "en";
      setProfile({...value, language, available_languages: options});
      setChosen(language);
    }).catch(() => { if (alive) setError(copy.en.loadFailed); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const strings = copy[profile?.enabled ? chosen : "en"];
  async function save() {
    if (!profile || saving || chosen === profile.language) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await languagePreferenceApi.save(chosen);
      if (!isSupportedLocale(result.language)) throw new Error("Unrecognized locale response");
      setProfile(result);
      setChosen(result.language);
      setNotice(copy[result.language].saved);
    } catch {
      setError(strings.failed);
    } finally {
      setSaving(false);
    }
  }
  return <Panel>
    <section lang={profile?.enabled ? chosen : "en"}>
      <Languages className="h-6 w-6 text-console-primary" aria-hidden="true"/>
      <h2 className="mt-4 text-lg font-semibold text-console-ink">{strings.title}</h2>
      <p className="mt-2 text-sm leading-6 text-console-muted">{strings.description}</p>
      {loading ? <p role="status" className="mt-4 text-sm text-console-muted">Loading language preference…</p> : null}
      {!loading && profile ? <>
        <label htmlFor="octalve-client-language" className="mt-4 block text-sm font-semibold text-console-ink">
          {strings.current}
        </label>
        <select id="octalve-client-language" value={chosen} disabled={saving}
          onChange={event => { if (isSupportedLocale(event.target.value)) {
            setChosen(event.target.value); setNotice(""); setError("");
          }}}
          className="mt-2 w-full rounded-lg border border-console-border bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-console-primary">
          {profile.available_languages.map(option =>
            <option key={option.code} value={option.code}>{option.name}</option>)}
        </select>
        {chosen !== profile.language ? <div className="mt-4">
          <ActionButton onClick={() => void save()} disabled={saving} loading={saving}>{strings.save}</ActionButton>
        </div> : null}
        <p className="mt-4 text-xs leading-5 text-console-muted">{profile.enabled ? strings.pilot : strings.pending}</p>
      </> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
    </section>
  </Panel>;
}
