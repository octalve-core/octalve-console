"use client";
import {useState} from "react";
import {AdminResourceDirectory} from "../components/AdminResourceDirectory";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DirectoryLoadingSkeleton} from "@/components/design-system/DirectoryLoadingSkeleton";
import {ErrorState} from "@/components/feedback/ErrorState";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {adminResourceConfig,type AdminResourceKey} from "../data/admin-resource-config";
import {AdminResourceAuthorityGuide} from "../components/AdminResourceAuthorityGuide";
import {normalizeAdminRecord,unwrapAdminList} from "../utils/admin-record-normalizer";
import type {AdminRecord} from "../data/admin-demo-data";
const normalizeRecord=normalizeAdminRecord;
export function AdminResourceListView({resource}:{resource:AdminResourceKey}){
 const config=adminResourceConfig[resource];
 const [records,setRecords]=useState<AdminRecord[]>([]);
 const [isLoading,setIsLoading]=useState(true);
 const [error,setError]=useState("");
 async function loadRecords(quiet=false){
  if(!quiet)setIsLoading(true);
  try{
   const response=await config.loader();
   const apiRecords=unwrapAdminList(response).map(item=>normalizeRecord(item, config.key));
   setRecords(apiRecords);setError("");
  }catch{
   if(!quiet)setRecords([]);
   setError("We couldn’t load your records. Please try again.");
  }finally{setIsLoading(false);}
 }
 useAutoSync(loadRecords,resource);
 return <DashboardShell role="admin" title={config.title} description={config.description}>
  <DashboardPage eyebrow={config.eyebrow} title={config.title} description={config.description}>
   <div className="space-y-4">
    <AdminResourceAuthorityGuide resource={resource}/>
    {error?<ErrorState description={error}/>:null}
    {isLoading?<DirectoryLoadingSkeleton label={config.title}/>:
     !error||records.length?<AdminResourceDirectory resource={resource} records={records}
      emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}
      detailEnabled={resource!=="provisioning"}
      create={config.createHref?{href:config.createHref,label:config.createLabel??"Create"}:undefined}/>:null}
   </div>
  </DashboardPage>
 </DashboardShell>;
}
