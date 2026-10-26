"use client";
import { useEffect, useState, type FormEvent } from "react";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import {ClientProfileDetailsForm} from "../components/ClientProfileDetailsForm";
import {ClientProfileSecurity} from "../components/ClientProfileSecurity";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { authApi, type AccountProfile, type EditableAccountProfile } from "@/lib/api/endpoints";

function editableValue(data:AccountProfile):EditableAccountProfile {
  return {full_name:data.full_name||"",phone_number:data.phone_number||"",
    company_name:data.company_name||"",address:data.address||"",city:data.city||"",
    state:data.state||"",country:data.country||"",postal_code:data.postal_code||"",
    tax_id:data.tax_id||""};
}
export function ClientProfileView(){
  const {user,refreshUser}=useAuth();
  const [profile,setProfile]=useState<AccountProfile|null>(null);
  const [draft,setDraft]=useState<EditableAccountProfile|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [password,setPassword]=useState({current:"",next:"",confirm:""});
  useEffect(()=>{
    let active=true;
    authApi.profile().then(data=>{if(active){setProfile(data);setDraft(editableValue(data));}})
      .catch(()=>{if(active)setError("We couldn't load your saved account details. Please reopen this page.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!draft||saving)return;
    setSaving(true);setError("");setMessage("");
    try{
      const saved=await authApi.saveProfile(draft);
      setProfile(saved);setDraft(editableValue(saved));setMessage("Your contact and billing details are saved.");
      await refreshUser();
    }catch{setError("We couldn't save your details. Please check your information and try again.");}
    finally{setSaving(false);}
  }
  async function requestVerification(){
    setMessage("");setError("");
    try{
      const response=await authApi.requestEmailVerification();
      if(response.email_verified){setProfile(data=>data?{...data,email_verified:true}:data);setMessage("Your email is verified.");}
      else setMessage("Verification instructions have been sent to your email.");
    }catch{setError("Email verification is temporarily unavailable. Please try again later.");}
  }
  async function changePassword(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage("");setError("");
    if(password.next!==password.confirm){setError("Your new passwords do not match.");return;}
    try{
      await authApi.changePassword(password.current,password.next);
      setPassword({current:"",next:"",confirm:""});setMessage("Your password has been updated.");
    }catch{setError("Unable to update your password. Check your current password and the password requirements.");}
  }
  return <DashboardShell role="client" title="My account" description="Your contact, billing and account security settings.">
    <div className="space-y-6">
      <SectionHeading eyebrow="Account" title="Your account details"
        description="Save your contact and billing information once, ready for future checkout."/>
      {loading?<Panel><p role="status" className="text-sm text-console-muted">Preparing your account details…</p></Panel>:null}
      {error?<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>:null}
      {message?<p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</p>:null}
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <ClientProfileDetailsForm profile={profile} draft={draft} name={user?.name||""}
            email={user?.email||""} saving={saving}
            onChange={(key,value)=>setDraft(current=>current?{...current,[key]:value}:current)}
            onSubmit={save}/>
        </div>
        <ClientProfileSecurity emailVerified={Boolean(profile?.email_verified)} hasProfile={Boolean(profile)}
          onVerify={()=>{void requestVerification();}} password={password}
          onPasswordChange={(key,value)=>setPassword(current=>({...current,[key]:value}))}
          onPasswordSubmit={changePassword}/>
      </div>
    </div>
  </DashboardShell>;
}
