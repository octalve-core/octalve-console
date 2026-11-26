import {UserRound} from "lucide-react";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";

import type {FormEvent} from "react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";

import {TextField} from "@/components/design-system/TextField";
import {ActionButton} from "@/components/design-system/ActionButton";
import type {AccountProfile,EditableAccountProfile} from "@/lib/api/endpoints";

const fields:readonly {key:keyof EditableAccountProfile;label:string;auto:string}[]=[
 {key:"full_name",label:"Full name",auto:"name"},
 {key:"phone_number",label:"Telephone number",auto:"tel"},
 {key:"company_name",label:"Company / organisation",auto:"organization"},
 {key:"address",label:"Street address",auto:"street-address"},
 {key:"city",label:"City",auto:"address-level2"},
 {key:"state",label:"State / region",auto:"address-level1"},
 {key:"country",label:"Country",auto:"country-name"},
 {key:"postal_code",label:"Postal code",auto:"postal-code"},
 {key:"tax_id",label:"Tax identification number",auto:"off"}
];
export function ClientProfileDetailsForm({profile,draft,name,email,saving,onChange,onSubmit,embedded=false}:{
 profile:AccountProfile|null;draft:EditableAccountProfile|null;name:string;email:string;
 saving:boolean;embedded?:boolean;onChange:(field:keyof EditableAccountProfile,value:string)=>void;
 onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
}){
 const content=<>
  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
   <ConsoleIconTile icon={UserRound} initial={(profile?.full_name||name||"U").trim().charAt(0)||"U"} tone="blue" className="rounded-full bg-blue-100 text-console-primary"/>
   <div className="min-w-0">
    <h2 className="break-words text-sm font-medium text-console-ink">{profile?.full_name||name||"Your details"}</h2>
    <p className="break-all text-xs text-console-muted">{profile?.email||email||"Email unavailable"}</p>
   </div>
  </div>
  {draft?<form onSubmit={onSubmit} className="mt-5 space-y-5">
   <WorkspaceGrid variant="filters">
    {fields.map(field=><div key={field.key} className={["address","company_name","tax_id"].includes(field.key)?"sm:col-span-2":""}>
     <TextField name={field.key} label={field.label} autoComplete={field.auto} type={field.key==="phone_number"?"tel":"text"} placeholder={["company_name","postal_code","tax_id"].includes(field.key)?"Optional":field.key==="address"?"Enter street address":undefined}
      maxLength={field.key==="address"?400:255} value={draft[field.key]}
      onChange={event=>onChange(field.key,event.target.value)} disabled={saving}/>
    </div>)}
   </WorkspaceGrid>
   <ActionButton type="submit" loading={saving} className="w-full sm:w-auto">
    {saving?"Saving…":"Save account details"}
   </ActionButton>
  </form>:null}
 </>;
 return embedded?content:<Panel className="p-4 sm:p-6">{content}</Panel>;
}
