"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useRef,useState} from "react";
import {ArrowLeft,CalendarClock,Globe2,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {CloudRecordDirectory,type CloudRecord} from "@/components/data/CloudRecordDirectory";
import {ErrorState} from "@/components/feedback/ErrorState";
import {LoadingState} from "@/components/feedback/LoadingState";
import {clientApi,type DomainRenewalStatus,type LiveDomainDNS} from "@/lib/api/endpoints";
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
function validateLiveDns(value:unknown,domainName:string):LiveDomainDNS|null {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const item=value as Partial<LiveDomainDNS>;
  if(item.domain!==domainName||item.read_only!==true||item.execution_enabled!==false||
     !["not_connected","awaiting_customer_approval","awaiting_octalve_approval",
       "revoked","recheck_required","connected"].includes(String(item.state))||!Array.isArray(item.records))return null;
  if(item.state==="connected"){
    if(typeof item.checked_at!=="string"||
       typeof item.record_count!=="number"||item.records.length!==item.record_count||
       !Array.isArray(item.nameservers)||item.nameservers.length<2||
       !item.nameservers.every(ns=>typeof ns==="string"&&ns.length>3)||
       !/^[0-9a-f]{64}$/.test(String(item.snapshot_sha256)))return null;
    for(const rec of item.records){
      if(!rec||typeof rec.id!=="string"||!/^[0-9a-f]{32}$/.test(rec.id)||
         typeof rec.name!=="string"||typeof rec.type!=="string"||
         typeof rec.value!=="string"||typeof rec.ttl!=="number"||
         (rec.proxied!==null&&typeof rec.proxied!=="boolean")||
         (rec.priority!==null&&typeof rec.priority!=="number"))return null;
    }
  }else if(item.records.length!==0)return null;
  return item as LiveDomainDNS;
}
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
  const [liveDns,setLiveDns]=useState<LiveDomainDNS|null>(null);
  const [dnsError,setDnsError]=useState(false);
  const [dnsSaving,setDnsSaving]=useState(false);
  const [confirmRevoke,setConfirmRevoke]=useState(false);
  const [loading,setLoading]=useState(true);
  const serial=useRef(0);
  useAutoSync(async quiet=>{
    const request=++serial.current;
    if(!validId(id)){setDomain(null);setError("Invalid domain reference.");setLoading(false);return;}
    if(!quiet)setLoading(true);
    const needDns=mode==="dns"||mode==="nameservers";
    const [details,renewalResult,dnsResult]=await Promise.allSettled([
      clientApi.domain(id),
      mode==="renewal"?clientApi.domainRenewalStatus(id):Promise.resolve(null),
      needDns?clientApi.domainDnsLive(id):Promise.resolve(null)
    ]);
    if(request!==serial.current)return;
    if(details.status==="fulfilled"){
      try{
        const record=normalizeDomain(details.value);
        if(record.id!==id)throw Error("Mismatched domain.");
        setDomain(record);setError("");
        if(needDns){
          const snapshot=dnsResult.status==="fulfilled"?
            validateLiveDns(dnsResult.value,record.name):null;
          setLiveDns(snapshot);setDnsError(snapshot===null);
        }
      }catch{setDomain(null);setLiveDns(null);setError("We couldn't verify this domain's details.");}
    }else{setDomain(null);setLiveDns(null);setError("This domain is not available in your account.");}
    const next=renewalResult.status==="fulfilled"?validatedRenewal(renewalResult.value,id):null;
    setRenewal(next);setRenewalError(next===null);
    setLoading(false);
  },id+"|"+mode);

  async function changeDns(action:"consent"|"revoke"){
    if(dnsSaving||!domain)return;
    setDnsSaving(true);setDnsError(false);
    try{
      if(action==="consent")await clientApi.domainDnsConsent(id);
      else await clientApi.domainDnsRevoke(id);
      const result=validateLiveDns(await clientApi.domainDnsLive(id),domain.name);
      setLiveDns(result);
      setDnsError(result===null);
      setConfirmRevoke(false);
    }catch{setLiveDns(null);setDnsError(true);}
    finally{setDnsSaving(false);}
  }
  const prefix=`/client/domains/${encodeURIComponent(id)}`;
  const dns:CloudRecord[]=liveDns?.state==="connected"?liveDns.records.map(rec=>({
    id:rec.id,title:rec.name,subtitle:rec.value,
    reference:rec.type,amount:rec.ttl===1?"Auto":rec.ttl+"s",status:"active",
    details:{Type:rec.type,Value:rec.value,TTL:rec.ttl===1?"Auto":rec.ttl+"s",
      Proxy:rec.proxied===true?"Proxied":rec.proxied===false?"DNS only":"Not applicable"},
    category:rec.proxied===true?"Proxied":rec.proxied===false?"DNS only":"Not applicable",
  })):[];
  const nameservers:CloudRecord[]=liveDns?.state==="connected"?
    liveDns.nameservers!.map(ns=>({
      id:ns,title:ns,reference:"Cloudflare zone nameserver",status:"active",
    })):[];
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
        <Link href="/client/domains" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-console-primary">
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
                <div><h2 className="break-all text-lg font-medium text-console-ink">{domain.name}</h2>
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
            {mode==="overview"?<WorkspaceGrid variant="domainFacts" as="dl" className="mt-5">
              {info.map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs text-console-muted">{label}</dt>
                <dd className="mt-2 break-words text-sm font-medium text-console-ink">{value}</dd>
              </div>)}
            </WorkspaceGrid>:null}
          </Panel>
          {mode==="overview"?<WorkspaceGrid variant="domainPanels">
            <Panel><h3 className="text-base font-medium text-console-ink">Domain records</h3>
              <p className="mt-2 text-sm text-console-muted">
                Check your domain's DNS access to see live records from the connected provider.
                Existing stored records are not presented as live provider data.
              </p>
              <ActionLink href={prefix+"/dns"} variant="outline" className="mt-4">View DNS records</ActionLink>
            </Panel>
            <Panel><h3 className="text-base font-medium text-console-ink">Renewal</h3>
              <p className="mt-2 text-sm text-console-muted">Expiry: {displayDomainDate(domain.expiryDate)}</p>
              <ActionLink href={prefix+"/renewal"} variant="outline" className="mt-4">Review renewal options</ActionLink>
            </Panel>
          </WorkspaceGrid>:null}
          {mode==="dns"?<div className="space-y-4">
            <Panel>
              <h3 className="text-base font-medium text-console-ink">Live DNS records</h3>
              <p className="mt-2 text-sm leading-6 text-console-muted">
                DNS details are retrieved directly from your approved provider. This page is
                read-only: no record or nameserver can be changed here.
              </p>
              {dnsError?<p role="alert" className="mt-3 text-sm text-rose-700">
                Live DNS access could not be verified. No stored records are shown as current.
              </p>:null}
              {liveDns?.state==="connected"?<p className="mt-3 text-xs text-console-muted">
                Cloudflare records checked {new Date(liveDns.checked_at!).toLocaleString("en-NG")}.
                {" "}Showing {liveDns.record_count} provider records.
              </p>:null}
              {liveDns?.state==="not_connected"?<p className="mt-3 text-sm text-console-muted">
                DNS access has not been connected for this domain. Contact Octalve Cloud
                to arrange a verified, read-only connection.
              </p>:null}
              {liveDns?.state==="awaiting_customer_approval"?<div className="mt-4 space-y-3">
                <p className="text-sm text-console-ink">
                  Octalve Cloud has prepared read-only DNS access for your domain.
                  Approve access to let your account view its current records.
                </p>
                <button type="button" disabled={dnsSaving}
                  onClick={()=>void changeDns("consent")}
                  className="min-h-11 rounded-xl bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">
                  {dnsSaving?"Confirming…":"Approve read-only DNS access"}
                </button>
              </div>:null}
              {liveDns?.state==="awaiting_octalve_approval"?<p className="mt-3 text-sm text-console-muted">
                Your approval is recorded. Octalve Cloud must complete provider verification
                before your live records can be displayed.
              </p>:null}
              {liveDns?.state==="revoked"?<p className="mt-3 text-sm text-console-muted">
                DNS access was revoked. Contact Octalve Cloud if you want to reconnect.
              </p>:null}
              {liveDns?.state==="recheck_required"?<p className="mt-3 text-sm text-console-muted">
                This DNS connection needs fresh verification. Contact Octalve Cloud to
                reconnect the correct provider account. Your records are not displayed.
              </p>:null}
              {liveDns&&["connected","awaiting_octalve_approval","recheck_required"].includes(liveDns.state)?
              <div className="mt-4">
                {confirmRevoke?<div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-console-ink">Stop sharing DNS access?</span>
                  <button type="button" disabled={dnsSaving}
                    onClick={()=>void changeDns("revoke")}
                    className="min-h-10 rounded-lg border border-rose-400 px-3 text-sm text-rose-700">
                    {dnsSaving?"Stopping…":"Yes, revoke access"}
                  </button>
                  <button type="button" onClick={()=>setConfirmRevoke(false)}
                    className="min-h-10 rounded-lg border border-console-line px-3 text-sm">
                    Cancel
                  </button>
                </div>:<button type="button" onClick={()=>setConfirmRevoke(true)}
                  className="min-h-10 rounded-lg border border-console-line px-3 text-sm text-console-ink">
                  Revoke DNS access
                </button>}
              </div>:null}
            </Panel>
            {liveDns?.state==="connected"&&!dnsError?<CloudRecordDirectory
              label="Live DNS records" records={dns}
              emptyMessage="Cloudflare returned no DNS records for this domain."
              columns={[
                {key:"name",label:"Host",render:r=><span className="break-all font-medium">{r.title}</span>},
                {key:"type",label:"Type",render:r=>r.reference||"—"},
                {key:"value",label:"Value",render:r=><span className="break-all">{r.subtitle||"—"}</span>},
                {key:"ttl",label:"TTL",render:r=>r.amount||"—"},
                {key:"proxy",label:"Proxy",render:r=>r.category||"Not applicable"}
              ]}/>:null}
          </div>:null}
          {mode==="nameservers"?<div className="space-y-4">
            <Panel><h3 className="text-base font-medium text-console-ink">Cloudflare nameservers</h3>
              <p className="mt-2 text-sm text-console-muted">
                Nameservers reported by your approved Cloudflare zone appear here.
                Public registrar delegation has not been independently confirmed.
                Nameserver changes remain disabled.
              </p>
              {dnsError?<p role="alert" className="mt-3 text-sm text-rose-700">
                Current Cloudflare nameservers could not be verified.</p>:null}
              {liveDns&&liveDns.state!=="connected"?<p className="mt-3 text-sm text-console-muted">
                {liveDns.state==="recheck_required"?"Provider access needs fresh verification.":
                  "Connect and approve read-only DNS access to view your provider's nameservers."}
              </p>:null}
            </Panel>
            {liveDns?.state==="connected"&&!dnsError?<CloudRecordDirectory
              label="Cloudflare zone nameservers" records={nameservers}
              emptyMessage="No Cloudflare nameservers could be confirmed."
              columns={[{key:"hostname",label:"Nameserver hostname",render:r=>
                <span className="break-all font-medium">{r.title}</span>}]}/>:null}
          </div>:null}
          {mode==="renewal"?<Panel>
            <h3 className="flex items-center gap-2 text-lg font-medium text-console-ink">
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
            <h3 className="flex items-center gap-2 text-base font-medium text-console-ink">
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
