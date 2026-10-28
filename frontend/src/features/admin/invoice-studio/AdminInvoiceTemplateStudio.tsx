"use client";
import {useEffect,useState} from "react";
import {FileText,ShieldCheck,ExternalLink} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {api} from "@/lib/api/client";

type InvoiceTemplate={
  id:string;label:string;version:number;is_default:boolean;
  mode:"read_only";preview_path:string;
};
type Catalogue={
  templates:InvoiceTemplate[];editing_enabled:boolean;
  historical_snapshots_ready:boolean;issuance_mode:string;
};
const publicPrefix="/api/cloud";
function previewLink(template:InvoiceTemplate):string|null{
  // Hardcode a reviewable browser path. Never use untrusted server URLs to
  // construct cross-origin links or expose backend rendering paths.
  return template.id==="template_01" &&
    template.preview_path==="/billing/invoices/template-preview/?template_id=template_01"
    ? publicPrefix+template.preview_path:null;
}
export function AdminInvoiceTemplateStudio(){
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [catalog,setCatalog]=useState<Catalogue|null>(null);
  useEffect(()=>{
    let alive=true;
    api.get<Catalogue>("/billing/invoices/templates/").then(data=>{
      if(!alive)return;
      if(!data||!Array.isArray(data.templates)||data.editing_enabled!==false)
        throw new Error("Invalid template authority response");
      setCatalog(data);setState("ready");
    }).catch(()=>{if(alive){setCatalog(null);setState("error");}});
    return ()=>{alive=false;};
  },[]);
  return <DashboardShell role="admin" title="Invoice designer"
      description="Review the approved invoice designs used by Octalve Cloud.">
    <DashboardPage eyebrow="Billing" title="Invoice designer"
        description="Review document layouts and their approved status.">
      <div className="space-y-5">
        <nav aria-label="Billing navigation" className="flex flex-wrap items-center gap-3">
          <ActionLink href="/admin/billing/invoices" variant="outline">Invoices</ActionLink>
          <ActionLink href="/admin/settings/invoices" variant="outline">Invoice policies</ActionLink>
        </nav>
        <Panel>
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-console-primary"/>
            <div>
              <h2 className="text-lg font-semibold text-console-ink">Approved document templates</h2>
              <p className="mt-2 text-sm leading-6 text-console-muted">
                Templates control visual presentation only. Invoice totals, status, customer ownership and payments are managed by the verified billing service.
                Editing and new template activation are not available until document versioning and historical snapshots are approved.
              </p>
            </div>
          </div>
        </Panel>
        {state==="loading"?<Panel><p role="status" className="text-sm text-console-muted">Loading approved invoice templates…</p></Panel>:null}
        {state==="error"?<Panel><p role="alert" className="text-sm text-rose-700">Invoice template records are temporarily unavailable. Your existing invoices are not affected.</p></Panel>:null}
        {state==="ready"&&catalog?<section aria-label="Approved invoice templates" className="grid gap-4 md:grid-cols-2">
          {catalog.templates.map(template=>{
            const link=previewLink(template);
            return <Panel key={template.id} className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
                  <FileText className="h-6 w-6" aria-hidden="true"/>
                </span>
                <div>
                  <h3 className="text-base font-semibold text-console-ink">{template.label}</h3>
                  <p className="mt-1 text-xs text-console-muted">Version {template.version}{template.is_default?" · Current default":""}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-console-muted">Approved layout. Existing issued documents remain under server-controlled billing.</p>
              {link?<a href={link} target="_blank" rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
                Open sample PDF <ExternalLink aria-hidden="true" className="h-4 w-4"/>
              </a>:<p className="mt-4 text-sm text-console-muted">This preview is not available.</p>}
              <p className="mt-3 text-xs text-console-muted">Example only. Not an issued invoice or proof of payment.</p>
            </Panel>;
          })}
          {!catalog.templates.length?<Panel><p className="text-sm text-console-muted">No approved templates are available.</p></Panel>:null}
        </section>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
