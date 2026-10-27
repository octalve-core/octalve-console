import type {ChangeEventHandler} from "react";
export type FormFieldProps={
 label:string;value?:string|number;defaultValue?:string|number;placeholder?:string;
 type?:string;name?:string;as?:"input"|"select"|"textarea";options?:string[];
 rows?:number;required?:boolean;disabled?:boolean;helper?:string;
 onChange?:ChangeEventHandler<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>;
};
export function FormField({label,value,defaultValue,placeholder,type="text",name,as="input",
 options=[],rows=4,required=false,disabled=false,helper,onChange}:FormFieldProps){
 const classes="block min-h-12 w-full min-w-0 rounded-xl border border-console-line bg-white px-4 py-3 text-base text-console-ink outline-none transition placeholder:text-slate-400 focus:border-console-primary focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
 const common={name,placeholder,required,disabled,onChange,className:classes};
 return <label className="block min-w-0 space-y-2">
  <span className="block text-sm font-semibold text-console-ink">{label}{required?" *":null}</span>
  {as==="textarea"?<textarea {...common} rows={rows} defaultValue={value??defaultValue??""} className={classes+" min-h-32 resize-y"}/>:
   as==="select"?<select {...common} defaultValue={value??defaultValue??options[0]??""}>
    {options.map(option=><option key={option} value={option}>{option}</option>)}
   </select>:
   <input {...common} type={type} defaultValue={value??defaultValue??""}/>}
  {helper?<span className="block text-xs leading-5 text-console-muted">{helper}</span>:null}
 </label>;
}
