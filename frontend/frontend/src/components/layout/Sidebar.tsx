"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  ChevronDown,
  CreditCard,
  FileText,
  Globe2,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Mail,
  Package,
  Palette,
  Receipt,
  Server,
  Settings,
  Shield,
  ShoppingCart,
  Ticket,
  Users,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { BrandMark } from "./BrandMark";

type ChildNavItem = {
  label: string;
  href: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: ChildNavItem[];
};

const navs: Record<"admin" | "client" | "staff", NavItem[]> = {
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    {
      label: "Customers",
      href: "/admin/customers",
      icon: Users,
      children: [
        { label: "All Customers", href: "/admin/customers" },
        { label: "Add Customer", href: "/admin/customers/new" }
      ]
    },
    {
      label: "Orders",
      href: "/admin/orders",
      icon: ShoppingCart,
      children: [
        { label: "All Orders", href: "/admin/orders" },
        { label: "New Order", href: "/admin/orders/new" }
      ]
    },
    {
      label: "Products",
      href: "/admin/products",
      icon: Package,
      children: [
        { label: "All Products", href: "/admin/products" },
        { label: "Add Product", href: "/admin/products/new" }
      ]
    },
    {
      label: "Plans",
      href: "/admin/plans",
      icon: ListChecks,
      children: [
        { label: "Plans & Pricing", href: "/admin/plans" },
        { label: "Add Plan", href: "/admin/plans/new" }
      ]
    },
    {
      label: "Servers & Adapters",
      href: "/admin/servers",
      icon: Server,
      children: [
        { label: "Servers", href: "/admin/servers" },
        { label: "Add Server", href: "/admin/servers/new" },
        { label: "Provider Settings", href: "/admin/settings/providers" }
      ]
    },
    {
      label: "Provisioning",
      href: "/admin/provisioning",
      icon: Zap,
      children: [
        { label: "Provisioning Queue", href: "/admin/provisioning" },
        { label: "Run Provisioning", href: "/admin/provisioning/run" }
      ]
    },
    {
      label: "Billing",
      href: "/admin/billing",
      icon: Receipt,
      children: [
        { label: "Invoices", href: "/admin/billing/invoices" },
        { label: "Transactions", href: "/admin/billing/transactions" },
        { label: "Services", href: "/admin/billing/services" },
        { label: "Domains", href: "/admin/billing/domains" },
        { label: "Quotes", href: "/admin/billing/quotes" },
        { label: "Batch Billing", href: "/admin/billing/batch" },
        { label: "Print Queue", href: "/admin/billing/print-queue" }
      ]
    },
    {
      label: "Gateways",
      href: "/admin/gateways",
      icon: CreditCard,
      children: [
        { label: "All Gateways", href: "/admin/gateways" },
        { label: "Add Gateway", href: "/admin/gateways/new" },
        { label: "Paystack", href: "/admin/gateways/paystack" }
      ]
    },
    {
      label: "Tools",
      href: "/admin/tools/service-queue",
      icon: Boxes,
      children: [
        { label: "Service Queue", href: "/admin/tools/service-queue" },
        { label: "Blacklist", href: "/admin/tools/blacklist" },
        { label: "Download Manager", href: "/admin/tools/download-manager" },
        { label: "CMS Pages", href: "/admin/tools/cms" },
        { label: "Currency", href: "/admin/tools/currency" },
        { label: "Mass Mailer", href: "/admin/tools/mass-mailer" },
        { label: "Utilities", href: "/admin/tools/utilities" }
      ]
    },
    {
      label: "Support",
      href: "/admin/support",
      icon: LifeBuoy,
      children: [
        { label: "Tickets", href: "/admin/support" },
        { label: "New Ticket", href: "/admin/support/new" },
        { label: "Departments", href: "/admin/support/departments" },
        { label: "Responses", href: "/admin/support/responses" },
        { label: "Support Staff", href: "/admin/support/staff" }
      ]
    },
    {
      label: "Staff",
      href: "/admin/staff",
      icon: Users,
      children: [
        { label: "All Staff", href: "/admin/staff" },
        { label: "Add Staff", href: "/admin/staff/new" }
      ]
    },
    { label: "Knowledge Base", href: "/admin/knowledge-base", icon: BookOpen },
    { label: "Invoice Designer", href: "/admin/invoice-designer", icon: Palette },
    { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
    {
      label: "Settings",
      href: "/admin/settings",
      icon: Settings,
      children: [
        { label: "General", href: "/admin/settings/general" },
        { label: "Security", href: "/admin/settings/security" },
        { label: "Social Login", href: "/admin/settings/social-login" },
        { label: "Tax", href: "/admin/settings/tax" },
        { label: "Mail", href: "/admin/settings/mail" },
        { label: "Tickets", href: "/admin/settings/tickets" },
        { label: "Cron Jobs", href: "/admin/settings/cron-jobs" },
        { label: "Credits", href: "/admin/settings/credits" },
        { label: "Theme", href: "/admin/settings/theme" },
        { label: "Invoices", href: "/admin/settings/invoices" },
        { label: "Other", href: "/admin/settings/other" },
        { label: "API Keys", href: "/admin/settings/api-keys" },
        { label: "Notifications", href: "/admin/settings/notifications" }
      ]
    }
  ],

  client: [
    { label: "Dashboard", href: "/client", icon: LayoutDashboard },
    { label: "Order Services", href: "/client/order", icon: ShoppingCart },
    {
      label: "My Services",
      href: "/client/services",
      icon: Server,
      children: [
        { label: "All Services", href: "/client/services" },
        { label: "Order New Service", href: "/client/order" }
      ]
    },
    { label: "Domains", href: "/client/domains", icon: Globe2 },
    { label: "Invoices", href: "/client/invoices", icon: Receipt },
    { label: "Wallet", href: "/client/wallet", icon: Wallet },
    {
      label: "Support",
      href: "/client/support",
      icon: LifeBuoy,
      children: [
        { label: "My Tickets", href: "/client/support" },
        { label: "Open Ticket", href: "/client/support/new" }
      ]
    },
    { label: "Knowledge Base", href: "/client/knowledge-base", icon: BookOpen },
    { label: "Account Settings", href: "/client/profile", icon: Users }
  ],

  staff: [
    { label: "Dashboard", href: "/staff", icon: LayoutDashboard },
    { label: "Tickets", href: "/staff/tickets", icon: Ticket },
    { label: "Orders", href: "/staff/orders", icon: ShoppingCart },
    { label: "Customers", href: "/staff/customers", icon: Users },
    { label: "Provisioning", href: "/staff/provisioning", icon: Zap },
    { label: "Knowledge Base", href: "/staff/knowledge-base", icon: BookOpen },
    { label: "Security", href: "/staff/security", icon: Shield }
  ]
};

