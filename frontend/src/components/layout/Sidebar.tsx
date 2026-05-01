"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { BarChart3, BookOpen, Boxes, Building2, CreditCard, FileText, Gauge, Globe2, Headphones, KeyRound, LayoutDashboard, LifeBuoy, ListChecks, Mail, Package, Palette, Receipt, Server, Settings, Shield, ShoppingCart, Ticket, Users, Wallet, Zap } from "lucide-react";
import type { ComponentType } from "react";

type NavItem = { label: string; href: string; icon: ComponentType<{ size?: number }> };

const iconMap = { dashboard: LayoutDashboard, customers: Users, orders: ShoppingCart, products: Package, plans: ListChecks, servers: Server, provisioning: Zap, billing: Receipt, gateways: CreditCard, affiliates: Globe2, tools: Boxes, support: LifeBuoy, staff: Users, kb: BookOpen, invoice: Palette, reports: BarChart3, audit: FileText, settings: Settings, wallet: Wallet, services: Server, domains: Globe2, profile: Users, security: Shield, tickets: Ticket, mail: Mail, keys: KeyRound, help: Headphones };

const navs: Record<string, NavItem[]> = {
  admin: [
    { label: "Overview", href: "/admin", icon: iconMap.dashboard },
    { label: "Customers", href: "/admin/customers", icon: iconMap.customers },
    { label: "Orders", href: "/admin/orders", icon: iconMap.orders },
    { label: "Products", href: "/admin/products", icon: iconMap.products },
    { label: "Plans", href: "/admin/plans", icon: iconMap.plans },
    { label: "Servers & Adapters", href: "/admin/servers", icon: iconMap.servers },
    { label: "Provisioning", href: "/admin/provisioning", icon: iconMap.provisioning },
    { label: "Billing", href: "/admin/billing", icon: iconMap.billing },
    { label: "Gateways", href: "/admin/gateways", icon: iconMap.gateways },
    { label: "Affiliates", href: "/admin/affiliates", icon: iconMap.affiliates },
    { label: "Tools", href: "/admin/tools/service-queue", icon: iconMap.tools },
    { label: "Support", href: "/admin/support", icon: iconMap.support },
    { label: "Staff", href: "/admin/staff", icon: iconMap.staff },
    { label: "Knowledge Base", href: "/admin/knowledge-base", icon: iconMap.kb },
    { label: "Invoice Designer", href: "/admin/invoice-designer", icon: iconMap.invoice },
    { label: "Reports", href: "/admin/reports", icon: iconMap.reports },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: iconMap.audit },
    { label: "Settings", href: "/admin/settings", icon: iconMap.settings }
  ],
  client: [
    { label: "Dashboard", href: "/client", icon: iconMap.dashboard },
    { label: "Order Services", href: "/client/order", icon: iconMap.orders },
    { label: "My Services", href: "/client/services", icon: iconMap.services },
    { label: "Domains", href: "/client/domains", icon: iconMap.domains },
    { label: "Invoices", href: "/client/invoices", icon: iconMap.billing },
    { label: "Wallet", href: "/client/wallet", icon: iconMap.wallet },
    { label: "Support", href: "/client/support", icon: iconMap.support },
    { label: "Knowledge Base", href: "/client/knowledge-base", icon: iconMap.kb },
    { label: "Profile", href: "/client/profile", icon: iconMap.profile }
  ],
  staff: [
    { label: "Dashboard", href: "/staff", icon: iconMap.dashboard },
    { label: "Tickets", href: "/staff/tickets", icon: iconMap.tickets },
    { label: "Orders", href: "/staff/orders", icon: iconMap.orders },
    { label: "Customers", href: "/staff/customers", icon: iconMap.customers },
    { label: "Provisioning", href: "/staff/provisioning", icon: iconMap.provisioning },
    { label: "Knowledge Base", href: "/staff/knowledge-base", icon: iconMap.kb },
    { label: "Security", href: "/staff/security", icon: iconMap.security }
  ]
};

export function Sidebar({ area }: { area: "admin" | "client" | "staff" }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link className="sidebar-logo" href={`/${area}`}>
        <BrandMark />
        <div>
          <div className="sidebar-title">Octalve Console</div>
          <div className="brand-sub">Cloud business OS</div>
        </div>
      </Link>
      <div className="sidebar-section">{area} console</div>
      <nav className="nav-list">
        {navs[area].map((item) => {
          const Icon = item.icon;
          const active = item.href === `/${area}` ? pathname === item.href : pathname.startsWith(item.href);
          return <Link key={item.href} className={active ? "nav-item active" : "nav-item"} href={item.href}><Icon size={19} /><span>{item.label}</span></Link>;
        })}
      </nav>
      <div className="sidebar-footer">Adapter-first architecture. Billing, domains and provisioning stay provider-independent.</div>
    </aside>
  );
}
