"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {useAuth} from "@/context/AuthContext";
import {languagePreferenceApi,isSupportedLocale,type LanguagePreference,type SupportedLocale} from "./preferences";

const english:LanguagePreference={
  language:"en", enabled:false, scope:"english-only",
  available_languages:[{code:"en",name:"English"}],
};
function normalize(value:LanguagePreference):LanguagePreference {
  if(!value || typeof value !== "object" || value.enabled!==true ||
     !Array.isArray(value.available_languages)) return english;
  const available=value.available_languages.filter(item=>item &&
    typeof item.name==="string" && isSupportedLocale(item.code));
  if(!available.some(item=>item.code==="en")) return english;
  const language=isSupportedLocale(value.language) &&
    available.some(item=>item.code===value.language) ? value.language : "en";
  return {language,enabled:true,scope:"partial-console",available_languages:available};
}
type LocaleContextValue={
  profile:LanguagePreference;locale:SupportedLocale;ready:boolean;
  changeLanguage:(value:SupportedLocale)=>Promise<LanguagePreference>;
};
const LocaleContext=createContext<LocaleContextValue|null>(null);
export function LocaleProvider({children}:{children:ReactNode}){
  const {user,isLoading}=useAuth();
  const identity=user?.id??null;
  const currentIdentity=useRef<string|null>(identity);
  currentIdentity.current=identity;
  const [profile,setProfile]=useState<LanguagePreference>(english);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let alive=true;
    setProfile(english);setReady(false);
    if(isLoading)return ()=>{alive=false;};
    if(!identity){setReady(true);return ()=>{alive=false;};}
    languagePreferenceApi.get().then(value=>{
      if(alive && currentIdentity.current===identity)setProfile(normalize(value));
    }).catch(()=>{/* Enforce English fallback on API or account errors. */})
      .finally(()=>{if(alive && currentIdentity.current===identity)setReady(true);});
    return ()=>{alive=false;};
  },[identity,isLoading]);
  const changeLanguage=useCallback(async(language:SupportedLocale)=>{
    const id=currentIdentity.current;
    if(!id || !profile.enabled ||
      !profile.available_languages.some(x=>x.code===language))
      throw new Error("Language is not available for this session.");
    const result=normalize(await languagePreferenceApi.save(language));
    if(currentIdentity.current!==id || !result.enabled || result.language!==language)
      throw new Error("Language confirmation failed.");
    setProfile(result);
    return result;
  },[profile]);
  useEffect(()=>{
    document.documentElement.lang=profile.language;
    // Only LTR locales are approved in this batch; Arabic requires separate RTL QA.
    document.documentElement.dir="ltr";
    return ()=>{document.documentElement.lang="en";document.documentElement.dir="ltr";};
  },[profile.language]);
  return <LocaleContext.Provider value={{profile,locale:profile.language,ready,changeLanguage}}>
    {children}
  </LocaleContext.Provider>;
}
export function useLocale(){
  const context=useContext(LocaleContext);
  if(!context)throw new Error("LocaleProvider is missing");
  return context;
}
