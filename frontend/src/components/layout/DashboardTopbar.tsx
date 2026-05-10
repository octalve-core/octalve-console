"use client";

import { Bell, Menu, Search, UserCircle } from "lucide-react";
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
        "sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-medium tracking-[-0.03em] text-slate-950 sm:text-2xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-1 hidden truncate text-sm text-slate-500 sm:block">{description}</p>
          ) : null}
        </div>

        <div className="hidden h-11 w-full max-w-xs items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-400 xl:flex">
          <Search className="h-4 w-4" />
          <span>Search console...</span>
        </div>

        {actions ? <div className="hidden items-center gap-3 md:flex">{actions}</div> : null}

        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 sm:flex"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <UserCircle className="h-5 w-5 text-slate-400" />

          <div className="hidden min-w-0 sm:block">
            <p className="max-w-[8rem] truncate text-xs font-medium text-slate-950">
              {user?.name ?? "Octalve User"}
            </p>
            <p className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
              {user?.role ?? "client"}
            </p>
          </div>
        </div>
      </div>

      {actions ? <div className="mt-4 flex flex-wrap gap-3 md:hidden">{actions}</div> : null}
    </header>
  );
}