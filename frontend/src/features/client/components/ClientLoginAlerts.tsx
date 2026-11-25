"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BellRing,ChevronRight} from "lucide-react";
import {clientApi,type CustomerNoticeInbox} from "@/lib/api/endpoints";
export function ClientLoginAlerts(){
  const [data,setData]=useState<CustomerNoticeInbox|null>(null);
  useEffect(()=>{
    let active=true;
    clientApi.notices().then(reply=>{
      if(active&&Array.isArray(reply.items)&&reply.preferences)
        setData(reply);
    }).catch(()=>{ /* Optional banner must not block the dashboard. */ });
    return ()=>{active=false;};
  },[]);
  if(!data?.preferences.show_login_alerts)return null;
  const critical=data.items.filter(item=>!item.read&&(
    item.kind==="invoice"?data.preferences.invoice_alerts:data.preferences.domain_alerts
  ));
  if(!critical.length)return null;
  const urgent=critical.filter(item=>item.severity==="urgent").length;
  return <section aria-label="Account reminders"
    className={`rounded-2xl border p-4 bg-white shadow-console-surface ${urgent?"border-amber-200":"border-console-line"}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-start gap-3">
        <span className="shrink-0 p-1.5 text-amber-700">
          <BellRing className="h-5 w-5" aria-hidden="true"/></span>
        <div>
          <h2 className="font-medium text-console-ink">You have {critical.length} account reminder{critical.length===1?"":"s"}</h2>
          <p className="mt-1 text-xs leading-5 text-console-muted">
            {urgent===1?"1 needs urgent attention. ":urgent?urgent+" need urgent attention. ":""}Review your outstanding invoices and domain expirations.
          </p>
        </div>
      </div>
      <Link href="/client/notifications" aria-label="View reminders" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl text-sm font-medium text-console-primary hover:bg-blue-50 sm:px-3">
        <span className="hidden sm:inline">View reminders</span><ChevronRight size={18} strokeWidth={1.9} aria-hidden="true"/>
      </Link>
    </div>
  </section>;
}
