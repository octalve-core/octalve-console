"use client";

import { Bell, Command, Menu, Search, UserCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type DashboardTopbarProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  onMenuClick?: () => void;
  className?: string;
};

export function DashboardTopbar({
  title,
  description,
  actions,
  onMenuClick,
  className,
}: DashboardTopbarProps) {
  const { user } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-slate-200/80 bg-[#F6F8FB]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden h-12 w-full max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-400 shadow-sm xl:flex">
          <Search className="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">Search customers, invoices, domains...</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-400">
            <Command className="h-3 w-3" /> K
          </span>
        </div>

        <div className="min-w-0 flex-1 xl:hidden">
          <h1 className="truncate text-xl font-medium tracking-[-0.03em] text-slate-950 sm:text-2xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-1 hidden truncate text-sm text-slate-500 sm:block">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="hidden items-center gap-3 md:flex">{actions}</div> : null}

        <button
          type="button"
          className="relative hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 sm:flex"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[0.65rem] font-medium text-white">
            3
          </span>
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
            <UserCircle className="h-5 w-5" />
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="max-w-[9rem] truncate text-sm font-medium text-slate-950">
              {user?.name ?? "Octalve User"}
            </p>
            <p className="text-xs capitalize text-slate-500">{user?.role ?? "client"}</p>
          </div>
        </div>
      </div>

      {actions ? <div className="mt-4 flex flex-wrap gap-3 md:hidden">{actions}</div> : null}
    </header>
  );
}