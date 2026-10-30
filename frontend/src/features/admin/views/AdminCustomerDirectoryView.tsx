"use client";
import {useEffect,useRef,useState} from "react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DirectoryLoadingSkeleton} from "@/components/design-system/DirectoryLoadingSkeleton";
import {ErrorState} from "@/components/feedback/ErrorState";
import {adminApi} from "@/lib/api/endpoints";
import {AdminResourceDirectory} from "../components/AdminResourceDirectory";
import {AdminResourceAuthorityGuide} from "../components/AdminResourceAuthorityGuide";
import {adminResourceConfig} from "../data/admin-resource-config";
import {normalizeAdminRecord} from "../utils/admin-record-normalizer";
import type {AdminRecord} from "../data/admin-demo-data";
import type {DirectoryFilter,ServerDirectoryState} from "@/components/design-system/record-directory/types";

const emptyFilter:DirectoryFilter={status:"all",category:"all",from:"",to:""};
const knownStatuses=["active","inactive","suspended","locked"] as const;
type CustomerPage={count:number;next:string|null;previous:string|null;results:Record<string,unknown>[]};

function parseCustomerPage(value:unknown):CustomerPage{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid customer directory response");
 const page=value as Record<string,unknown>;
 if(!Number.isSafeInteger(page.count)||Number(page.count)<0||
  !Array.isArray(page.results)||page.results.some(x=>!x||typeof x!=="object"||Array.isArray(x))||
  !(typeof page.next==="string"||page.next===null)||
  !(typeof page.previous==="string"||page.previous===null))
  throw Error("Unexpected customer page contract");
 return page as unknown as CustomerPage;
}

/** The Admin Customer golden master is server-paged; never search only the first API page. */
export function AdminCustomerDirectoryView(){
 const config=adminResourceConfig.customers;
 const [rows,setRows]=useState<AdminRecord[]>([]);
 const [count,setCount]=useState(0),[page,setPage]=useState(1);
 const [query,setQuery]=useState(""),[debounced,setDebounced]=useState("");
 const [status,setStatus]=useState("all"),[filter,setFilter]=useState<DirectoryFilter>(emptyFilter);
 const [ordering,setOrdering]=useState("-date_joined");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [loadedKey,setLoadedKey]=useState("");
 const [refreshCounter,setRefreshCounter]=useState(0);
 const lastRefresh=useRef(0);
 useEffect(()=>{
  const timer=window.setTimeout(()=>setDebounced(query.trim()),300);
  return ()=>window.clearTimeout(timer);
 },[query]);
 const sourceKey=JSON.stringify([page,debounced,status,filter.status,filter.from,filter.to,ordering]);
 useEffect(()=>{
  let active=true;
  setLoading(true);
  const selectedStatus=filter.status!=="all"?filter.status:status;
  const params={
   page,page_size:10,search:debounced||undefined,
   status:selectedStatus!=="all"?selectedStatus:undefined,
   date_from:filter.from||undefined,date_to:filter.to||undefined,ordering
  };
  const started=performance.now();
  void adminApi.customers(params).then(response=>{
   if(!active)return;
   const data=parseCustomerPage(response);
   const normalized=data.results.map(item=>normalizeAdminRecord(item,"customers"));
   setRows(normalized);setCount(data.count);setLoadedKey(sourceKey);setError("");
   lastRefresh.current=Date.now();
   // Timing is intentionally non-PII. No customer details or tokens are logged.
   if(process.env.NODE_ENV==="development")console.debug("Customer directory request ms",Math.round(performance.now()-started));
  }).catch(()=>{
   if(active)setError("We couldn’t load your customer records. Please try again.");
  }).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[sourceKey,refreshCounter,page,debounced,status,filter.from,filter.to,filter.status,ordering]);
 useEffect(()=>{
  function refreshIfStale(){
   if(document.visibilityState!=="visible"||Date.now()-lastRefresh.current<120000)return;
   setRefreshCounter(c=>c+1);
  }
  window.addEventListener("focus",refreshIfStale);
  document.addEventListener("visibilitychange",refreshIfStale);
  return ()=>{window.removeEventListener("focus",refreshIfStale);document.removeEventListener("visibilitychange",refreshIfStale);};
 },[]);
 const server:ServerDirectoryState={
  count,page,pageSize:10,query,status,filter,ordering,statuses:knownStatuses,
  onQuery:v=>{setQuery(v);setPage(1);},
  onStatus:v=>{setStatus(v);setFilter(s=>({...s,status:"all"}));setPage(1);},
  onFilter:v=>{setFilter(v);setStatus("all");setPage(1);},
  onPage:setPage,onOrdering:v=>{setOrdering(v);setPage(1);}
 };
 const current=loadedKey===sourceKey;
 return <DashboardShell role="admin" title={config.title} description={config.description}>
  <DashboardPage eyebrow={config.eyebrow} title={config.title} description={config.description}>
   <div className="space-y-4">
    <AdminResourceAuthorityGuide resource="customers"/>
    {error?<ErrorState description={error}/>:null}
    {loading&&!current?<DirectoryLoadingSkeleton label={config.title}/>:
     current?<AdminResourceDirectory resource="customers" records={rows}
      emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}
      create={{href:config.createHref!,label:config.createLabel||"Add customer"}}
      server={server}/>:null}
   </div>
  </DashboardPage>
 </DashboardShell>;
}
