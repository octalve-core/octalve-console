"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { authApi, type AccountProfile, type EditableAccountProfile } from "@/lib/api/endpoints";

const fields: {key:keyof EditableAccountProfile;label:string;auto:string}[] = [
  {key:"full_name",label:"Full name",auto:"name"},
  {key:"phone_number",label:"Telephone number",auto:"tel"},
  {key:"company_name",label:"Company / organisation",auto:"organization"},
  {key:"address",label:"Street address",auto:"street-address"},
  {key:"city",label:"City",auto:"address-level2"},
  {key:"state",label:"State / region",auto:"address-level1"},
  {key:"country",label:"Country",auto:"country-name"},
  {key:"postal_code",label:"Postal code",auto:"postal-code"},
  {key:"tax_id",label:"Tax identification number",auto:"off"},
];
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
    <DashboardPage eyebrow="Account" title="Your account details"
      description="Save your contact and billing information once, ready for future checkout.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]"><UserRound className="h-6 w-6"/></div>
            <div><h2 className="text-lg font-semibold text-slate-950">{profile?.full_name||user?.name||"Your details"}</h2>
              <p className="text-sm text-slate-500">{profile?.email||user?.email||"Email unavailable"}</p></div>
          </div>
          {loading?<p role="status" className="mt-5 text-sm text-slate-500">Preparing your account details…</p>:null}
          {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>:null}
          {message?<p role="status" className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>:null}
          {draft?<form onSubmit={save} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(field=><label key={field.key} className={field.key==="address"?"sm:col-span-2":""}>
                <span className="mb-1 block text-sm font-medium text-slate-700">{field.label}</span>
                <input name={field.key} autoComplete={field.auto} maxLength={field.key==="address"?400:255}
                  value={draft[field.key]} onChange={e=>setDraft(d=>d?{...d,[field.key]:e.target.value}:d)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0064E0]"/>
              </label>)}
            </div>
            <button type="submit" disabled={saving} className="mt-6 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {saving?"Saving…":"Save account details"}
            </button>
          </form>:null}
        </Card>
        <div className="space-y-5">
          <Card>
            <h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-[#0064E0]"/>Account security</h3>
            <p className="mt-3 text-sm text-slate-600">Email status: {profile?.email_verified?"Verified":"Not verified"}</p>
            <button type="button" disabled={!profile||profile.email_verified} onClick={requestVerification}
              className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-[#0064E0] disabled:opacity-50">
              <Mail className="mr-2 inline h-4 w-4"/>{profile?.email_verified?"Email verified":"Send verification link"}
            </button>
            <p className="mt-3 text-xs text-slate-500">Email verification requires our secure delivery service.</p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold">Change password</h3>
            <form onSubmit={changePassword} className="mt-4 space-y-3">
              {([["current","Current password"],["next","New password"],["confirm","Confirm new password"]] as const).map(([key,label])=>
                <label key={key} className="block"><span className="mb-1 block text-sm text-slate-600">{label}</span>
                  <input type="password" required autoComplete={key==="current"?"current-password":"new-password"}
                    value={password[key]} onChange={e=>setPassword(v=>({...v,[key]:e.target.value}))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#0064E0]"/>
                </label>)}
              <button type="submit" className="rounded-xl bg-[#0064E0] px-4 py-2 text-sm font-semibold text-white">Update password</button>
            </form>
            <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-[#0064E0]">Forgot password?</Link>
          </Card>
        </div>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
