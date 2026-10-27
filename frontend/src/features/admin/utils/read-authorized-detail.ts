import type {AdminRecord} from "../data/admin-demo-data";
function read(item:Record<string,unknown>,keys:readonly string[],fallback="—"){
 for(const key of keys){const value=item[key];if(value!==undefined&&value!==null&&String(value).trim()!=="")return String(value);}
 return fallback;
}
/** Read-only record details. No synthetic fallback, fabricated amount, or unverified ownership. */
export function readAuthorizedDetail(value:unknown,id:string,href:string):AdminRecord|null{
 const rows=Array.isArray(value)?value:
  value&&typeof value==="object"&&"results" in value&&Array.isArray((value as {results:unknown}).results)?
  (value as {results:unknown[]}).results:[];
 const row=rows.find(item=>item&&typeof item==="object"&&
  read(item as Record<string,unknown>,["id","uuid","reference","code"],"")===id);
 if(!row)return null;
 const item=row as Record<string,unknown>;
 return {id,title:read(item,["quote_number","full_name","name","title","subject","domain","label","customer","client"],id),
  subtitle:read(item,["client_email","email","description","summary","product","category"],""),
  meta:read(item,["reference","type","category","provider","status"],"—"),
  amount:read(item,["total","price","amount","balance"],""),
  status:read(item,["status","state","payment_status"],"Unknown"),
  date:read(item,["date","created_at","updated_at","due_date"],""),
  actionHref:href};
}
