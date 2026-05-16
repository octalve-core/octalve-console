"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Boxes,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  PackageCheck,
  ReceiptText,
  Server,
  Settings,
  Shield,
  ShoppingCart,
  Ticket,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDashboardHome,
  getDashboardNavGroups,
  type DashboardNavIcon,
  type DashboardRole,
} from "@/lib/navigation/dashboard-nav";

type DashboardSidebarProps = {
  role: DashboardRole;
  isOpen?: boolean;
  onClose?: () => void;
};

const iconMap: Record<DashboardNavIcon, LucideIcon> = {
  layoutDashboard: LayoutDashboard,
  users: Users,
  boxes: Boxes,
  listChecks: ListChecks,
  receiptText: ReceiptText,
  creditCard: CreditCard,
  globe2: Globe2,
  server: Server,
  zap: Zap,
  lifeBuoy: LifeBuoy,
  bookOpen: BookOpen,
  settings: Settings,
  shield: Shield,
  barChart3: BarChart3,
  walletCards: WalletCards,
  shoppingCart: ShoppingCart,
  userRound: UserRound,
  ticket: Ticket,
  packageCheck: PackageCheck,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin" || href === "/client" || href === "/staff") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(href + "/");
}

export function DashboardSidebar({ role, isOpen = false, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const groups = getDashboardNavGroups(role);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[19rem] flex-col overflow-hidden border-r border-white/10 bg-[#00172F] text-white shadow-2xl shadow-slate-950/20 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#0064E0]/25 to-transparent" />
        <div className="relative flex h-20 items-center justify-between px-5">
          <Link href={getDashboardHome(role)} className="flex items-center gap-3">
            <span className="grid h-11 w-11 grid-cols-2 gap-1 rounded-2xl bg-white p-2 shadow-sm">
              <span className="rounded-full bg-[#0064E0]" />
              <span className="rounded-full bg-[#E61525]" />
              <span className="rounded-full bg-[#29BE3E]" />
              <span className="rounded-full bg-[#FC7E24]" />
            </span>

            <span>
              <span className="block text-sm font-semibold text-white">Octalve Console</span>
              <span className="block text-xs text-slate-400">Cloud business OS</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {group.title}
              </p>

              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon];
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                        active
                          ? "bg-[#0064E0] text-white shadow-lg shadow-blue-950/25"
                          : "text-slate-300 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-white" : "text-slate-500 group-hover:text-white",
                        )}
                      />

                      <span className="min-w-0 flex-1 truncate">{item.label}</span>

                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[0.65rem]",
                            active ? "bg-white/20 text-white" : "bg-white/10 text-slate-300",
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative p-4">
          <div className="rounded-[1.4rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-medium text-white">Need help?</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              24/7 cloud support for billing, services, domains and provisioning.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}