"use client";

import { Headphones, Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  queue: string;
  status: string;
};

const staffRows: StaffRow[] = [
  {
    id: "STF-001",
    name: "Octalve Admin",
    email: "admin@octalve.cloud",
    role: "Admin",
    department: "Operations",
    queue: "All queues",
    status: "Active",
  },
  {
    id: "STF-002",
    name: "Octalve Staff",
    email: "staff@octalve.cloud",
    role: "Staff",
    department: "Support",
    queue: "Tickets and provisioning",
    status: "Active",
  },
  {
    id: "STF-003",
    name: "Billing Officer",
    email: "billing@octalve.cloud",
    role: "Staff",
    department: "Billing",
    queue: "Invoices and transactions",
    status: "Pending",
  },
];

const staffFilters = [
  { label: "All staff", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Pending", value: "Pending" },
];

export default function Page() {
  const active = staffRows.filter((item) => item.status === "Active").length;
  const departments = new Set(staffRows.map((item) => item.department)).size;

  return (
    <main className="page-container">
      <PageHeader
        title="Staff"
        description="Manage internal users, role access, support assignment, billing permissions and provisioning responsibility."
        actions={<Button href="/admin/staff/new">+ Add Staff</Button>}
      />

      <AdminPremiumTable<StaffRow>
        title="Team Access"
        description="Staff accounts should be permission-based and restricted by role, department and assigned queue."
        rows={staffRows}
        rowKey={(row) => row.id}
        searchPlaceholder="Search staff, email, department..."
        searchText={(row) =>
          `${row.id} ${row.name} ${row.email} ${row.role} ${row.department} ${row.queue} ${row.status}`
        }
        filters={staffFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Staff", value: String(staffRows.length), helper: "Internal users" },
          { label: "Active", value: String(active), helper: "Can access workspace" },
          { label: "Departments", value: String(departments), helper: "Operational groups" },
          { label: "RBAC", value: "Ready", helper: "Role access control required" },
        ]}
        columns={[
          {
            label: "Staff Member",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <UserRound size={21} />
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.id} · {row.role}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Email",
            render: (row) => (
              <div className="premium-mini-meta">
                <Mail size={16} />
                <span>{row.email}</span>
              </div>
            ),
          },
          {
            label: "Department",
            render: (row) => (
              <div className="premium-mini-meta">
                <Headphones size={16} />
                <span>{row.department}</span>
              </div>
            ),
          },
          {
            label: "Assigned Queue",
            render: (row) => (
              <div className="premium-mini-meta">
                <ShieldCheck size={16} />
                <span>{row.queue}</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => <PremiumStatusPill status={row.status} />,
          },
        ]}
        primaryAction={{
          label: "Manage",
          href: (row) => `/admin/staff/${row.id}`,
        }}
        rowActions={[
          { label: "Edit staff", href: (row) => `/admin/staff/${row.id}` },
          { label: "Permissions", href: (row) => `/admin/staff/${row.id}` },
          { label: "Assign queue" },
          { label: "Disable access", tone: "danger" },
        ]}
      />
    </main>
  );
}
