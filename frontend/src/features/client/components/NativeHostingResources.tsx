"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";

export type ResourceTab="ssl"|"backups"|"files"|"email"|"subdomains"|"databases"|"credentials"|"db_users"|"forwarders"|"autoresponders";
type Mailbox={address:string;quota_mb?:number|null;unlimited?:boolean;destination?:string|null;managed?:boolean};
type FileItem={name:string;kind:"directory"|"file";size_bytes:number};
type Health={origin_tls?:string;public_tls?:string;public_expires_at?:string|null;origin_expires_at?:string|null;count?:number;inventory?:string;restore_verified?:boolean;};
type Inventory={health?:Health;resource:string;domain:string;items:Array<Mailbox|string|FileItem>;verified_at:string;pending_operation:boolean;pending_password_verification?:boolean;databases?:string[];mailboxes?:string[]};
type MailSettings={address:string;imap_host:string;imap_port:number;smtp_host:string;smtp_port:number;transport:string};
type Result={state:"confirmed"|"pending_verification";operation_id?:string;address?:string;password_status?:string};
export function NativeHostingResources({serviceId,domain,capabilities,initialTab="email",quickOnly=false}:{serviceId:string;domain:string;capabilities:Record<string,boolean>;initialTab?:ResourceTab;quickOnly?:boolean}){
 const [tab,setTab]=useState<ResourceTab>(initialTab);
 const [data,setData]=useState<Inventory|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState(false);
 const [mailSettings,setMailSettings]=useState<MailSettings|null>(null);
 const [passwordRecovery,setPasswordRecovery]=useState(false);
 const [action,setAction]=useState<"mailbox_delete"|"mailbox_quota"|"mailbox_password"|"subdomain_create"|"subdomain_delete"|"database_create"|"database_delete"|"hosting_password"|"database_user_create"|"database_user_delete"|"database_grants"|"database_user_password"|"forwarder_create"|"forwarder_delete"|"autoresponder_delete"|"autoresponder_create"|"autoresponder_edit"|null>(null);
 const sequence=useRef(0);
 const selected:ResourceTab=capabilities[tab]?tab:capabilities.ssl?"ssl":capabilities.backups?"backups":capabilities.files?"files":capabilities.email?"email":capabilities.subdomains?"subdomains":capabilities.databases?"databases":capabilities.db_users?"db_users":capabilities.forwarders?"forwarders":capabilities.autoresponders?"autoresponders":"credentials";
 const activeAction=action&&capabilities[action]&&((selected==="email"&&action.startsWith("mailbox"))||(selected==="subdomains"&&action.startsWith("subdomain"))||(selected==="databases"&&(action==="database_create"||action==="database_delete"))||(selected==="db_users"&&(action==="database_user_create"||action==="database_user_delete"||action==="database_grants"||action==="database_user_password"))||(selected==="credentials"&&action==="hosting_password")||(selected==="forwarders"&&action.startsWith("forwarder_"))||(selected==="autoresponders"&&action.startsWith("autoresponder_")))?action:null;
 const base="/services/opanel/"+encodeURIComponent(serviceId);
 async function load(resource:ResourceTab=selected){
  const request=++sequence.current;setBusy(true);setError("");setData(null);setMailSettings(null);
  try{
   const result=await api.get<Inventory>(base+"/resources/"+resource+"/");
   if(request!==sequence.current)return;
   if(result.resource!==resource||result.domain!==domain||!Array.isArray(result.items))throw Error("Unexpected resource inventory");
   setData(result);setPending(result.pending_operation===true);setPasswordRecovery(result.pending_password_verification===true);
  }catch{if(request===sequence.current)setError("Could not confirm the supplier inventory. Please retry or contact support.")}
  finally{if(request===sequence.current)setBusy(false)}
 }
 useEffect(()=>{
  setPending(false);setNotice("");setError("");setData(null);setTab(initialTab);setAction(null);setPasswordRecovery(false);
  return ()=>{sequence.current++};
 },[serviceId,domain,initialTab]);
 useEffect(()=>{
  if(capabilities[selected])void load(selected);
  // Do not poll supplier resources on background dashboard refresh.
  return ()=>{sequence.current++};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[serviceId,domain,selected,capabilities.ssl,capabilities.backups,capabilities.files,capabilities.email,capabilities.subdomains,capabilities.databases,capabilities.credentials,capabilities.db_users,capabilities.forwarders,capabilities.autoresponders]);
 async function mailboxAccess(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||selected!=="email")return;
  const form=event.currentTarget,fields=new FormData(form);
  const local=String(fields.get("mailbox")||"");
  const operation=(event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
  const confirmation=String(fields.get("confirmation")||"");
  form.reset();setMailSettings(null);setBusy(true);setError("");
  try{
   if(operation==="settings"&&capabilities.mail_client_settings){
    const result=await api.get<MailSettings>(base+"/mailboxes/"+encodeURIComponent(local)+"/settings/");
    if(result.address!==local+"@"+domain||result.transport!=="implicit_tls")throw Error("Unexpected settings");
    setMailSettings(result);
   }else if(operation==="webmail"&&capabilities.webmail_launch){
    const result=await api.post<{url:string}>(base+"/mailboxes/"+encodeURIComponent(local)+"/webmail/",{confirm_password:confirmation});
    const target=new URL(result.url);
    if(target.protocol!=="https:"||target.port!=="2096"||target.username||target.password)throw Error("Unexpected destination");
    const anchor=document.createElement("a");anchor.href=target.href;anchor.rel="noreferrer noopener";anchor.referrerPolicy="no-referrer";anchor.click();
   }
  }catch{setError("Could not verify mailbox access or secure connection settings. Please contact support.")}
  finally{setBusy(false)}
 }
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||pending||!capabilities.mailbox_create||selected!=="email")return;
  const form=event.currentTarget,fields=new FormData(form);
  const input={local:String(fields.get("local")||"").toLowerCase(),password:String(fields.get("password")||""),quota_mb:Number(fields.get("quota")),confirm_password:String(fields.get("confirmation")||"")};
  form.reset();setBusy(true);setError("");setNotice("");
  try{
   const result=await api.post<Result>(base+"/mailboxes/create/",input);
   if(result.state==="confirmed"){
    setNotice("Mailbox confirmed by the hosting supplier.");await load("email");
   }else if(result.state==="pending_verification"){
    setPending(true);setNotice("Creation outcome is pending verification. Do not submit again. Use Check pending operation.");
   }else throw Error("Unconfirmed result");
  }catch{
   setError("The mailbox operation could not be confirmed. Check pending operation before retrying.");
   setPending(true);
  }finally{setBusy(false)}
 }
 async function mutate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||pending||!activeAction||!data||data.resource!==selected)return;
  const form=event.currentTarget,fields=new FormData(form);
  const local=String(fields.get("local")||"").toLowerCase();
  const input:Record<string,string|number|null>={local,confirm_password:String(fields.get("confirmation")||"")};
  if(activeAction==="mailbox_quota")input.quota_mb=Number(fields.get("quota"));
  if(activeAction==="mailbox_password"||activeAction==="hosting_password")input.password=String(fields.get("password")||"");
  if(activeAction==="database_create"&&capabilities.database_initial_user_required){input.initial_user=String(fields.get("initial_user")||"").toLowerCase();input.password=String(fields.get("password")||"");}
  if(activeAction==="database_delete"||activeAction==="database_user_delete"||activeAction==="database_grants"||activeAction==="database_user_password")input.local=String(fields.get("local")||"");
  if(activeAction==="database_user_create"||activeAction==="database_user_delete"||activeAction==="database_grants"||activeAction==="database_user_password"){input.database=String(fields.get("database")||"")||null;}
  if(activeAction==="database_user_create"||activeAction==="database_user_password")input.password=String(fields.get("password")||"");
  if(activeAction==="autoresponder_create"||activeAction==="autoresponder_edit"){input.reply_subject=String(fields.get("reply_subject")||"");input.reply_body=String(fields.get("reply_body")||"");}
  if(activeAction.startsWith("forwarder_"))input.destination=String(fields.get("destination")||"");
  if(activeAction==="database_grants")input.profile=String(fields.get("profile")||"");
  if(activeAction.endsWith("_delete"))input.confirm_target=String(fields.get("confirm_target")||"");
  form.reset();setBusy(true);setError("");setNotice("");
  try{
   const result=await api.post<Result>(base+"/resource-actions/"+activeAction+"/",input);
   if(result.state==="confirmed"){setNotice(result.password_status==="unverified"?"Database resource confirmed. Verify the associated password separately.":"Resource state independently confirmed by the supplier.");setAction(null);await load(selected);}
   else if(result.state==="pending_verification"){setPending(true);setPasswordRecovery(activeAction==="mailbox_password"||activeAction==="hosting_password"||activeAction==="database_user_password");setNotice("Operation outcome is pending verification. Do not submit again.");}
   else throw Error("Unconfirmed result");
  }catch{setPending(true);setError("The operation could not be confirmed. Check pending operation or refresh inventory before retrying.");}
  finally{setBusy(false)}
 }
 async function reconcile(event?:FormEvent<HTMLFormElement>){
  event?.preventDefault();if(busy)return;
  const form=event?.currentTarget,fields=form?new FormData(form):null;
  const input=fields?{password:String(fields.get("password")||""),confirm_password:String(fields.get("confirmation")||"")}:{};
  form?.reset();setBusy(true);setNotice("");setError("");
  try{
   const result=await api.post<Result>(base+"/resource-actions/reconcile/",input);
   if(result.state==="confirmed"){
    setPending(false);setPasswordRecovery(false);setNotice(result.password_status==="unverified"?"Resource existence confirmed. Verify the associated password separately.":"Resource state independently confirmed.");await load(selected);
   }else if(result.state==="pending_verification"){
    setPending(true);if(result.password_status==="verification_required")setPasswordRecovery(true);setNotice("Still awaiting independent confirmation. No additional supplier mutation was sent.");
   }else throw Error("Unconfirmed result");
  }catch{setError("No eligible pending operation could be confirmed. Refresh inventory or contact support.");}
  finally{setBusy(false)}
 }
 if(!capabilities.ssl&&!capabilities.backups&&!capabilities.files&&!capabilities.email&&!capabilities.subdomains&&!capabilities.databases&&!capabilities.credentials&&!capabilities.db_users&&!capabilities.forwarders&&!capabilities.autoresponders)return null;
 return <section className={quickOnly?"mt-2":"rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"} aria-label="Native hosting resources">
  {!quickOnly&&<><div className="flex flex-wrap items-center justify-between gap-3">
   <h2 className="text-lg font-medium text-slate-950">Hosting resources</h2>
   <button type="button" disabled={busy} onClick={()=>{setNotice("");void load()}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-50">Refresh</button>
  </div>
  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Resource type">
   {capabilities.ssl&&<button type="button" aria-pressed={selected==="ssl"} disabled={busy} onClick={()=>{setTab("ssl");setAction(null);setNotice("")}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm">SSL readiness</button>}
   {capabilities.backups&&<button type="button" aria-pressed={selected==="backups"} disabled={busy} onClick={()=>{setTab("backups");setAction(null);setNotice("")}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm">Backup inventory</button>}
   {capabilities.files&&<button type="button" aria-pressed={selected==="files"} disabled={busy} onClick={()=>{setTab("files");setAction(null);setNotice("")}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm">Website files</button>}
   {capabilities.email&&<button type="button" aria-pressed={selected==="email"} disabled={busy} onClick={()=>{setTab("email");setAction(null);setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="email"?"bg-[#0064E0] text-white":"border border-slate-200")}>Email accounts</button>}
   {capabilities.forwarders&&<button type="button" aria-pressed={selected==="forwarders"} disabled={busy} onClick={()=>{setTab("forwarders");setAction(null);setNotice("")}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm">Forwarders</button>}
   {capabilities.autoresponders&&<button type="button" aria-pressed={selected==="autoresponders"} disabled={busy} onClick={()=>{setTab("autoresponders");setAction(null);setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="autoresponders"?"bg-[#0064E0] text-white":"border border-slate-200")}>Autoresponders</button>}
   {capabilities.subdomains&&<button type="button" aria-pressed={selected==="subdomains"} disabled={busy} onClick={()=>{setTab("subdomains");setAction(null);setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="subdomains"?"bg-[#0064E0] text-white":"border border-slate-200")}>Subdomains</button>}
   {capabilities.databases&&<button type="button" aria-pressed={selected==="databases"} disabled={busy} onClick={()=>{setTab("databases");setAction(null);setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="databases"?"bg-[#0064E0] text-white":"border border-slate-200")}>Databases</button>}
   {capabilities.db_users&&<button type="button" aria-pressed={selected==="db_users"} disabled={busy} onClick={()=>{setTab("db_users");setAction(null);setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="db_users"?"bg-[#0064E0] text-white":"border border-slate-200")}>Database users</button>}
   {capabilities.credentials&&<button type="button" aria-pressed={selected==="credentials"} disabled={busy} onClick={()=>{setTab("credentials");setAction(null);setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="credentials"?"bg-[#0064E0] text-white":"border border-slate-200")}>Hosting password</button>}
  </div>
  </>}
  {busy&&<p role="status" className="mt-4 text-sm text-slate-500">Checking supplier resources…</p>}
  {error&&<p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
  {!quickOnly&&data&&data.resource===selected&&<div className="mt-4">
   {selected==="ssl"?<div className="space-y-2 text-sm"><p>Public HTTPS certificate: {data.health?.public_tls==="valid"?"Valid":"Not verified"}</p><p>Origin certificate: {data.health?.origin_tls==="valid"?"Valid":"Not verified"}</p>{data.health?.public_expires_at&&<p>Public certificate expiry: {new Date(data.health.public_expires_at).toLocaleDateString()}</p>}<p className="text-xs text-slate-500">A valid certificate does not confirm website content or DNS propagation.</p></div>:selected==="backups"?<div className="space-y-2 text-sm"><p>Backup entries: {data.health?.inventory==="observed"?data.health.count:"Unavailable"}</p><p className="text-xs text-slate-500">Backup existence does not establish recoverability, retention or offsite protection. Use your supplier control panel for backup and restoration.</p></div>:selected==="credentials"?<p className="text-sm text-slate-600">Set or reset your hosting control-panel password. This is separate from your Octalve Console password.</p>:data.items.length===0?<p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">No resources returned by the supplier.</p>:<ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
    {data.items.map(item=>typeof item==="object"&&"name" in item?<li key={item.name} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span className="break-all font-medium">{item.name}</span><span className="text-slate-500">{item.kind==="directory"?"Folder":item.size_bytes.toLocaleString()+" bytes"}</span></li>:typeof item==="string"?<li key={item} className="break-all p-3 text-sm">{item}</li>:<li key={item.address+":"+String(item.destination??"")} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span className="break-all font-medium">{item.address}</span><span className="text-slate-500">{selected==="forwarders"?(item.managed?item.destination:"Unmanaged route"):item.unlimited?"Unlimited":item.quota_mb===null?"Unknown":item.quota_mb+" MB"}</span></li>)}
   </ul>}
   {selected==="files"&&<p className="mt-2 text-xs text-slate-500">Top-level website files only. Hidden, linked and unsupported entries are excluded. Use advanced management to upload, edit, download or remove files securely in your control panel.</p>}
   {selected==="autoresponders"&&<p className="mt-2 text-xs text-slate-500">Configured autoresponder addresses only. Delivery, schedule and message settings are not verified by this inventory.</p>}
   <p className="mt-2 text-xs text-slate-500">Verified at {new Date(data.verified_at).toLocaleString()}</p>
  </div>}
  {!quickOnly&&selected==="email"&&data?.resource==="email"&&(capabilities.mail_client_settings||capabilities.webmail_launch)&&<form onSubmit={mailboxAccess} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
   <h3 className="text-sm font-medium">Mailbox access and connection settings</h3>
   <label className="block text-sm">Mailbox<select name="mailbox" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="" disabled>Choose mailbox</option>{data.items.map(item=>typeof item==="string"||"name" in item?null:<option key={item.address} value={item.address.split("@")[0]}>{item.address}</option>)}</select></label>
   {capabilities.webmail_launch&&<label className="block text-sm">Current Console password (required for webmail)<input type="password" name="confirmation" autoComplete="current-password" maxLength={1024} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>}
   <div className="flex flex-wrap gap-2">{capabilities.mail_client_settings&&<button disabled={busy} value="settings" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm">View secure settings</button>}{capabilities.webmail_launch&&<button disabled={busy} value="webmail" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm">Open webmail</button>}</div>
   {mailSettings&&<dl className="space-y-2 break-all rounded-lg border border-slate-200 p-3 text-sm"><dt>Username</dt><dd>{mailSettings.address}</dd><dt>IMAP (TLS)</dt><dd>{mailSettings.imap_host}:{mailSettings.imap_port}</dd><dt>SMTP (TLS)</dt><dd>{mailSettings.smtp_host}:{mailSettings.smtp_port}</dd><dt>Password</dt><dd>Your mailbox password. Never your Console password.</dd></dl>}
  </form>}
  {selected==="email"&&capabilities.mailbox_create&&<form onSubmit={create} autoComplete="off" className="mt-5 space-y-3 border-t border-slate-100 pt-5">
   {!quickOnly&&<h3 className="text-sm font-medium">Create email account</h3>}
   <p className="text-xs text-slate-500">Create a real mailbox on your assigned hosting server, not a transactional email sender.</p>
   <label className="block text-sm">Mailbox name<div className="mt-1 flex flex-wrap items-center gap-2"><input name="local" required maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}" placeholder="sales" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2"/><span className="break-all text-slate-500">@{domain}</span></div></label>
   <label className="block text-sm">Storage quota (MB)<input name="quota" required type="number" min={1} max={1000000} step={1} defaultValue={500} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <label className="block text-sm">New mailbox password<input name="password" required type="password" minLength={16} maxLength={128} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <label className="block text-sm">Confirm current Console password<input name="confirmation" required type="password" maxLength={1024} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <div className="flex flex-wrap gap-2"><button disabled={busy||pending||!data} className="min-h-11 rounded-lg bg-[#0064E0] px-4 text-sm font-medium text-white disabled:opacity-50">Create mailbox</button></div>
  </form>}
  {!quickOnly&&data&&data.resource===selected&&<div className="mt-5 border-t border-slate-100 pt-5">
   <div className="flex flex-wrap gap-2">
    {([["mailbox_quota","Change quota"],["mailbox_password","Change password"],["mailbox_delete","Delete mailbox"],["subdomain_create","Create subdomain"],["subdomain_delete","Remove subdomain"],["database_create","Create database"],["database_delete","Delete database"],["hosting_password","Set or reset hosting password"],["database_user_create","Create database user"],["database_user_delete","Remove database user"],["database_user_password","Reset database password"],["database_grants","Set database privileges"],["forwarder_create","Create forwarder"],["forwarder_delete","Remove forwarder"],["autoresponder_delete","Remove autoresponder"],["autoresponder_create","Create autoresponder"],["autoresponder_edit","Replace plain-text reply"]] as const).filter(([key])=>capabilities[key]&&(selected==="email"?key.startsWith("mailbox"):selected==="subdomains"?key.startsWith("subdomain"):selected==="databases"?(key==="database_create"||key==="database_delete"):selected==="db_users"?(key==="database_user_create"||key==="database_user_delete"||key==="database_grants"||key==="database_user_password"):selected==="forwarders"?key.startsWith("forwarder_"):selected==="autoresponders"?key.startsWith("autoresponder_"):selected==="credentials"&&key==="hosting_password")).map(([key,label])=><button type="button" key={key} disabled={busy||pending} aria-pressed={activeAction===key} onClick={()=>{setAction(key);setNotice("");setError("")}} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-50">{label}</button>)}
   </div>
   {activeAction&&<form key={activeAction} onSubmit={mutate} autoComplete="off" className="mt-4 space-y-3">
    {activeAction==="autoresponder_create"?<label className="block text-sm">Owned mailbox<select name="local" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="" disabled>Choose mailbox</option>{(data.mailboxes||[]).map(name=><option key={name} value={name.split("@")[0]}>{name}</option>)}</select></label>:activeAction.startsWith("forwarder_")?<><label className="block text-sm">Owned mailbox<select name="local" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="" disabled>Choose mailbox</option>{(data.mailboxes||[]).map(name=><option key={name} value={name.split("@")[0]}>{name}</option>)}</select></label><label className="block text-sm">External destination email<input name="destination" type="email" maxLength={253} required className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label></>:activeAction==="hosting_password"?<input type="hidden" name="local" value=""/>:(activeAction==="database_create"||activeAction==="database_user_create")?<label className="block text-sm">{activeAction==="database_create"?"Database name":"Database user"} (your account prefix is added automatically)<input name="local" required maxLength={24} pattern="[a-z][a-z0-9]{0,23}" placeholder="website" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>:activeAction==="subdomain_create"?<label className="block text-sm">Subdomain name<div className="mt-1 flex flex-wrap items-center gap-2"><input name="local" required maxLength={63} pattern="[a-zA-Z0-9](?:[a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?" placeholder="shop" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2"/><span className="break-all text-slate-500">.{domain}</span></div></label>:
     <label className="block text-sm">Resource<select name="local" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="" disabled>Choose a resource</option>{data.items.map(item=>{if(typeof item==="object"&&"name" in item)return null;const name=typeof item==="string"?item:item.address;const suffix=(selected==="email"||selected==="autoresponders"?"@":".")+domain;const local=(selected==="databases"||selected==="db_users")?name:name.endsWith(suffix)?name.slice(0,-suffix.length):"";return local&&!local.includes(".")&&selected==="subdomains"||local&&(selected==="email"||selected==="autoresponders"||selected==="databases"||selected==="db_users")?<option key={name} value={local}>{name}</option>:null})}</select></label>}
    {(activeAction==="autoresponder_create"||activeAction==="autoresponder_edit")&&<><p className="text-xs text-slate-500">Plain text only. Replies are limited to once per sender every 48 hours; no CC, HTML or schedule. Editing replaces the existing supported configuration.</p><label className="block text-sm">Subject<input name="reply_subject" required maxLength={150} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label><label className="block text-sm">Message<textarea name="reply_body" required maxLength={4000} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label></>}
    {(activeAction==="database_grants"||((activeAction==="database_user_create"||activeAction==="database_user_delete"||activeAction==="database_user_password")&&capabilities.database_user_requires_database))&&<label className="block text-sm">Owned database<select name="database" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="" disabled>Choose database</option>{(data.databases||[]).map(name=><option key={name}>{name}</option>)}</select></label>}
    {(activeAction==="database_user_create"||activeAction==="database_user_password")&&<label className="block text-sm">Database user password<input name="password" required type="password" minLength={16} maxLength={128} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>}
    {activeAction==="database_grants"&&<label className="block text-sm">Privilege profile<select name="profile" defaultValue="read_only" className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="read_only">Read only (SELECT)</option><option value="read_write">Read and write data</option><option value="application">Application schema and data</option></select><p className="mt-1 text-xs text-slate-500">This replaces the selected database grants, never grants global or delegation privileges.</p></label>}
    {activeAction==="database_create"&&capabilities.database_initial_user_required&&<><label className="block text-sm">Initial database user<input name="initial_user" required maxLength={24} pattern="[a-z][a-z0-9]{0,23}" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label><label className="block text-sm">Database user password<input name="password" type="password" required minLength={16} maxLength={128} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label></>}
    {activeAction==="mailbox_quota"&&<label className="block text-sm">New storage quota (MB)<input name="quota" required type="number" min={1} max={1000000} step={1} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>}
    {(activeAction==="mailbox_password"||activeAction==="hosting_password")&&<label className="block text-sm">New {activeAction==="hosting_password"?"hosting":"mailbox"} password<input name="password" required type="password" minLength={16} maxLength={128} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>}
    {activeAction.endsWith("_delete")&&<><p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{activeAction==="autoresponder_delete"?"Remove this automatic reply; the mailbox is not deleted.":activeAction==="forwarder_delete"?"Type the exact route as source@example.com -> destination@example.net to confirm.":activeAction==="database_user_delete"?(capabilities.database_user_requires_database?"Remove this user from the selected database. Type the full user name, space @ space, and full database name to confirm.":"Remove this database user and its access to databases on the account.") :activeAction==="database_delete"?"Deleting a database permanently removes its data. Back it up before proceeding.":activeAction==="mailbox_delete"?"Deleting a mailbox permanently removes its messages. Back up anything needed before proceeding.":"Removing the subdomain stops its hosting configuration. Website files will not be requested for deletion."}</p><label className="block text-sm">Type the complete resource name to confirm<input name="confirm_target" required maxLength={512} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label></>}
    <label className="block text-sm">Confirm current Console password<input name="confirmation" required type="password" maxLength={1024} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
    <div className="flex flex-wrap gap-2"><button disabled={busy||pending} className="min-h-11 rounded-lg bg-[#0064E0] px-4 text-sm font-medium text-white disabled:opacity-50">Confirm operation</button><button type="button" disabled={busy} onClick={()=>setAction(null)} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm">Cancel</button></div>
   </form>}
  </div>}
  {(capabilities.mailbox_create||capabilities.mailbox_delete||capabilities.mailbox_quota||capabilities.mailbox_password||capabilities.subdomain_create||capabilities.subdomain_delete||capabilities.database_create||capabilities.database_delete||capabilities.hosting_password||capabilities.database_user_create||capabilities.database_user_delete||capabilities.database_user_password||capabilities.database_grants||capabilities.forwarder_create||capabilities.forwarder_delete||capabilities.autoresponder_delete||capabilities.autoresponder_create||capabilities.autoresponder_edit)&&!passwordRecovery&&<button type="button" disabled={busy} onClick={()=>void reconcile()} className="mt-4 min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium disabled:opacity-50">Check pending operation</button>}
  {passwordRecovery&&(capabilities.mailbox_password||capabilities.hosting_password||capabilities.database_user_password)&&<form onSubmit={reconcile} className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4">
   <p className="text-sm">Verify the password submitted for the pending operation. This does not change it again.</p>
   <label className="block text-sm">Originally submitted password<input name="password" required type="password" minLength={16} maxLength={128} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <label className="block text-sm">Current Console password<input name="confirmation" required type="password" maxLength={1024} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <button disabled={busy} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium disabled:opacity-50">Verify pending password</button>
  </form>}
 </section>
}
