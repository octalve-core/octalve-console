"use client";
import type {FormEvent} from "react";
import {CheckCircle2,Plus} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {TextField} from "@/components/design-system/TextField";
import {ActionButton} from "@/components/design-system/ActionButton";
export function SupportRoutingCreateForms({departmentName,name,slug,working,hasDepartment,
 onDepartmentNameChange,onNameChange,onSlugChange,onCreateDepartment,onCreateTopic}:{
 departmentName:string;name:string;slug:string;working:boolean;hasDepartment:boolean;
 onDepartmentNameChange:(value:string)=>void;onNameChange:(value:string)=>void;onSlugChange:(value:string)=>void;
 onCreateDepartment:(event:FormEvent<HTMLFormElement>)=>void;onCreateTopic:(event:FormEvent<HTMLFormElement>)=>void;
}){
 return <Panel className="h-fit min-w-0 space-y-5 xl:col-span-1">
  <div className="border-b border-console-line pb-5">
   <h2 className="text-base font-semibold text-console-ink">New department</h2>
   <form onSubmit={onCreateDepartment} className="mt-4 space-y-3">
    <TextField name="departmentName" label="Department name" required maxLength={100}
     value={departmentName} onChange={event=>onDepartmentNameChange(event.target.value)}
     placeholder="Technical Support" disabled={working}/>
    <ActionButton type="submit" variant="outline" className="w-full" disabled={working}>Add department</ActionButton>
   </form>
  </div>
  <h2 className="flex items-center gap-2 text-base font-semibold text-console-ink">
   <Plus aria-hidden="true" className="h-5 w-5 text-console-primary"/>Add issue topic
  </h2>
  <p className="text-sm leading-6 text-console-muted">
   For example: DNS, Email, SSL, Billing or WordPress. Every topic belongs to an approved support department.
  </p>
  <form onSubmit={onCreateTopic} className="space-y-4">
   <TextField name="topicName" label="Topic label" required maxLength={80}
    value={name} onChange={event=>onNameChange(event.target.value)}
    placeholder="DNS support" disabled={working}/>
   <TextField name="topicSlug" label="Short code" required maxLength={40}
    value={slug} onChange={event=>onSlugChange(event.target.value)} placeholder="dns" disabled={working}/>
   <ActionButton type="submit" className="w-full" disabled={!hasDepartment||working}>Create topic</ActionButton>
  </form>
  <p className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">
   <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>
   Assign an agent to the department first, then to the topics they handle. Routing remains server-controlled.
  </p>
 </Panel>;
}
