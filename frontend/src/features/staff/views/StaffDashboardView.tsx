"use client";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { StaffHero } from "../components/StaffHero";
import {StaffQuickActions} from "../components/StaffQuickActions";
import {StaffOverviewMetrics,type StaffSummaryCounts} from "../components/StaffOverviewMetrics";
import {StaffRecentPanel} from "../components/StaffRecentPanel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import { staffResourceConfig } from "../data/staff-resource-config";
import type { StaffRecord } from "../data/staff-demo-data";
import { normalizeStaffRecord, unwrapStaffList } from "../utils/staff-record-normalizer";

const keys = ["customers", "orders", "provisioning", "tickets", "knowledgeBase"] as const;
const initialCounts: StaffSummaryCounts = {customers:null,orders:null,provisioning:null,tickets:null,knowledgeBase:null};
function countResults(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const data = value as {count?:unknown;results?:unknown};
    if (typeof data.count === "number" && Number.isSafeInteger(data.count) && data.count >= 0) return data.count;
    if (Array.isArray(data.results)) return data.results.length;
  }
  return null;
}
export function StaffDashboardView() {
  const { user } = useAuth();
  const [counts,setCounts] = useState<StaffSummaryCounts>(initialCounts);
  const [tickets,setTickets] = useState<StaffRecord[]>([]);
  const [tasks,setTasks] = useState<StaffRecord[]>([]);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{
    let active=true;
    Promise.allSettled(keys.map(key=>staffResourceConfig[key].loader())).then(results=>{
      if(!active)return;
      const next:StaffSummaryCounts={...initialCounts};
      results.forEach((result,index)=>{
        const key=keys[index];
        if(result.status!=="fulfilled")return;
        next[key]=countResults(result.value);
        if(key==="tickets" || key==="provisioning"){
          try {
            const rows=unwrapStaffList(result.value).slice(0,3).map(row=>normalizeStaffRecord(row,key));
            if(key==="tickets")setTickets(rows);
            else setTasks(rows);
          } catch {
            if(key==="tickets")setTickets([]);
            else setTasks([]);
          }
        }
      });
      setCounts(next);
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);
  const firstName=useMemo(()=>{
    const source=user?.name||user?.full_name||"Staff";
    return source.split(" ")[0]||"Staff";
  },[user]);
  return <DashboardShell role="staff" title="Staff Console"
    description="Manage customer operations, provisioning, tickets, orders, and knowledge resources.">
    <div className="space-y-5">
      <StaffHero name={firstName}/>
      <StaffQuickActions/>
      <StaffOverviewMetrics counts={counts} loading={loading}/>
      <WorkspaceGrid variant="overviewPair">
        <StaffRecentPanel title="Support workload" description="Customer conversations requiring staff attention."
          href="/staff/tickets" records={tickets}
          state={loading?"loading":counts.tickets===null?"unavailable":"ready"}/>
        <StaffRecentPanel title="Provisioning queue" description="Automation tasks and manual review items."
          href="/staff/provisioning" records={tasks}
          state={loading?"loading":counts.provisioning===null?"unavailable":"ready"}/>
      </WorkspaceGrid>
    </div>
  </DashboardShell>;
}