function isNavActive(pathname: string, item: NavItem) {
  if (item.href === "/admin" || item.href === "/client" || item.href === "/staff") {
    return pathname === item.href;
  }

  if (pathname.startsWith(item.href)) return true;

  return Boolean(item.children?.some((child) => pathname.startsWith(child.href)));
}

export function Sidebar({
  area,
  mobileOpen,
  onClose
}: {
  area: "admin" | "client" | "staff";
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className={mobileOpen ? "oct-sidebar-backdrop open" : "oct-sidebar-backdrop"}
        aria-label="Close sidebar"
        onClick={onClose}
      />

      <aside className={mobileOpen ? "oct-sidebar mobile-open" : "oct-sidebar"}>
        <div className="oct-sidebar-top">
          <Link className="oct-sidebar-logo" href={`/${area}`} onClick={onClose}>
            <BrandMark />
            <div>
              <div className="oct-sidebar-title">Octalve Console</div>
              <div className="oct-sidebar-sub">Cloud business OS</div>
            </div>
          </Link>

          <button type="button" className="oct-sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="oct-sidebar-section">{area} console</div>

        <nav className="oct-nav-list">
          {navs[area].map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item);
            const childrenOpen = Boolean(item.children?.some((child) => pathname.startsWith(child.href))) || active;

            return (
              <div key={item.href} className={childrenOpen && item.children ? "oct-nav-group open" : "oct-nav-group"}>
                <div className={active ? "oct-nav-row active" : "oct-nav-row"}>
                  <Link className="oct-nav-main" href={item.href} onClick={onClose}>
                    <Icon size={19} />
                    <span>{item.label}</span>
                  </Link>

                  {item.children ? (
                    <span className="oct-nav-chevron">
                      <ChevronDown size={15} />
                    </span>
                  ) : null}
                </div>

                {item.children ? (
                  <div className="oct-subnav">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={childActive ? "oct-subnav-link active" : "oct-subnav-link"}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="oct-sidebar-help">
          <div className="oct-help-icon">
            <Headphones size={18} />
          </div>
          <div>
            <strong>Need help?</strong>
            <span>24/7 cloud support</span>
          </div>
        </div>

        <div className="oct-sidebar-footer">
          
        </div>
      </aside>
    </>
  );
}


