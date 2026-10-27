/** Explicitly whitelisted, customer-safe domain data; no provider metadata or EPP. */
export type DomainDns = {id:string;type:string;name:string;value:string;ttl:number;priority:number|null};
export type DomainNameserver = {id:string;hostname:string};
export type ClientDomainSnapshot = {
  id:string;name:string;status:string;registrar:string|null;
  registrationDate:string|null;expiryDate:string|null;nextDueDate:string|null;
  autoRenew:boolean;dnssecEnabled:boolean;registrationType:string;
  nameservers:DomainNameserver[];dnsRecords:DomainDns[];
};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const word=(v:unknown)=>typeof v==="string"&&v.trim()?v.trim():null;
const identifier=(v:unknown):string|null=>{
  if(typeof v==="number"&&Number.isSafeInteger(v)&&v>0)return String(v);
  if(typeof v==="string"&&/^[1-9][0-9]*$/.test(v))return v;
  return null;
};
export function normalizeDomain(value:unknown):ClientDomainSnapshot {
  if(!object(value))throw Error("Invalid domain response.");
  const id=identifier(value.id),name=word(value.domain_name),status=word(value.status);
  if(!id||!name||!status)throw Error("Domain record cannot be verified.");
  if(!Array.isArray(value.dns_records)||!Array.isArray(value.nameservers))
    throw Error("Domain management data is incomplete.");
  const dnsRecords:DomainDns[]=value.dns_records.map(item=>{
    if(!object(item)||!identifier(item.id)||!word(item.record_type)||!word(item.name)||typeof item.value!=="string")
      throw Error("DNS record is incomplete.");
    return {
      id:identifier(item.id)!,type:word(item.record_type)!,name:word(item.name)!,
      value:item.value,ttl:typeof item.ttl==="number"&&Number.isFinite(item.ttl)?item.ttl:0,
      priority:typeof item.priority==="number"&&Number.isFinite(item.priority)?item.priority:null
    };
  });
  const nameservers:DomainNameserver[]=value.nameservers.map(item=>{
    if(!object(item)||!identifier(item.id)||!word(item.hostname))
      throw Error("Nameserver information is incomplete.");
    return {id:identifier(item.id)!,hostname:word(item.hostname)!};
  });
  return {
    id,name,status,registrar:word(value.registrar),
    registrationDate:word(value.registration_date),expiryDate:word(value.expiry_date),
    nextDueDate:word(value.next_due_date),autoRenew:value.auto_renew===true,
    dnssecEnabled:value.dnssec_enabled===true,
    registrationType:word(value.registration_type)||"register",
    dnsRecords,nameservers
  };
}
export function displayDomainDate(value:string|null):string {
  if(!value)return "Unavailable";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Unavailable":
    new Intl.DateTimeFormat("en-NG",{year:"numeric",month:"short",day:"numeric"}).format(date);
}
