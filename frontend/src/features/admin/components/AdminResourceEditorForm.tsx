"use client";
import {Loader2,Save} from "lucide-react";
import {AdminEditorFields} from "./AdminEditorFields";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {ApiFormError} from "@/components/feedback/ApiFormError";
import type {AdminEditorField} from "../data/admin-editor-config";
import type {ApiFieldErrors} from "@/lib/api/validation";

/** Presentation only: no API, pricing, ownership or routing authority. */
type Props={
 fields:readonly AdminEditorField[];
 values:Readonly<Record<string,string>>;
 fieldErrors:ApiFieldErrors;
 error:string;
 onChange:(name:string,value:string)=>void;
 onSubmit:(event:React.FormEvent<HTMLFormElement>)=>void;
 isSubmitting:boolean;
 backHref:string;
};
export function AdminResourceEditorForm({fields,values,fieldErrors,error,onChange,onSubmit,isSubmitting,backHref}:Props){
 return <Card>
  <form onSubmit={onSubmit} className="space-y-6">
   <AdminEditorFields fields={fields} values={values} fieldErrors={fieldErrors} onChange={onChange}/>
   <ApiFormError message={error} fieldErrors={fieldErrors}/>
   <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
    <Button href={backHref} variant="outline">Cancel</Button>
    <Button type="submit" disabled={isSubmitting}>
     {isSubmitting?<><Loader2 className="h-4 w-4 animate-spin"/>Saving...</>
       :<><Save className="h-4 w-4"/>Save record</>}
    </Button>
   </div>
  </form>
 </Card>;
}
