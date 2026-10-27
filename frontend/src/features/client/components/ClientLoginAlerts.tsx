"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BellRing} from "lucide-react";
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
    className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-2.5 text-console-primary">
          <BellRing className="h-5 w-5" aria-hidden="true"/></span>
        <div>
          <h2 className="font-semibold text-console-ink">You have {critical.length} account reminder{critical.length===1?"":"s"}</h2>
          <p className="mt-1 text-sm text-console-muted">
            {urgent?urgent+" need urgent attention. ":""}Review your outstanding invoices and domain expirations.
          </p>
        </div>
      </div>
      <Link href="/client/notifications" className="inline-flex min-h-10 items-center rounded-xl bg-console-primary px-4 text-sm font-semibold text-white">
        View reminders
      </Link>
    </div>
  </section>;
}
