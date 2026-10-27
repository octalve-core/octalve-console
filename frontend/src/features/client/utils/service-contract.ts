/** Strict, customer-safe read model. No provider credentials or metadata. */
export type ServiceUsageSnapshot = {
  diskUsedMb:number;diskLimitMb:number;
  bandwidthUsedMb:number;bandwidthLimitMb:number;
  recordedAt:string|null;
};
export type ClientServiceSnapshot = {
  id:string;label:string;domain:string|null;planName:string|null;
  serviceType:string;status:string;billingCycle:string;
  nextDueDate:string|null;autoRenew:boolean;
  currency:string;amount:string|null;
  usage:ServiceUsageSnapshot|null;
};
const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const clean=(v:unknown):string|null=>(typeof v==="string"&&v.trim()?v.trim():null);
const nonnegative=(v:unknown):number|null=>{
  const n=typeof v==="number"?v:typeof v==="string"&&v.trim()?Number(v):NaN;
  return Number.isFinite(n)&&n>=0?n:null;
};
export function normalizeServiceSnapshot(value:unknown):ClientServiceSnapshot {
  if(!obj(value))throw new Error("Invalid service response.");
  const identifier=value.id;
  if((typeof identifier!=="number"||!Number.isSafeInteger(identifier)||identifier<1)
    &&(typeof identifier!=="string"||!/^[1-9][0-9]*$/.test(identifier)))
    throw new Error("Service identifier is unavailable.");
  const label=clean(value.label);
  const status=clean(value.status);
  if(!label||!status)throw new Error("Service information is incomplete.");
  const raw=obj(value.current_usage)?value.current_usage:null;
  const diskUsed=nonnegative(raw?.disk_used_mb),diskLimit=nonnegative(raw?.disk_limit_mb);
  const bandwidthUsed=nonnegative(raw?.bandwidth_used_mb),bandwidthLimit=nonnegative(raw?.bandwidth_limit_mb);
  const usage=raw&&diskUsed!==null&&diskLimit!==null&&bandwidthUsed!==null&&bandwidthLimit!==null
    ?{diskUsedMb:diskUsed,diskLimitMb:diskLimit,
      bandwidthUsedMb:bandwidthUsed,bandwidthLimitMb:bandwidthLimit,
      recordedAt:clean(raw.recorded_at)}
    :null;
  return {
    id:String(identifier),label,domain:clean(value.domain_name),
    planName:clean(value.plan_name),serviceType:clean(value.service_type)||"other",
    status,billingCycle:clean(value.billing_cycle)||"—",
    nextDueDate:clean(value.next_due_date),
    autoRenew:value.auto_renew===true,
    currency:clean(value.currency)||"NGN",
    amount:clean(value.amount),
    usage
  };
}
export function usagePercent(used:number,limit:number):number|null {
  if(!Number.isFinite(used)||!Number.isFinite(limit)||used<0||limit<=0)return null;
  return Math.round((used/limit)*100);
}
export function serviceDate(value:string|null):string {
  if(!value)return "Not available";
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return "Not available";
  return new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric"}).format(date);
}
