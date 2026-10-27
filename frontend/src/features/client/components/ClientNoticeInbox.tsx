"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {Bell,CalendarClock,Check,RefreshCcw} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {clientApi,type CustomerNotice,type CustomerNoticeInbox} from "@/lib/api/endpoints";

function valid(items:unknown):items is CustomerNoticeInbox {
  if(!items||typeof items!=="object"||Array.isArray(items))return false;
  const data=items as Partial<CustomerNoticeInbox>;
  return Array.isArray(data.items)&&typeof data.unread_count==="number"&&
    data.items.every(item=>typeof item.key==="string"&&
      ["invoice","domain"].includes(item.kind)&&
      typeof item.title==="string"&&typeof item.description==="string"&&
      typeof item.read==="boolean"&&
      /^\/client\/(?:invoices\/[1-9][0-9]*|domains\/[1-9][0-9]*\/renewal)$/.test(item.href));
}
function date(value:string){
  const d=new Date(value);
  return Number.isFinite(d.getTime())?
    new Intl.DateTimeFormat("en-NG",{dateStyle:"medium"}).format(d):"Date unavailable";
}

export function ClientNoticeInbox(){
  const [data,setData]=useState<CustomerNoticeInbox|null>(null);
  const [error,setError]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState<string|null>(null);
  const [all,setAll]=useState(true);
  async function load(){
    setLoading(true);setError(false);
    try{
      const result=await clientApi.notices();
      if(!valid(result))throw Error("Invalid notice response");
      setData(result);
    }catch{setError(true);}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function mark(item:CustomerNotice){
    if(working||item.read)return;
    setWorking(item.key);
    try{
      const response=await clientApi.markNoticeRead(item.key);
      if(response.key!==item.key||response.read!==true)throw Error("Mark read failed");
      setData(prev=>prev?{
        ...prev,items:prev.items.map(row=>row.key===item.key?{...row,read:true}:row),
        unread_count:Math.max(0,prev.unread_count-1)
      }:prev);
    }catch{setError(true);}
    finally{setWorking(null);}
  }
  const rows=(data?.items||[]).filter(item=>all||!item.read);
  return <Panel>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-console-ink">
          <Bell className="h-5 w-5 text-console-primary" aria-hidden="true"/>Account notifications</h2>
        <p className="mt-1 text-sm text-console-muted">Due invoices and upcoming domain expirations.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={()=>setAll(v=>!v)}
          className="min-h-10 rounded-xl border border-console-line px-3 text-sm font-medium text-console-ink">
          {all?"Unread only":"All notices"}
        </button>
        <button type="button" onClick={()=>void load()} disabled={loading}
          aria-label="Refresh notifications"
          className="flex min-h-10 items-center gap-2 rounded-xl border border-console-line px-3 text-sm text-console-primary disabled:opacity-50">
          <RefreshCcw className="h-4 w-4" aria-hidden="true"/>Refresh
        </button>
      </div>
    </div>
    {loading?<p role="status" className="mt-5 text-sm text-console-muted">Checking your account notifications…</p>:null}
    {error?<p role="alert" className="mt-4 text-sm text-rose-700">
      Notifications couldn't be refreshed. Your existing account records were not changed.
    </p>:null}
    {!loading&&data?<div className="mt-5 space-y-3">
      <p className="text-sm font-medium text-console-ink">{data.unread_count} unread</p>
      {rows.length===0?<p className="rounded-xl bg-slate-50 p-6 text-sm text-console-muted">
        {all?"No invoices or domains currently need your attention.":"No unread reminders."}
      </p>:rows.map(item=><article key={item.key}
        className="flex flex-col gap-3 rounded-xl border border-console-line bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-console-ink">{item.title}
            {!item.read?<span className="ml-2 inline-block h-2 w-2 rounded-full bg-console-primary" aria-label="Unread"/>:null}
          </p>
          <p className="mt-1 break-words text-sm text-console-muted">{item.description}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-console-muted">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true"/>Relevant date: {date(item.date)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={item.href} className="inline-flex min-h-10 items-center rounded-xl bg-console-primary px-4 text-sm font-semibold text-white">
            {item.kind==="invoice"?"View invoice":"Review domain"}
          </Link>
          {!item.read?<button type="button" onClick={()=>void mark(item)}
            disabled={working!==null} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-console-line bg-white px-3 text-sm text-console-ink disabled:opacity-60">
            <Check className="h-4 w-4" aria-hidden="true"/>Mark read
          </button>:null}
        </div>
      </article>)}
    </div>:null}
    <p className="mt-5 text-xs leading-5 text-console-muted">
      Reminders reflect current account records. An in-app alert does not confirm that
      an external registrar or email provider has delivered a legal notice.
    </p>
  </Panel>;
}
