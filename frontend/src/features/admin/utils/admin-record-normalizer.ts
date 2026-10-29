import type {AdminResourceKey} from "../data/admin-resource-config";
import type {AdminRecord} from "../data/admin-demo-data";
export {unwrapAdminList,getAdminRecordId,findExactAdminRecord,readAdminString,getAdminResourceBasePath} from "./admin-record-shared.ts";
import {getAdminRecordId,readAdminString,getAdminResourceBasePath} from "./admin-record-shared.ts";
function finiteMoney(value:unknown):string|undefined{
 if(value===null||value===undefined||value==="")return undefined;
 const n=typeof value==="number"?value:typeof value==="string"?Number(value):NaN;
 return Number.isFinite(n)?new Intl.NumberFormat("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n):undefined;
}
function isoDate(value:unknown):string|undefined{
 return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):undefined;
}
function dateText(date?:string):string{
 if(!date)return "";
 const d=new Date(date+"T00:00:00Z");
 return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(d);
}
function normalizeCustomer(item:Record<string,unknown>):AdminRecord{
 const id=getAdminRecordId(item),joined=isoDate(item.date_joined);
 const email=readAdminString(item,["email"],"");
 const name=readAdminString(item,["full_name"],"")||email||"Customer #"+id;
 return {id,title:name,subtitle:email&&email!==name?email:"",
  meta:readAdminString(item,["company_name"],"—"),companyName:readAdminString(item,["company_name"],"—"),
  reference:"Customer #"+id,servicesCount:typeof item.services_count==="number"&&Number.isFinite(item.services_count)?item.services_count:undefined,
  amount:finiteMoney(item.wallet_balance),walletBalance:finiteMoney(item.wallet_balance),
  date:dateText(joined),dateISO:joined,status:readAdminString(item,["status"],"Unknown"),
  actionHref:getAdminResourceBasePath("customers")+"/"+encodeURIComponent(id)};
}
export function normalizeAdminRecord(value:unknown,key:AdminResourceKey):AdminRecord{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid API record");
 const item=value as Record<string,unknown>;
 if(key==="customers")return normalizeCustomer(item);
 const id=getAdminRecordId(item);
 const title=readAdminString(item,["name","title","domain","display_name","customer","client","email"],id);
 const subtitle=readAdminString(item,["email","summary","description","product","category","adapter_type","domain","subject"],"");
 const meta=readAdminString(item,["type","cycle","adapter","registrar","provider","department"],"—");
 const reference=readAdminString(item,["reference","code","domain","slug"],"");
 const dateISO=isoDate(item.created_at)||isoDate(item.updated_at)||isoDate(item.date)||isoDate(item.expiry);
 return {id,title,subtitle,meta,reference,amount:readAdminString(item,["total","price","amount","balance","credited"],""),
  status:readAdminString(item,["status","state","payment_status"],"Unknown"),
  date:dateISO?dateText(dateISO):readAdminString(item,["date","created_at","updated_at","expiry"],""),
  dateISO,actionHref:getAdminResourceBasePath(key)+"/"+encodeURIComponent(id)};
}
