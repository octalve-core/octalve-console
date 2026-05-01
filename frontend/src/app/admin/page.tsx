import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { orders, invoices, services, tickets } from "@/lib/platform-data";
import { CreditCard, Receipt, Server, Ticket } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <main className="page-container">
      <PageHeader title="Admin Console" description="Run Octalve Cloud billing, customers, orders, provisioning, gateways, support and provider automation from one clean workspace." actions={<><Button href="/admin/orders/new">New Order</Button><Button href="/admin/settings/providers" variant="secondary">Provider Settings</Button></>} />
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard label="Monthly revenue" value="₦42,500" icon={<Receipt size={22} />} />
        <StatCard label="Active services" value={String(services.length)} icon={<Server size={22} />} />
        <StatCard label="Open tickets" value={String(tickets.length)} icon={<Ticket size={22} />} />
        <StatCard label="Gateways live" value="2" icon={<CreditCard size={22} />} />
      </div>
      <div className="grid cols-2">
        <DataTable title="Recent orders" columns={[{header:"Order", accessor:"id"},{header:"Customer", accessor:"customer"},{header:"Product", accessor:"product"},{header:"Total", accessor:"total"},{header:"Status", accessor:"status"}]} rows={orders.map((row) => ({ ...row, href: `/admin/orders/${row.id}`, editHref: `/admin/orders/${row.id}` }))} />
        <DataTable title="Recent invoices" columns={[{header:"Invoice", accessor:"id"},{header:"Client", accessor:"client"},{header:"Total", accessor:"total"},{header:"Due", accessor:"due"},{header:"Status", accessor:"status"}]} rows={invoices.map((row) => ({ ...row, href: `/admin/billing/invoices/${row.id}`, editHref: `/admin/billing/invoices/${row.id}` }))} />
      </div>
    </main>
  );
}
