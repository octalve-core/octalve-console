"use client";
import {useEffect,useState} from "react";
import {Bell} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {clientApi,type CustomerNoticePreferences} from "@/lib/api/endpoints";
const choices=[
  {key:"show_login_alerts",title:"Dashboard reminders",
   note:"Show unread reminders when you open your dashboard."},
  {key:"invoice_alerts",title:"Invoice alerts on dashboard",
   note:"Include overdue and upcoming invoices in dashboard reminders."},
  {key:"domain_alerts",title:"Domain alerts on dashboard",
   note:"Include upcoming and recently expired domains in dashboard reminders."},
] as const;
export function ClientNoticePreferences(){
  const [saved,setSaved]=useState<CustomerNoticePreferences|null>(null);
  const [draft,setDraft]=useState<CustomerNoticePreferences|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let active=true;
    clientApi.noticePreferences().then(p=>{
      if(active){setSaved(p);setDraft(p);}
    }).catch(()=>{if(active)setError("Could not load notification preferences.");});
    return ()=>{active=false;};
  },[]);
  async function save(){
    if(!draft||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const result=await clientApi.updateNoticePreferences(draft);
      setSaved(result);setDraft(result);setMessage("Notification preferences saved.");
    }catch{setError("Preferences couldn't be saved. Please try again.");}
    finally{setBusy(false);}
  }
  return <Panel>
    <h2 className="flex items-center gap-2 text-lg font-medium text-console-ink">
      <Bell className="h-5 w-5 text-console-primary" aria-hidden="true"/>Notifications</h2>
    <p className="mt-2 text-sm text-console-muted">
      Choose which reminders appear on your dashboard. The Notifications inbox
      always retains relevant account records, regardless of these display preferences.
    </p>
    {!draft?<p role="status" className="mt-4 text-sm text-console-muted">Loading preferences…</p>:<div className="mt-5 space-y-4">
      {choices.map(item=><label key={item.key} className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={draft[item.key]}
          onChange={e=>setDraft(current=>current?{...current,[item.key]:e.target.checked}:current)}
          className="mt-1 h-4 w-4 accent-blue-600"/>
        <span><span className="block text-sm font-medium text-console-ink">{item.title}</span>
          <span className="mt-1 block text-xs leading-5 text-console-muted">{item.note}</span></span>
      </label>)}
      <ActionButton onClick={()=>void save()} disabled={busy||JSON.stringify(draft)===JSON.stringify(saved)}
        loading={busy}>Save preferences</ActionButton>
    </div>}
    {error?<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>:null}
    {message?<p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>:null}
    <p className="mt-4 text-xs text-console-muted">
      Email reminders are not activated yet. Legal registrar notices are managed separately.
    </p>
  </Panel>;
}
