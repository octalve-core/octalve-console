import {Globe2} from "lucide-react";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {TextField} from "@/components/design-system/TextField";
import {cn} from "@/lib/utils";
import {ClientDomainSearch} from "../../components/ClientDomainSearch";

const choices=[
  {id:"new",label:"Register a domain"},
  {id:"existing",label:"Use my domain"},
  {id:"later",label:"Connect later"},
] as const;
export type DomainChoice=(typeof choices)[number]["id"];

export function ServiceDomainChoice({choice,domain,invalid,onChoice,onDomainChange}:{
  choice:DomainChoice;domain:string;invalid:boolean;
  onChoice:(choice:DomainChoice)=>void;onDomainChange:(domain:string)=>void;
}){
  return <fieldset className="min-w-0">
    <legend className="flex items-center gap-2 text-xl font-medium text-console-ink">
      <Globe2 size={20} aria-hidden="true" className="text-console-primary"/> Connect your domain
    </legend>
    <WorkspaceGrid variant="choiceColumns" className="mt-4">
      {choices.map(option=><label key={option.id}
        className={cn("flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-console-primary",
          choice===option.id?"border-console-primary bg-blue-50 text-console-primary":"border-console-line bg-white text-console-ink")}>
        <input type="radio" name="checkout-domain-choice" value={option.id} checked={choice===option.id}
          onChange={()=>onChoice(option.id)} className="size-4 shrink-0 accent-[#0064E0]"/>
        {option.label}
      </label>)}
    </WorkspaceGrid>
    {choice==="existing"&&<div className="mt-5">
      <TextField id="existing-domain" label="Your domain name" autoComplete="off" maxLength={253}
        placeholder="example.com" value={domain} onChange={event=>onDomainChange(event.target.value)}/>
      {invalid&&<p className="mt-2 text-sm text-rose-700">Enter a valid domain such as example.com.</p>}
    </div>}
    {choice==="new"&&<div className="mt-5"><ClientDomainSearch/></div>}
  </fieldset>;
}