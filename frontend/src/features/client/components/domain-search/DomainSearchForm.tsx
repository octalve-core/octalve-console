import type {FormEvent} from "react";
import {DomainSearchField} from "@/components/shared-commerce/DomainCommerce";
export function DomainSearchForm({domain,onChange,busy,onSubmit}:{domain:string;onChange:(text:string)=>void;busy:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void}){
 return <DomainSearchField value={domain} onChange={onChange} busy={busy} onSubmit={onSubmit}/>;
}
