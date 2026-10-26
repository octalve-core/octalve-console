/** Hosting readiness comes only from authoritative Console/provider fields.
 * Checkout, payment, DNS and public HTTP status are independent.
 */
type Readiness = {
  status: string;
  active: boolean;
  hosting_account_verified?: boolean;
  website_public_status?: string;
  dns_public_status?: string;
  capabilities: Record<string,boolean>;
};
export function HostingReadiness({service}: {service:Readiness}) {
  const steps = [
    {title:"Hosting account",ready:service.hosting_account_verified===true,
      note:"Requires a fresh, account-specific provider read-back"},
    {title:"OPanel access",ready:service.capabilities.panel_sso===true,
      note:"Requires verified service ownership and a secure session"},
    {title:"Server files",ready:service.capabilities.files===true,
      note:"Real file inventory awaits an approved account-scoped adapter"},
    {title:"Domain DNS",ready:service.dns_public_status==="verified",
      note:"Authoritative DNS must point to the intended hosting server"},
    {title:"Website online",ready:service.website_public_status==="verified",
      note:"Only valid HTTPS and expected public site content count"},
  ];
  return <section className="rounded-2xl border bg-white p-5" aria-label="Hosting readiness">
    <h2 className="text-lg font-semibold">Website readiness</h2>
    <p className="mt-2 text-sm text-slate-600">A verified hosting account is not the same as a publicly accessible website. These checks are independent.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {steps.map(step=><article key={step.title} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{step.title}</h3>
          <span className={step.ready?"rounded-full bg-green-100 px-2 py-1 text-xs text-green-800":"rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"}>
            {step.ready?"Verified":"Pending verification"}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{step.note}</p>
      </article>)}
    </div>
    <p className="mt-4 text-xs text-slate-500">A purchase or paid invoice alone never marks a website as online.</p>
  </section>;
}
