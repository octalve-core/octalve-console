"use client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, LifeBuoy, ShoppingCart, Users, Zap } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import { useAuth } from "@/context/AuthContext";
import { formatNumber } from "@/lib/formatters";
import { StaffHero } from "../components/StaffHero";
import { StaffSectionCard } from "../components/StaffSectionCard";
import { staffResourceConfig } from "../data/staff-resource-config";
import type { StaffRecord, StaffResourceKey } from "../data/staff-demo-data";
import { normalizeStaffRecord, unwrapStaffList } from "../utils/staff-record-normalizer";

const keys = ["customers", "orders", "provisioning", "tickets", "knowledgeBase"] as const;
type SummaryCounts = Record<StaffResourceKey, number | null>;
const initialCounts: SummaryCounts = {customers:null,orders:null,provisioning:null,tickets:null,knowledgeBase:null};
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
  const [counts,setCounts] = useState<SummaryCounts>(initialCounts);
  const [tickets,setTickets] = useState<StaffRecord[]>([]);
  const [tasks,setTasks] = useState<StaffRecord[]>([]);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{
    let active=true;
    Promise.allSettled(keys.map(key=>staffResourceConfig[key].loader())).then(results=>{
      if(!active)return;
      const next:SummaryCounts={...initialCounts};
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
  const show=(value:number|null)=>loading?"…":value===null?"—":formatNumber(value);
  return <DashboardShell role="staff" title="Staff workspace"
    description="Manage customer operations, provisioning, tickets, orders, and knowledge resources.">
    <div className="space-y-6">
      <StaffHero name={firstName}/>
      <div aria-busy={loading}>
        <ResponsiveGrid columns="4">
          <MetricCard label="Assigned customers" accent="blue" value={show(counts.customers)}
            description="Accounts needing support" icon={<Users className="h-5 w-5"/>}/>
          <MetricCard label="Orders" accent="orange" value={show(counts.orders)}
            description="Orders needing action" icon={<ShoppingCart className="h-5 w-5"/>}/>
          <MetricCard label="Provisioning tasks" accent="purple" value={show(counts.provisioning)}
            description="Automation queue" icon={<Zap className="h-5 w-5"/>}/>
          <MetricCard label="Tickets" accent="rose" value={show(counts.tickets)}
            description="Support workload" icon={<LifeBuoy className="h-5 w-5"/>}/>
          <MetricCard label="Knowledge articles" accent="green" value={show(counts.knowledgeBase)}
            description="Internal support guides" icon={<BookOpen className="h-5 w-5"/>}/>
        </ResponsiveGrid>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <StaffSectionCard title="Support workload" description="Customer conversations requiring staff attention."
          href="/staff/tickets" records={tickets}/>
        <StaffSectionCard title="Provisioning queue" description="Automation tasks and manual review items."
          href="/staff/provisioning" records={tasks}/>
      </div>
    </div>
  </DashboardShell>;
}
