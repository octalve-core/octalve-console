/** Per-tab short-lived read-cache for *display only*, never authorization.
 * HTTP BFF responses stay private/no-store. No localStorage, IndexedDB,
 * service-worker, or cross-account persistence. All writes still reach Django.
 */
type Entry = {value:unknown;timestamp:number};
const MAX_ENTRIES=40;
const values=new Map<string,Entry>();
let generation=0;
/** Invalidates pending read generations as well as display values. */
export function privateQueryGeneration():number{return generation;}
export function privateQueryRead<T>(key:string,maxAgeMs=45_000):{value:T;fresh:boolean}|null {
 const hit=values.get(key);
 if(!hit)return null;
 values.delete(key);values.set(key,hit);
 return {value:hit.value as T,fresh:Date.now()-hit.timestamp<maxAgeMs};
}
export function privateQueryWrite<T>(key:string,value:T):void {
 values.delete(key);values.set(key,{value,timestamp:Date.now()});
 while(values.size>MAX_ENTRIES){
  const oldest=values.keys().next().value;
  if(oldest===undefined)break;
  values.delete(oldest);
 }
}
export function privateQueryClear():void{values.clear();generation++;}
export function privateQueryKey(scope:string,accountId:string,role:string,params:unknown):string {
 if(!scope||!accountId||!role)throw Error("Private query requires an authenticated scope.");
 return JSON.stringify([scope,accountId,role,params]);
}
