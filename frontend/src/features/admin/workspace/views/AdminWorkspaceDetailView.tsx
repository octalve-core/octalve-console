"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {ArrowLeft} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {LoadingState} from "@/components/feedback/LoadingState";
import {ErrorState} from "@/components/feedback/ErrorState";
import {ActionLink} from "@/components/design-system/ActionLink";
import {AdminRecordDetailPanel} from "../../components/AdminRecordDetailPanel";
import {readAuthorizedDetail} from "../../utils/read-authorized-detail";
import type {AdminRecord} from "../../data/admin-demo-data";
import {adminWorkspaceConfig,type AdminWorkspaceKey} from "../data/admin-workspace-config";
export function AdminWorkspaceDetailView({workspace}:{workspace:AdminWorkspaceKey}){
 const params=useParams(),id=String(Array.isArray(params.id)?params.id[0]:params.id??"");
 const config=adminWorkspaceConfig[workspace];
 const [record,setRecord]=useState<AdminRecord|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  setLoading(true);setError("");setRecord(null);
  config.loader().then(result=>{
   if(!active)return;
   const found=readAuthorizedDetail(result,id,config.listHref+"/"+encodeURIComponent(id));
   setRecord(found);
   if(!found)setError("This record could not be found in the authorized response.");
  }).catch(()=>{if(active){setRecord(null);setError("We couldn't load the requested record.");}})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[config,id]);
 return <DashboardShell role="admin" title={config.title} description={config.description}>
  <div className="mb-4"><ActionLink href={config.listHref} variant="outline">
   <ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back to {config.title.toLowerCase()}
  </ActionLink></div>
  <DashboardPage eyebrow={config.eyebrow} title={record?.title??config.title}
   description={record?.subtitle??config.description}>
   {loading?<LoadingState title="Loading record" description="Getting the latest details…"/>:
    !record?<ErrorState title="Record unavailable" description={error}/>:
    <AdminRecordDetailPanel record={record} actions={[
     {href:config.listHref,label:"Back to records",variant:"outline"}
    ]}/>}
  </DashboardPage>
 </DashboardShell>;
}
