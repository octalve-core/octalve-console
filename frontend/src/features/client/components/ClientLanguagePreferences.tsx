"use client";
import {useEffect,useState} from "react";
import {Languages} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";
import type {SupportedLocale} from "@/lib/i18n/preferences";

export function ClientLanguagePreferences(){
  const {profile,locale,ready,changeLanguage}=useLocale();
  const [chosen,setChosen]=useState<SupportedLocale>(locale);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{setChosen(locale);setError("");},[locale]);
  const m=messages(locale);
  async function save(){
    if(!ready||saving||chosen===locale)return;
    setSaving(true);setError("");setNotice("");
    try {
      const result=await changeLanguage(chosen);
      setChosen(result.language);
      setNotice(messages(result.language).languageSaved);
    }catch{setError(m.languageError);}
    finally{setSaving(false);}
  }
  return <Panel>
    <section lang={locale}>
      <Languages className="h-6 w-6 text-console-primary" aria-hidden="true"/>
      <h2 className="mt-4 text-lg font-semibold text-console-ink">{m.languageTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-console-muted">{m.languageDescription}</p>
      {!ready?<p role="status" className="mt-4 text-sm text-console-muted">{m.languageLoading}</p>:null}
      {ready&&profile?<div>
        <label htmlFor="octalve-client-language" className="mt-4 block text-sm font-semibold text-console-ink">{m.currentLanguage}</label>
        <select id="octalve-client-language" value={chosen} disabled={saving||!profile.enabled}
          onChange={event=>{const next=profile.available_languages.find(p=>p.code===event.target.value);if(next){setChosen(next.code);setNotice("");setError("");}}}
          className="mt-2 w-full rounded-lg border border-console-border bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-console-primary">
          {profile.available_languages.map(option=><option key={option.code} value={option.code}>{option.name}</option>)}
        </select>
        {chosen!==locale?<div className="mt-4">
          <ActionButton onClick={()=>void save()} disabled={saving} loading={saving}>{m.saveLanguage}</ActionButton>
        </div>:null}
        <p className="mt-4 text-xs leading-5 text-console-muted">{profile.enabled?m.languagePilot:m.languagePending}</p>
      </div>:null}
      {error?<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>:null}
      {notice?<p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>:null}
    </section>
  </Panel>;
}