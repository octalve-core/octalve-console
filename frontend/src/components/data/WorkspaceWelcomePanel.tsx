type Audience="client"|"staff"|"admin";
type Content={eyebrow:string;description:string};
const copy:Record<Audience,Content>={
 client:{eyebrow:"Your Octalve Cloud Console",description:"Manage your services, domains, invoices, wallet and support in one place."},
 admin:{eyebrow:"Your Octalve Cloud administration",description:"Keep track of customers, hosting services, invoices, domains and provisioning."},
 staff:{eyebrow:"Your Octalve Cloud Console",description:"Follow customer requests, orders, support cases and provisioning."},
};
/** Invoice-derived compact heading; leaves all account and API authority unchanged. */
export function WorkspaceWelcomePanel({name,audience}:{name:string;audience:Audience}){
 const data=copy[audience];
 return <header aria-label="Console welcome" className="min-w-0 text-console-ink">
  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-console-primary">{data.eyebrow}</p>
  <h1 className="mt-1 text-xl font-medium leading-7 tracking-tight text-console-ink sm:text-2xl">Welcome {name} <span role="img" aria-label="hello">👋</span></h1>
  <p className="mt-1 max-w-2xl text-[13px] leading-5 text-console-muted">{data.description}</p>
 </header>;
}
