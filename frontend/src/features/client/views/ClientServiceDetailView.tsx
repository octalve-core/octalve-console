"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useRef,useState} from "react";
import {ArrowLeft,CalendarClock,CloudCog,ShieldCheck,Server} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {LoadingState} from "@/components/feedback/LoadingState";
import {ErrorState} from "@/components/feedback/ErrorState";
import {clientApi,type ServiceRenewalStatus} from "@/lib/api/endpoints";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {normalizeServiceSnapshot,serviceDate,type ClientServiceSnapshot} from "../utils/service-contract";
import {ServiceUsageRing} from "../components/ServiceUsageRing";

const validId=(s:string)=>/^[1-9][0-9]{0,11}$/.test(s);
function readRenewal(value:unknown,id:string):ServiceRenewalStatus|null {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const item=value as Partial<ServiceRenewalStatus>;
  if(String(item.service_id)!==id
    ||!["invoice_ready","request_assistance","unavailable"].includes(String(item.state)))return null;
  if(item.state==="invoice_ready"&&
     (typeof item.invoice_id!=="number"||!Number.isSafeInteger(item.invoice_id)||item.invoice_id<1))return null;
  return item as ServiceRenewalStatus;
}
export function ClientServiceDetailView(){
  const params=useParams<{id:string}>();
  const id=String(params.id||"");
  const [data,setData]=useState<ClientServiceSnapshot|null>(null);
  const [renewal,setRenewal]=useState<ServiceRenewalStatus|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [renewalError,setRenewalError]=useState(false);
  const requestId=useRef(0);
  useAutoSync(async quiet=>{
    const current=++requestId.current;
    if(!validId(id)){setError("This service reference is invalid.");setData(null);setLoading(false);return;}
    if(!quiet)setLoading(true);
    const [serviceResult,renewalResult]=await Promise.allSettled([
      clientApi.service(id),clientApi.serviceRenewalStatus(id)
    ]);
    if(current!==requestId.current)return;
    if(serviceResult.status==="fulfilled"){
      try{
        const exact=normalizeServiceSnapshot(serviceResult.value);
        if(exact.id!==id)throw new Error("Mismatched service response.");
        setData(exact);setError("");
      }catch{setData(null);setError("We couldn't verify this service. Please try again.");}
    }else{setData(null);setError("We couldn't open this service from your account.");}
    const parsed=renewalResult.status==="fulfilled"?readRenewal(renewalResult.value,id):null;
    setRenewal(parsed);setRenewalError(parsed===null);
    setLoading(false);
  },id);
  const hosting=data?.serviceType==="hosting";
  const usage=data?.usage;
  const info=[
    ["Connected domain",data?.domain||"Not connected"],
    ["Plan",data?.planName||"Plan information unavailable"],
    ["Billing cycle",data?.billingCycle||"—"],
    ["Next due date",serviceDate(data?.nextDueDate||null)],
    ["Auto-renew",data?.autoRenew?"Enabled":"Disabled"],
    ["Service type",data?.serviceType.replaceAll("_"," ")||"—"],
  ];
  return <DashboardShell role="client" title={data?.label||"Service details"}
    description="Review your service, usage, renewals and management access.">
    <DashboardPage eyebrow="My services" title={data?.label||"Service details"}
      description="Verified information from your Octalve Cloud account.">
      <div className="space-y-5">
        <Link href="/client/services" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-console-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true"/>Back to My Services
        </Link>
        {loading&&!data?<LoadingState title="Opening your service" description="Checking your account details."/>:null}
        {error&&!data&&!loading?<ErrorState title="Service unavailable" description={error}
          action={<ActionLink href="/client/services" variant="outline" size="sm">My Services</ActionLink>}/>:null}
        {data?<div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-blue-50 p-3 text-console-primary"><Server className="h-6 w-6" aria-hidden="true"/></span>
                <div><h2 className="text-lg font-semibold text-console-ink">{data.label}</h2>
                <p className="break-all text-sm text-console-muted">{data.domain||"No domain connected"}</p></div>
              </div>
              <StatusBadge>{data.status.replaceAll("_"," ")}</StatusBadge>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {info.map(([name,value])=><div key={name} className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-console-muted">{name}</dt>
                <dd className="mt-2 break-words text-sm font-semibold capitalize text-console-ink">{value}</dd>
              </div>)}
            </dl>
          </Panel>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel>
              <h2 id="usage" className="scroll-mt-24 text-lg font-semibold text-console-ink">Recorded usage</h2>
              <p className="mt-2 text-xs leading-5 text-console-muted">
                Usage is based on the latest stored provider snapshot, not a live server reading.
              </p>
              {usage?<div className="mt-5 grid gap-5 sm:grid-cols-2">
                <ServiceUsageRing label="Disk" used={usage.diskUsedMb} limit={usage.diskLimitMb}/>
                <ServiceUsageRing label="Bandwidth" used={usage.bandwidthUsedMb} limit={usage.bandwidthLimitMb}/>
              </div>:<p className="mt-5 text-sm text-console-muted">Usage information hasn't been recorded for this service.</p>}
              {usage?.recordedAt?<p className="mt-5 text-xs text-console-muted">Last recorded: {serviceDate(usage.recordedAt)}</p>:null}
            </Panel>
            <Panel>
              <h2 id="renewal" className="scroll-mt-24 flex items-center gap-2 text-lg font-semibold text-console-ink">
                <CalendarClock className="h-5 w-5 text-console-primary" aria-hidden="true"/>Renewal
              </h2>
              <p className="mt-3 text-sm text-console-muted">Next due: {serviceDate(data.nextDueDate)}.</p>
              {renewal?.state==="invoice_ready"&&renewal.invoice_id?
                <ActionLink href={`/client/invoices/${renewal.invoice_id}`} className="mt-5">
                  Review renewal invoice
                </ActionLink>:
                renewal?.state==="request_assistance"?
                <><p className="mt-3 text-sm text-console-muted">
                  There is no verified unpaid renewal invoice to pay yet. Request assistance to renew.
                </p><ActionLink href="/client/support/new" variant="outline" className="mt-4">Request renewal assistance</ActionLink></>:
                <p className="mt-4 text-sm text-console-muted">
                  {renewalError?"Renewal information is temporarily unavailable.": "Renewal is not available for this service."}
                </p>}
              <p className="mt-3 text-xs leading-5 text-console-muted">
                Your renewal date changes only after confirmed billing and fulfilment. Opening this page does not issue an invoice.
              </p>
            </Panel>
          </div>
          <Panel>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-console-ink">
              {hosting?<CloudCog className="h-5 w-5 text-console-primary"/>:<ShieldCheck className="h-5 w-5 text-console-primary"/>}
              Manage service
            </h2>
            <p className="mt-2 text-sm text-console-muted">
              {hosting?"Hosting management requires confirmed provisioning and secure OPanel access.":
                "Management capabilities depend on your activated service and provider."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {hosting?<ActionLink href={`/client/services/${encodeURIComponent(id)}/hosting-status`}>
                Check hosting readiness
              </ActionLink>:null}
              <ActionLink href="/client/support/new" variant="outline">Contact support</ActionLink>
              <ActionLink href="/client/invoices" variant="outline">My invoices</ActionLink>
            </div>
          </Panel>
        </div>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
