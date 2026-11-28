"use client";
import {useEffect,useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";
import {Panel} from "@/components/design-system/Panel";
import type {LiveDomainDNS} from "@/lib/api/endpoints";

type Access={state:string;domain:string;pending:boolean};
type Choice={id:string;label:string};
const kinds=["A","AAAA","CNAME","MX","TXT","CAA","SRV"];
const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 py-2 text-sm";
const button="min-h-11 rounded-lg bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50";
export function DNSWriteControls({domainId,domainName,live,admin=false,connections=[]}:{domainId:string;domainName:string;live:LiveDomainDNS|null;admin?:boolean;connections?:Choice[]}){
 const [access,setAccess]=useState<Access|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
 const [operation,setOperation]=useState("create"),[target,setTarget]=useState(""),[kind,setKind]=useState("A");
 const path="/domains/domains/"+encodeURIComponent(domainId)+"/";
 async function load(){
  const result=await api.get<Access>(path+"dns-write-access/");
  if(result.domain!==domainName||typeof result.pending!=="boolean")throw Error("Unexpected DNS authority");
  setAccess(result);
 }
 useEffect(()=>{let active=true;void api.get<Access>(path+"dns-write-access/").then(result=>{if(active&&result.domain===domainName)setAccess(result)}).catch(()=>{if(active)setAccess(null)});return()=>{active=false}},[path,domainName]);
 async function submit(event:FormEvent<HTMLFormElement>,action:string){
  event.preventDefault();if(busy)return;
  const form=event.currentTarget,fields=new FormData(form);
  const password=String(fields.get("password")||"");
  let input:Record<string,unknown>={confirm_password:password};
  if(action==="consent")input.accept=true;
  if(action==="approve"){input.connection_id=String(fields.get("connection")||"");input.totp_code=String(fields.get("totp")||"");}
  if(action==="revoke"&&admin)input.totp_code=String(fields.get("totp")||"");
  if(action==="mutate"){
   const existing=live?.records.find(row=>row.id===target);
   if(!live?.snapshot_sha256||(operation!=="create"&&!existing))return;
   const name=operation==="create"?String(fields.get("name")||""):existing!.name;
   const type=operation==="create"?kind:existing!.type;
   input={...input,operation,record_id:operation==="create"?null:target,
    record:operation==="delete"?null:{name,type,value:String(fields.get("value")||""),ttl:Number(fields.get("ttl")),priority:type==="MX"?Number(fields.get("priority")):null},
    snapshot_sha256:live.snapshot_sha256,confirm_name:String(fields.get("confirm_name")||"")};
  }
  if(action==="reconcile")input={};
  form.reset();setBusy(true);setMessage("");setError(false);
  try{
   const result=await api.post<{state:string}>(path+"dns-write/"+action+"/",input);
   setMessage(result.state==="confirmed"?"Record state confirmed by the provider. Public propagation is separate. Refresh this page before another operation.":result.state==="pending_verification"?"Outcome pending. Do not repeat the mutation. Use Check pending operation.":"DNS authorization updated.");
   await load();
  }catch{setError(true);setMessage("DNS operation could not be confirmed. Refresh authority and records before trying again.");}
  finally{setBusy(false)}
 }
 if(!access||access.state==="unavailable")return null;
 const selected=live?.records.find(row=>row.id===target);
 const selectedKind=operation==="create"?kind:selected?.type;
 const confirmFields=<><label className="block text-sm">Current Console password<input className={field} name="password" type="password" required autoComplete="current-password"/></label>{admin&&<label className="block text-sm">Authenticator code<input className={field} name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required/></label>}</>;
 return <Panel elevation="flat">
  <h2 className="text-sm font-medium text-console-ink">Authoritative DNS changes</h2>
  <p className="mt-2 text-xs leading-5 text-console-muted">Separate write authorization for the exact approved Cloudflare zone. Public nameservers must match. Protected, proxied and unsupported records remain managed in the provider dashboard.</p>
  <p className="mt-2 text-sm">Write access: {access.state.replaceAll("_"," ")}</p>
  {message&&<p role={error?"alert":"status"} className="mt-3 text-sm">{message}</p>}
  {!admin&&["not_authorized","revoked"].includes(access.state)&&!access.pending&&<form className="mt-3 space-y-3" onSubmit={e=>void submit(e,"consent")}>{confirmFields}<button className={button} disabled={busy}>Request DNS write access</button></form>}
  {admin&&access.state==="consented"&&<form className="mt-3 space-y-3" onSubmit={e=>void submit(e,"approve")}><label className="block text-sm">Separate saved zone-scoped write credential<select className={field} name="connection" defaultValue="" required><option value="" disabled>Choose write connection</option>{connections.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>{confirmFields}<button className={button} disabled={busy}>Approve DNS write access</button></form>}
  {!admin&&access.state==="approved"&&access.pending&&<form className="mt-3" onSubmit={e=>void submit(e,"reconcile")}><button className={button} disabled={busy}>Check pending operation</button></form>}
  {!admin&&access.state==="approved"&&!access.pending&&live?.state==="connected"&&<form className="mt-4 space-y-3" onSubmit={e=>void submit(e,"mutate")}>
   <label className="block text-sm">Operation<select className={field} value={operation} onChange={e=>{setOperation(e.target.value);setTarget("")}}><option value="create">Create record</option><option value="edit">Edit record</option><option value="delete">Delete record</option></select></label>
   {operation!=="create"?<label className="block text-sm">Record<select className={field} value={target} onChange={e=>setTarget(e.target.value)} required><option value="">Choose record</option>{live.records.filter(row=>kinds.includes(row.type)&&row.proxied!==true).map(row=><option key={row.id} value={row.id}>{row.type} · {row.name} · {row.value}</option>)}</select></label>:<>
    <label className="block text-sm">Fully qualified name<input className={field} name="name" placeholder={"www."+domainName} required maxLength={253}/></label>
    <label className="block text-sm">Record type<select className={field} value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
   </>}
   {operation!=="delete"&&(operation==="create"||selected)&&<div key={operation+target+kind} className="space-y-3"><label className="block text-sm">Value<input name="value" className={field} required maxLength={1024} defaultValue={selected?.value||""}/></label><label className="block text-sm">TTL (seconds; 1 = automatic)<input name="ttl" className={field} required type="number" min={1} max={86400} defaultValue={selected?.ttl||300}/></label>{selectedKind==="MX"&&<label className="block text-sm">Priority<input name="priority" className={field} required type="number" min={0} max={65535} defaultValue={selected?.priority??10}/></label>}</div>}
   <label className="block text-sm">Type the complete record name to confirm<input name="confirm_name" className={field} required maxLength={253} placeholder={selected?.name||domainName}/></label>{confirmFields}
   <button className={button} disabled={busy||operation!=="create"&&!selected}>Confirm DNS operation</button>
  </form>}
  {["approved","consented"].includes(access.state)&&<details className="mt-4"><summary className="cursor-pointer text-sm text-rose-700">Revoke write access</summary><form className="mt-3 space-y-3" onSubmit={e=>void submit(e,"revoke")}>{confirmFields}<button className={button} disabled={busy}>Confirm revocation</button></form></details>}
 </Panel>
}
