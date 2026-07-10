"use client";

import { useMemo } from "react";
import { BookOpen, LifeBuoy, ShoppingCart, Users, Zap } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import { useAuth } from "@/context/AuthContext";
import { formatNumber } from "@/lib/formatters";
import { getFallbackData } from "@/lib/config/data-source";
import { StaffHero } from "../components/StaffHero";
import { StaffSectionCard } from "../components/StaffSectionCard";
import { staffDemo } from "../data/staff-demo-data";

export function StaffDashboardView() {
  const { user } = useAuth();

  const firstName = useMemo(() => {
    const source = user?.name || user?.full_name || "Staff";
    return source.split(" ")[0] || "Staff";
  }, [user]);

  const customers = getFallbackData(staffDemo.customers);
  const orders = getFallbackData(staffDemo.orders);
  const provisioning = getFallbackData(staffDemo.provisioning);
  const tickets = getFallbackData(staffDemo.tickets);
  const knowledgeBase = getFallbackData(staffDemo.knowledgeBase);

  return (
    <DashboardShell
      role="staff"
      title="Staff workspace"
      description="Manage customer operations, provisioning, tickets, orders, and knowledge resources."
    >
      <div className="space-y-6">
        <StaffHero name={firstName} />

        <ResponsiveGrid columns="4">
          <MetricCard
            label="Assigned customers"
            value={formatNumber(customers.length)}
            description="Accounts needing support"
            icon={<Users className="h-5 w-5" />}
          />
          <MetricCard
            label="Orders"
            value={formatNumber(orders.length)}
            description="Orders needing action"
            icon={<ShoppingCart className="h-5 w-5" />}
          />
          <MetricCard
            label="Provisioning tasks"
            value={formatNumber(provisioning.length)}
            description="Automation queue"
            icon={<Zap className="h-5 w-5" />}
          />
          <MetricCard
            label="Tickets"
            value={formatNumber(tickets.length)}
            description="Support workload"
            icon={<LifeBuoy className="h-5 w-5" />}
          />
          <MetricCard
            label="Knowledge articles"
            value={formatNumber(knowledgeBase.length)}
            description="Internal support guides"
            icon={<BookOpen className="h-5 w-5" />}
          />
        </ResponsiveGrid>

        <div className="grid gap-5 xl:grid-cols-2">
          <StaffSectionCard
            title="Support workload"
            description="Customer conversations requiring staff attention."
            href="/staff/tickets"
            records={tickets}
          />

          <StaffSectionCard
            title="Provisioning queue"
            description="Automation tasks and manual review items."
            href="/staff/provisioning"
            records={provisioning}
          />
        </div>
      </div>
    </DashboardShell>
  );
}