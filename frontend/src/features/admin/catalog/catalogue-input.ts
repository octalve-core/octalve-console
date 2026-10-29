import type {Feature} from "./catalogue-types";
const CYCLES=new Set(["1mo","3mo","6mo","12mo","24mo","36mo"]);
/** Never coerce a wholesale amount into a client price. Trusted Django checks it again. */
export function parseSupplierCostLines(text:string):Record<string,string>{
 const result:Record<string,string>={};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const match=/^(1mo|3mo|6mo|12mo|24mo|36mo)\s*=\s*([0-9]{1,12}(?:\.[0-9]{1,2})?)$/.exec(line);
  if(!match||!CYCLES.has(match[1])||Number(match[2])<=0)
   throw new Error("Enter positive supplier rates as 1mo=1500, one cycle per line.");
  if(Object.hasOwn(result,match[1]))throw new Error("Supplier billing periods must not repeat.");
  result[match[1]]=match[2];
 }
 return result;
}
/** List items are display features; quantitative claims are verified by Django on publish. */
export function parsePlanFeatureLines(text:string):Feature[]{
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(lines.length>40)throw new Error("A plan can contain at most 40 feature bullets.");
 const seen=new Set<string>();
 return lines.map(line=>{
  const separator=line.indexOf(":");
  const label=(separator<0?line:line.slice(0,separator)).trim();
  const value=separator<0?"":line.slice(separator+1).trim();
  if(!label||label.length>100||value.length>100||separator>=0&&!value)
   throw new Error("Each feature needs a short label, with an optional ': value'.");
  const key=label.toLocaleLowerCase("en-US");
  if(seen.has(key))throw new Error("Each feature label must be unique.");
  seen.add(key);
  return {label,value,is_highlighted:true};
 });
}
