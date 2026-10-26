"use client";
import {Save,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {TextField} from "@/components/design-system/TextField";
import {TextAreaField} from "@/components/design-system/TextAreaField";
import {SelectField} from "@/components/design-system/SelectField";
import {ActionButton} from "@/components/design-system/ActionButton";
import {MarkdownEditor} from "@/components/modules/MarkdownEditor";
import type {HelpArticleWrite} from "@/lib/api/modules/help-center.api";
export function HelpArticleFormFields({form,saving,loading,onChange}:{
 form:HelpArticleWrite;saving:boolean;loading:boolean;
 onChange:(next:Partial<HelpArticleWrite>)=>void;
}){
 return <>
  <Panel className="min-w-0 space-y-5 xl:col-span-2">
   <TextField label="Article title" name="title" value={form.title} required maxLength={180}
    onChange={event=>onChange({title:event.target.value})}/>
   <div className="grid gap-4 sm:grid-cols-2">
    <TextField label="Category" name="category" required maxLength={80} placeholder="Domains / DNS"
     value={form.category} onChange={event=>onChange({category:event.target.value})}/>
    <SelectField label="Visibility" name="visibility" value={form.visibility}
     options={[{value:"client",label:"Customer help centre"},{value:"internal",label:"Internal staff only"}]}
     onChange={event=>onChange({visibility:event.target.value as HelpArticleWrite["visibility"]})}/>
   </div>
   <TextAreaField label="Short article summary" name="summary" required rows={2} maxLength={320}
    value={form.summary} onChange={event=>onChange({summary:event.target.value})}/>
   <MarkdownEditor value={form.body_markdown} onChange={value=>onChange({body_markdown:value})}/>
  </Panel>
  <Panel className="h-fit space-y-5 xl:sticky xl:top-24">
   <h3 className="flex items-center gap-2 text-base font-semibold text-console-ink">
    <ShieldCheck aria-hidden="true" className="h-5 w-5 text-console-primary"/>Publication
   </h3>
   <p className="text-sm leading-6 text-console-muted">Drafts remain private. Only approved published articles appear in the customer help centre.</p>
   <SelectField label="Status" name="status" value={form.status}
    options={[{value:"draft",label:"Draft"},{value:"published",label:"Published (permission required)"}]}
    onChange={event=>onChange({status:event.target.value as HelpArticleWrite["status"]})}/>
   <ActionButton type="submit" loading={saving} disabled={loading} className="w-full"
    leadingIcon={<Save aria-hidden="true" className="h-4 w-4"/>}>
    {saving?"Saving…":"Save article"}
   </ActionButton>
  </Panel>
 </>;
}
