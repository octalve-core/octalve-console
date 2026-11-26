"use client";
import Link from "next/link";
import {useState,type FormEvent} from "react";
import {ArrowLeft,ShieldCheck,ArrowRightLeft} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {CommercePanel} from "@/components/shared-commerce/CommerceUI";
import {DomainSearchField} from "@/components/shared-commerce/DomainCommerce";
import {ActionLink} from "@/components/design-system/ActionLink";
import {clientApi,type DomainTransferReadiness} from "@/lib/api/endpoints";

function validateReply(data:unknown):DomainTransferReadiness {
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Response unavailable.");
  const v=data as Partial<DomainTransferReadiness>;
  if(typeof v.domain!=="string"||v.state!=="registrar_verification_required"||
    v.checkout_enabled!==false||v.registrar_connected!==false||
    v.transfer_eligible!==null||typeof v.supported!=="boolean"){
    throw Error("Transfer status couldn't be verified.");
  }
  return v as DomainTransferReadiness;
}

export function ClientDomainTransferView(){
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [status,setStatus]=useState<DomainTransferReadiness|null>(null);
  async function check(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    const domain=input.trim().toLowerCase().replace(/\.$/,"");
    if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain)){
      setStatus(null);setError("Enter a valid domain name, such as example.com.");return;
    }
    setBusy(true);setError("");setStatus(null);
    try{
      const result=validateReply(await clientApi.domainTransferReadiness(domain));
      if(result.domain!==domain)throw Error("Mismatched domain response.");
      setStatus(result);
    }catch{setError("Transfer preflight is unavailable. Please try again or contact support.");}
    finally{setBusy(false);}
  }
  return <DashboardShell role="client" title="Transfer domain to us"
    description="Explore transferring a domain into your Octalve Cloud account.">
    <DashboardPage eyebrow="Domains" title="Transfer Domain to Us"
      description="Check the domain extension and review the steps before requesting a transfer.">
      <div className="space-y-5">
        <Link href="/client/domains" className="inline-flex items-center gap-2 text-sm font-medium text-console-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true"/>My Domains</Link>
        <CommercePanel>
          <h2 className="flex items-center gap-2 text-lg font-medium text-console-ink">
            <ArrowRightLeft className="h-5 w-5 text-console-primary" aria-hidden="true"/>Domain transfer preflight</h2>
          <p className="mt-2 text-sm text-console-muted">
            Enter your domain name. We won't request your private authorization code
            until a verified transfer service is available.
          </p>
          <div className="mt-5"><DomainSearchField value={input} onChange={value=>{if(!busy){setInput(value);setError("");setStatus(null)}}} busy={busy} onSubmit={check} placeholder="Find your domain…" label="Domain to transfer" submitLabel="Check transfer readiness"/></div>
          {error?<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>:null}
          {status?<div role="status" className="mt-5 rounded-xl border border-console-line bg-slate-50 p-5">
            <h3 className="break-all text-base font-medium text-console-ink">{status.domain}</h3>
            <p className="mt-2 text-sm text-console-muted">
              {status.supported?"Your domain extension has a published indicative transfer rate.":
                "This extension has no published transfer rate currently."}
            </p>
            {status.indicative_price&&status.currency?<p className="mt-2 text-sm font-medium text-console-ink">
              Indicative transfer price: {status.currency} {status.indicative_price}
            </p>:null}
            <p className="mt-3 text-sm text-console-muted">
              Registrar connection, transfer eligibility, consent and final charges are not yet verified.
              No order or transfer has been started.
            </p>
            <ActionLink href="/client/support/new" variant="outline" className="mt-4">
              Contact our team about transfer
            </ActionLink>
          </div>:null}
        </CommercePanel>
        <CommercePanel>
          <h2 className="flex items-center gap-2 text-lg font-medium text-console-ink">
            <ShieldCheck className="h-5 w-5 text-console-primary" aria-hidden="true"/>Before a domain transfer</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-console-muted">
            <li>Confirm you own the domain and can receive registrar approval messages.</li>
            <li>Check any applicable recent-registration, transfer or registrant-change lock.</li>
            <li>Request unlocking and a unique authorization/EPP code from your current registrar when needed.</li>
            <li>Review the registrar-confirmed transfer quote and consent requirements.</li>
            <li>After payment verification, follow the transfer status until registry confirmation.</li>
          </ol>
          <p className="mt-4 text-xs text-console-muted">
            Do not share your EPP code in chat or support tickets. An encrypted, one-time
            transfer submission will be provided only after registrar integration passes acceptance.
          </p>
        </CommercePanel>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
