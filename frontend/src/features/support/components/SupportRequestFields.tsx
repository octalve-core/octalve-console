"use client";
import type {FormEvent} from "react";
import {Send} from "lucide-react";
import {ActionButton} from "@/components/design-system/ActionButton";
import {SelectField} from "@/components/design-system/SelectField";
import {TextField} from "@/components/design-system/TextField";
import {TextAreaField} from "@/components/design-system/TextAreaField";
import type {Department,SupportTopic} from "@/lib/api/modules/help-center.api";
export type SupportRequestValues={
 department:string;topic:string;subject:string;message:string;priority:string;
};
export function SupportRequestFields({values,departments,topics,loading,busy,onChange,onSubmit}:{
 values:SupportRequestValues;departments:readonly Department[];topics:readonly SupportTopic[];
 loading:boolean;busy:boolean;onChange:(key:keyof SupportRequestValues,value:string)=>void;
 onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
}){
 const relevant=topics.filter(item=>String(item.department)===values.department);
 return <form onSubmit={onSubmit} className="mt-6 space-y-5">
  <div className="grid min-w-0 gap-5 md:grid-cols-2">
   <SelectField label="Support department" name="department" value={values.department}
    required disabled={loading} placeholder="Choose a department"
    options={departments.map(item=>({value:String(item.id),label:item.name}))}
    onChange={event=>{onChange("department",event.target.value);onChange("topic","");}}/>
   <SelectField label="Issue topic" name="topic" value={values.topic} disabled={loading||!values.department}
    placeholder="General question" options={relevant.map(item=>({value:String(item.id),label:item.label}))}
    onChange={event=>onChange("topic",event.target.value)}/>
  </div>
  <TextField label="Subject" name="subject" required maxLength={500}
   value={values.subject} onChange={event=>onChange("subject",event.target.value)}
   placeholder="Briefly describe the issue"/>
  <SelectField label="Priority" name="priority" value={values.priority}
   options={[{value:"low",label:"Low — General question"},
    {value:"medium",label:"Normal — Needs attention"},
    {value:"high",label:"High — Service disruption"},
    {value:"urgent",label:"Urgent — Critical service issue"}]}
   onChange={event=>onChange("priority",event.target.value)}/>
  <TextAreaField label="How can we help?" name="message" required minLength={10}
   maxLength={20000} rows={7} value={values.message}
   onChange={event=>onChange("message",event.target.value)}
   placeholder="Explain what happened, when it started, and the affected service. Never share passwords or card details."
   className="min-h-48"/>
  <div className="flex flex-col items-start justify-between gap-4 border-t border-console-line pt-5 sm:flex-row sm:items-center">
   <p className="max-w-sm text-xs leading-5 text-console-muted">
    Do not include login credentials or payment-card details. Attachments are not yet available.
   </p>
   <ActionButton type="submit" loading={busy} disabled={loading||!values.department||values.message.trim().length<10}
    className="w-full sm:w-auto" leadingIcon={<Send aria-hidden="true" className="h-4 w-4"/>}>
    {busy?"Sending…":"Send request"}
   </ActionButton>
  </div>
 </form>;
}
