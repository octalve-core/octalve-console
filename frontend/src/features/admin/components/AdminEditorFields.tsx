"use client";
import {TextField} from "@/components/design-system/TextField";
import {TextAreaField} from "@/components/design-system/TextAreaField";
import {SelectField} from "@/components/design-system/SelectField";
import type {AdminEditorField} from "../data/admin-editor-config";
export function AdminEditorFields({fields,values,fieldErrors,onChange}:{
 fields:readonly AdminEditorField[];values:Readonly<Record<string,string>>;
 fieldErrors:Readonly<Record<string,string|string[]|undefined>>;
 onChange:(name:string,value:string)=>void;
}){
 return <div className="grid min-w-0 gap-4 md:grid-cols-2">
  {fields.map(field=>{
   const rawError=fieldErrors[field.name];
   const error=Array.isArray(rawError)?rawError.join(" "):rawError;
   const common={id:field.name,name:field.name,label:field.label,required:field.required,value:values[field.name]??"",
    error,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>onChange(field.name,event.target.value)};
   if(field.type==="textarea")return <div key={field.name} className="min-w-0 md:col-span-2">
    <TextAreaField {...common} rows={5} placeholder={field.placeholder}/>
   </div>;
   if(field.type==="select")return <div key={field.name} className="min-w-0">
    <SelectField {...common} options={field.options??[]}/>
   </div>;
   return <div key={field.name} className="min-w-0">
    <TextField {...common} type={field.type} placeholder={field.placeholder}/>
   </div>;
  })}
 </div>;
}
