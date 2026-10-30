"use client";
import {useState} from "react";
import {Eye,EyeOff,ShieldCheck,WalletCards,UserRound,ReceiptText,PackageCheck} from "lucide-react";
import {ActionLink} from "@/components/design-system/ActionLink";
import type {AdminRecord} from "../data/admin-demo-data";

export type CustomerDetail={
 id:number|string;full_name?:string;email?:string;username?:string;phone_number?:string;
 company_name?:string;address_line1?:string;city?:string;state?:string;country?:string;
 postal_code?:string;tax_id?:string;status?:string;role?:string;
 email_verified?:boolean;phone_verified?:boolean;two_factor_enabled?:boolean;
 date_joined?:string;last_login?:string;wallet_balance?:number|string|null;wallet_currency?:string|null;
 notes?:string|null;
 billing_summary?:{
  invoices?:{total?:number;paid?:number;unpaid?:number;overdue?:number};
  orders?:{total?:number;pending?:number;completed?:number;cancelled?:number};
  services?:{active?:number;suspended?:number;terminated?:number};
 }|null;
};
function value(raw:unknown){return typeof raw==="string"&&raw.trim()?raw:"—";}
function when(raw?:string){if(!raw)return "—";const time=new Date(raw);return Number.isNaN(time.getTime())?"—":new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric"}).format(time);}
function money(raw:unknown,currency="NGN"){
 const amount=typeof raw==="number"?raw:typeof raw==="string"&&raw.trim()?Number(raw):NaN;
 return Number.isFinite(amount)?new Intl.NumberFormat("en-NG",{style:"currency",currency,minimumFractionDigits:2}).format(amount):"—";
}
export function CustomerProfileDetail({data,record,editHref}:{data:CustomerDetail;record:AdminRecord;editHref:string}){
 const [visible,setVisible]=useState(false);
 const fields=[
  ["Email",data.email],["Phone",data.phone_number],["Company",data.company_name],
  ["Address",data.address_line1],["City",data.city],["State",data.state],
  ["Country",data.country],["Postal code",data.postal_code],["Tax identifier",data.tax_id],
  ["Username",data.username],["Joined",when(data.date_joined)],["Last sign-in",when(data.last_login)],
  ["Email verified",data.email_verified?"Yes":"No"],["Phone verified",data.phone_verified?"Yes":"No"],
  ["Two-step authentication",data.two_factor_enabled?"Enabled":"Not enabled"],
 ];
 const financial=data.billing_summary;
 return <div className="min-w-0 space-y-4">
  <section className="rounded-2xl border border-console-line bg-white p-4 shadow-sm sm:p-6" aria-label="Customer identity">
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex min-w-0 items-center gap-3">
     <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary"><UserRound className="h-6 w-6" aria-hidden="true"/></span>
     <div className="min-w-0"><h2 className="break-words text-xl font-medium text-console-ink">{data.full_name?.trim()?data.full_name:record.title}</h2>
      <p className="mt-1 break-all text-sm text-console-muted">{value(data.email)}</p>
      <p className="mt-1 text-xs text-console-muted">Customer #{data.id} · {value(data.status)}</p></div>
    </div>
    <ActionLink href={editHref} className="w-full sm:w-auto">Edit profile</ActionLink>
   </div>
  </section>
  <div className="grid min-w-0 gap-4 lg:grid-cols-3">
   <section className="min-w-0 rounded-2xl border border-console-line bg-white p-4 sm:p-5 lg:col-span-2">
    <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-console-primary" aria-hidden="true"/><h3 className="text-base font-medium text-console-ink">Account and contact details</h3></div>
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
     {fields.map(([label,raw])=><div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-console-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-console-ink">{value(raw)}</dd>
     </div>)}
    </dl>
   </section>
   <div className="min-w-0 space-y-4">
    <section className="rounded-2xl border border-console-line bg-white p-4 sm:p-5">
     <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2 text-xs font-medium text-console-muted"><WalletCards className="h-4 w-4" aria-hidden="true"/> Wallet balance</div>
       <p aria-live="polite" className="mt-3 break-all text-2xl font-medium text-console-ink">{visible?money(data.wallet_balance,data.wallet_currency||"NGN"):"••••••"}</p>
      </div>
      <button type="button" aria-pressed={visible} aria-label={visible?"Hide wallet balance":"Show wallet balance"}
       onClick={()=>setVisible(v=>!v)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-console-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary">
       {visible?<EyeOff className="h-5 w-5" aria-hidden="true"/>:<Eye className="h-5 w-5" aria-hidden="true"/>}</button>
     </div>
     <p className="mt-3 text-xs leading-5 text-console-muted">Ledger-controlled. Profile editors cannot change customer funds.</p>
    </section>
    <section className="rounded-2xl border border-console-line bg-white p-4 sm:p-5">
     <div className="mb-3 flex items-center gap-2"><ReceiptText className="h-4 w-4 text-console-primary" aria-hidden="true"/><h3 className="text-sm font-medium text-console-ink">Invoice summary</h3></div>
     <dl className="space-y-2 text-sm">
      {(["total","paid","unpaid","overdue"] as const).map(k=><div key={k} className="flex justify-between gap-2"><dt className="capitalize text-console-muted">{k}</dt><dd className="font-medium text-console-ink">{financial?.invoices?money(financial.invoices[k]):"—"}</dd></div>)}
     </dl>
    </section>
    <section className="rounded-2xl border border-console-line bg-white p-4 sm:p-5">
     <div className="mb-3 flex items-center gap-2"><PackageCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/><h3 className="text-sm font-medium text-console-ink">Services and orders</h3></div>
     <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-2"><dt className="text-console-muted">Orders</dt><dd className="font-medium">{financial?.orders?.total??"—"}</dd></div>
      <div className="flex justify-between gap-2"><dt className="text-console-muted">Active services</dt><dd className="font-medium">{financial?.services?.active??"—"}</dd></div>
      <div className="flex justify-between gap-2"><dt className="text-console-muted">Suspended services</dt><dd className="font-medium">{financial?.services?.suspended??"—"}</dd></div>
     </dl>
    </section>
   </div>
  </div>
  {data.notes?<section className="rounded-2xl border border-console-line bg-white p-4">
   <h3 className="text-sm font-medium text-console-ink">Internal notes</h3>
   <p className="mt-2 whitespace-pre-wrap break-words text-sm text-console-muted">{data.notes}</p>
  </section>:null}
 </div>;
}
