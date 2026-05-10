"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  ChevronDown,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Search,
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
import { useAuth } from "@/context/AuthContext";
import {
  getDashboardNavGroups,
  type DashboardNavIcon,
  type DashboardRole,
} from "@/lib/navigation/dashboard-nav";

type DashboardShellProps = {
  role: DashboardRole;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
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

function getRoleLabel(role: DashboardRole) {
  if (role === "admin") return "Admin Console";
  if (role === "staff") return "Staff Workspace";
  return "Client Console";
}

function getRoleName(role: DashboardRole) {
  if (role === "admin") return "Octalve Admin";
  if (role === "staff") return "Octalve Staff";
  return "Octalve Client";
}

export function DashboardShell({
  role,
  title,
  description,
  actions,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navGroups = useMemo(() => getDashboardNavGroups(role), [role]);

  const displayName =
    user?.name ||
    user?.full_name ||
    getRoleName(role);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const sidebar = (
    <aside className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href={`/${role}`} className="flex items-center gap-3">
          <div className="grid h-11 w-11 grid-cols-2 gap-1 rounded-2xl bg-white p-2 shadow-soft">
            <span className="rounded-full bg-[#0064E0]" />
            <span className="rounded-full bg-[#E61525]" />
            <span className="rounded-full bg-[#FC7E24]" />
            <span className="rounded-full bg-[#29BE3E]" />
          </div>

          <div>
            <p className="text-sm font-semibold tracking-[-0.03em] text-white">
              Octalve Console
            </p>
            <p className="text-xs text-slate-400">Cloud business OS</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-slate-300 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-4 pb-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {group.title}
            </p>

            <div className="mt-3 space-y-1">
              {group.items.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${role}` && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                      isActive
                        ? "bg-[#0064E0] text-white shadow-lg shadow-blue-950/20"
                        : "text-slate-300 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
              <LifeBuoy className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Need help?</p>
              <p className="truncate text-xs text-slate-400">
                24/7 cloud support
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-950">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[18.5rem] lg:block">
        {sidebar}
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
          <div className="relative h-full w-[18.5rem] max-w-[86vw]">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[18.5rem]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F6F8FB]/90 backdrop-blur-xl">
          <div className="flex min-h-20 items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden h-12 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm md:flex">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                placeholder="Search customers, invoices, domains..."
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <span className="hidden rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-400 sm:inline">
                âŒ˜ K
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {actions}

              <button
                type="button"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-semibold text-white">
                  3
                </span>
              </button>

              <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                  <UserRound className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">
                    {displayName}
                  </p>
                  <p className="text-xs capitalize text-slate-500">{role}</p>
                </div>

                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <span className="sr-only">
            {getRoleLabel(role)} {title} {description ?? ""}
          </span>

          {children}
        </main>
      </div>
    </div>
  );
}