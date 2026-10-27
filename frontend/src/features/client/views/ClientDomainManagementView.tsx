"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useRef,useState} from "react";
import {ArrowLeft,CalendarClock,Globe2,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {CloudRecordDirectory,type CloudRecord} from "@/components/data/CloudRecordDirectory";
import {ErrorState} from "@/components/feedback/ErrorState";
import {LoadingState} from "@/components/feedback/LoadingState";
import {clientApi,type DomainRenewalStatus} from "@/lib/api/endpoints";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {normalizeDomain,displayDomainDate,type ClientDomainSnapshot} from "../utils/domain-contract";

export type DomainManagementMode="overview"|"dns"|"nameservers"|"renewal";
const validId=(v:string)=>/^[1-9][0-9]{0,11}$/.test(v);
const modes=[
  {mode:"overview",label:"Overview"},
  {mode:"dns",label:"DNS records"},
  {mode:"nameservers",label:"Nameservers"},
  {mode:"renewal",label:"Renewal"},
] as const;
function validatedRenewal(value:unknown,id:string):DomainRenewalStatus|null {
  if(value===null||typeof value!=="object"||Array.isArray(value))return null;
  const state=value as Partial<DomainRenewalStatus>;
  if(String(state.domain_id)!==id||
    !["invoice_ready","request_assistance","unavailable"].includes(String(state.state)))return null;
  if(state.state==="invoice_ready"&&
    (typeof state.invoice_id!=="number"||!Number.isSafeInteger(state.invoice_id)||state.invoice_id<1))return null;
  return state as DomainRenewalStatus;
}
export function ClientDomainManagementView({mode}: {mode:DomainManagementMode}){
  const params=useParams<{id:string}>();
  const id=String(params.id||"");
  const [domain,setDomain]=useState<ClientDomainSnapshot|null>(null);
  const [renewal,setRenewal]=useState<DomainRenewalStatus|null>(null);
  const [renewalError,setRenewalError]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const serial=useRef(0);
  useAutoSync(async quiet=>{
    const request=++serial.current;
    if(!validId(id)){setDomain(null);setError("Invalid domain reference.");setLoading(false);return;}
    if(!quiet)setLoading(true);
    const [details,renewalResult]=await Promise.allSettled([
      clientApi.domain(id),clientApi.domainRenewalStatus(id)
    ]);
    if(request!==serial.current)return;
    if(details.status==="fulfilled"){
      try{
        const record=normalizeDomain(details.value);
        if(record.id!==id)throw Error("Mismatched domain.");
        setDomain(record);setError("");
      }catch{setDomain(null);setError("We couldn't verify this domain's details.");}
    }else{setDomain(null);setError("This domain is not available in your account.");}
    const next=renewalResult.status==="fulfilled"?validatedRenewal(renewalResult.value,id):null;
    setRenewal(next);setRenewalError(next===null);
    setLoading(false);
  },id);

  const prefix=`/client/domains/${encodeURIComponent(id)}`;
  const dns:CloudRecord[]=domain?.dnsRecords.map(rec=>({
    id:rec.id,title:rec.name,subtitle:rec.value,
    reference:rec.type,amount:rec.ttl+"s",status:"active",
    details:{Type:rec.type,Value:rec.value,TTL:rec.ttl+"s"},
  }))||[];
  const nameservers:CloudRecord[]=domain?.nameservers.map(rec=>({
    id:rec.id,title:rec.hostname,reference:"Nameserver",status:"active",
  }))||[];
  const info=[
    ["Registration date",displayDomainDate(domain?.registrationDate||null)],
    ["Expiry date",displayDomainDate(domain?.expiryDate||null)],
    ["Next due",displayDomainDate(domain?.nextDueDate||null)],
    ["Registrar",domain?.registrar||"Not confirmed"],
    ["Auto-renew preference",domain?.autoRenew?"On":"Off"],
    ["DNSSEC",domain?.dnssecEnabled?"Enabled":"Not enabled"],
  ];
  return <DashboardShell role="client" title={domain?.name||"Domain management"}
    description="Manage your domains, renewals and DNS records from your account.">
    <DashboardPage eyebrow="My Domains" title={domain?.name||"Domain management"}
      description="Only account-authorized domain records are displayed.">
      <div className="space-y-5">
        <Link href="/client/domains" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-console-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true"/>Back to My Domains
        </Link>
        {loading&&!domain?<LoadingState title="Opening domain" description="Checking your account records."/>:null}
        {error&&!domain&&!loading?<ErrorState title="Domain unavailable" description={error}
          action={<ActionLink href="/client/domains" variant="outline" size="sm">My Domains</ActionLink>}/>:null}
        {domain?<div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-blue-50 p-3 text-console-primary">
                  <Globe2 className="h-6 w-6" aria-hidden="true"/></span>
                <div><h2 className="break-all text-lg font-semibold text-console-ink">{domain.name}</h2>
                  <p className="text-sm text-console-muted">Registration and ownership details</p></div>
              </div>
              <StatusBadge>{domain.status.replaceAll("_"," ")}</StatusBadge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Domain sections">
              {modes.map(item=><Link key={item.mode} href={item.mode==="overview"?prefix:prefix+"/"+item.mode}
                aria-current={mode===item.mode?"page":undefined}
                className={`inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-medium
                  ${mode===item.mode?"bg-console-primary text-white":"bg-slate-100 text-console-ink hover:bg-slate-200"}`}>
                {item.label}</Link>)}
            </div>
            {mode==="overview"?<dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {info.map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs text-console-muted">{label}</dt>
                <dd className="mt-2 break-words text-sm font-semibold text-console-ink">{value}</dd>
              </div>)}
            </dl>:null}
          </Panel>
          {mode==="overview"?<div className="grid gap-5 lg:grid-cols-2">
            <Panel><h3 className="text-base font-semibold text-console-ink">Domain records</h3>
              <p className="mt-2 text-sm text-console-muted">
                {domain.dnsRecords.length} stored DNS records · {domain.nameservers.length} stored nameservers.
                Provider changes require confirmation before they appear.
              </p>
              <ActionLink href={prefix+"/dns"} variant="outline" className="mt-4">Manage DNS records</ActionLink>
            </Panel>
            <Panel><h3 className="text-base font-semibold text-console-ink">Renewal</h3>
              <p className="mt-2 text-sm text-console-muted">Expiry: {displayDomainDate(domain.expiryDate)}</p>
              <ActionLink href={prefix+"/renewal"} variant="outline" className="mt-4">Review renewal options</ActionLink>
            </Panel>
          </div>:null}
          {mode==="dns"?<div className="space-y-4">
            <Panel><h3 className="text-base font-semibold text-console-ink">DNS records</h3>
              <p className="mt-2 text-sm leading-6 text-console-muted">
                These are stored records, not a live DNS resolution test. Creating, editing or deleting records
                becomes available after a verified DNS provider is connected to this domain.
              </p></Panel>
            <CloudRecordDirectory label="DNS records" records={dns}
              emptyMessage="No DNS records are available for this domain."
              columns={[
                {key:"name",label:"Host",render:r=><span className="break-all font-semibold">{r.title}</span>},
                {key:"type",label:"Type",render:r=>r.reference||"—"},
                {key:"value",label:"Value",render:r=><span className="break-all">{r.subtitle||"—"}</span>},
                {key:"ttl",label:"TTL",render:r=>r.amount||"—"}
              ]}/>
          </div>:null}
          {mode==="nameservers"?<div className="space-y-4">
            <Panel><h3 className="text-base font-semibold text-console-ink">Nameservers</h3>
              <p className="mt-2 text-sm text-console-muted">
                Nameserver changes require a verified registrar and authoritative provider readback.
              </p></Panel>
            <CloudRecordDirectory label="Nameservers" records={nameservers}
              emptyMessage="No verified nameservers are recorded for this domain."
              columns={[{key:"hostname",label:"Nameserver hostname",render:r=>
                <span className="break-all font-semibold">{r.title}</span>}]}/>
          </div>:null}
          {mode==="renewal"?<Panel>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-console-ink">
              <CalendarClock className="h-5 w-5 text-console-primary" aria-hidden="true"/>Renew your domain</h3>
            <p className="mt-3 text-sm text-console-muted">
              Registered: {displayDomainDate(domain.registrationDate)} · Expires: {displayDomainDate(domain.expiryDate)}
            </p>
            <p className="mt-2 text-sm text-console-muted">
              Auto-renew preference: {domain.autoRenew?"Enabled":"Disabled"}.
              Automatic supplier renewal is subject to verified billing and registrar confirmation.
            </p>
            {renewal?.state==="invoice_ready"&&renewal.invoice_id?
              <ActionLink href={`/client/invoices/${renewal.invoice_id}`} className="mt-5">
                Review existing renewal invoice
              </ActionLink>:
            renewal?.state==="request_assistance"?
              <><p className="mt-4 text-sm text-console-muted">
                No verified unpaid domain-renewal invoice is available. Renewal assistance can be requested.
              </p><ActionLink href="/client/support/new" variant="outline" className="mt-4">
                Request renewal assistance</ActionLink></>:
              <p className="mt-4 text-sm text-console-muted">
                {renewalError?"Renewal information couldn't be verified.":"Renewal is unavailable for this domain."}
              </p>}
            <p className="mt-4 text-xs text-console-muted">
              Opening this page never creates an invoice or extends the domain registration.
            </p>
          </Panel>:null}
          <Panel>
            <h3 className="flex items-center gap-2 text-base font-semibold text-console-ink">
              <ShieldCheck className="h-5 w-5 text-console-primary" aria-hidden="true"/>
              Need help managing this domain?
            </h3>
            <p className="mt-2 text-sm text-console-muted">
              Our team can help with setup and transfers while verified registrar connections are prepared.
            </p>
            <ActionLink href="/client/support/new" variant="outline" className="mt-4">Contact support</ActionLink>
          </Panel>
        </div>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
