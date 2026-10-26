"use client";

import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export type PremiumTableStat = {
  label: string;
  value: string;
  helper?: string;
};

export type PremiumTableFilter = {
  label: string;
  value: string;
};

export type PremiumTableColumn<T> = {
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export type PremiumTableAction<T> = {
  label: string;
  href?: (row: T) => string;
  onClick?: (row: T) => void;
  tone?: "default" | "danger";
};

export function cleanCurrency(value: string | number | undefined | null) {
  return String(value ?? "").replace(/â‚¦/g, "₦");
}

export function getPremiumStatusTone(status: string) {
  const value = status.toLowerCase();

  if (
    value.includes("active") ||
    value.includes("paid") ||
    value.includes("approved") ||
    value.includes("provisioned") ||
    value.includes("ready") ||
    value.includes("synced")
  ) {
    return "success";
  }

  if (
    value.includes("pending") ||
    value.includes("waiting") ||
    value.includes("unpaid") ||
    value.includes("draft") ||
    value.includes("planned") ||
    value.includes("test")
  ) {
    return "warning";
  }

  if (
    value.includes("failed") ||
    value.includes("cancelled") ||
    value.includes("suspended") ||
    value.includes("disabled") ||
    value.includes("closed") ||
    value.includes("archived")
  ) {
    return "danger";
  }

  return "neutral";
}

export function PremiumStatusPill({ status }: { status: string }) {
  return (
    <span className={`premium-status-pill ${getPremiumStatusTone(status)}`}>
      <i />
      {status}
    </span>
  );
}

export function AdminPremiumTable<T>({
  title,
  description,
  rows,
  rowKey,
  columns,
  stats = [],
  filters = [{ label: "All", value: "all" }],
  filterValue,
  searchPlaceholder = "Search records...",
  searchText,
  primaryAction,
  rowActions = [],
  emptyTitle = "No records found",
  emptyDescription = "Try changing your search or filter.",
}: {
  title: string;
  description?: string;
  rows: T[];
  rowKey: (row: T) => string;
  columns: PremiumTableColumn<T>[];
  stats?: PremiumTableStat[];
  filters?: PremiumTableFilter[];
  filterValue?: (row: T) => string;
  searchPlaceholder?: string;
  searchText: (row: T) => string;
  primaryAction?: {
    label: string;
    href: (row: T) => string;
  };
  rowActions?: PremiumTableAction<T>[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(filters[0]?.value ?? "all");
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = normalizedQuery
        ? searchText(row).toLowerCase().includes(normalizedQuery)
        : true;

      const currentFilterValue = filterValue ? filterValue(row) : "all";
      const matchesFilter =
        activeFilter === "all" || currentFilterValue === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, filterValue, query, rows, searchText]);

  return (
    <section className="premium-admin-section">
      {stats.length ? (
        <div className="premium-admin-stats">
          {stats.map((stat) => (
            <article className="premium-admin-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              {stat.helper ? <p>{stat.helper}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="premium-table-card">
        <div className="premium-table-head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>

          <div className="premium-table-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
        </div>

        <div className="premium-table-filter-row">
          <div className="premium-table-filters">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={activeFilter === filter.value ? "active" : ""}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <span className="premium-table-count">
            {visibleRows.length} result{visibleRows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="hidden lg:block"><div className="premium-table-scroll">
          <table className="premium-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.label} className={column.className}>
                    {column.label}
                  </th>
                ))}
                <th className="premium-actions-column">Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => {
                const key = rowKey(row);

                return (
                  <tr key={key}>
                    {columns.map((column) => (
                      <td key={`${key}-${column.label}`} className={column.className}>
                        {column.render(row)}
                      </td>
                    ))}

                    <td className="premium-actions-column">
                      <div className="premium-row-actions">
                        {primaryAction ? (
                          <Link className="premium-primary-action" href={primaryAction.href(row)}>
                            {primaryAction.label}
                          </Link>
                        ) : null}

                        {rowActions.length ? (
                          <div className="premium-row-menu-wrap">
                            <button
                              type="button"
                              className="premium-row-menu-button"
                              onClick={() => setOpenRowKey(openRowKey === key ? null : key)}
                              aria-label="More actions"
                            >
                              <ChevronDown size={17} />
                            </button>

                            {openRowKey === key ? (
                              <div className="premium-row-menu">
                                {rowActions.map((action) =>
                                  action.href ? (
                                    <Link
                                      key={action.label}
                                      href={action.href(row)}
                                      className={action.tone === "danger" ? "danger" : ""}
                                      onClick={() => setOpenRowKey(null)}
                                    >
                                      {action.label}
                                    </Link>
                                  ) : (
                                    <button
                                      key={action.label}
                                      type="button"
                                      className={action.tone === "danger" ? "danger" : ""}
                                      onClick={() => {
                                        action.onClick?.(row);
                                        setOpenRowKey(null);
                                      }}
                                    >
                                      {action.label}
                                    </button>
                                  )
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!visibleRows.length ? (
            <div className="premium-table-empty">
              <strong>{emptyTitle}</strong>
              <p>{emptyDescription}</p>
            </div>
          ) : null}
        </div></div>
        <div className="space-y-3 px-3 pb-4 lg:hidden" aria-label={title+" mobile records"}>
          {visibleRows.map(row=>{
            const key=rowKey(row);
            return <article key={key} className="rounded-2xl border border-slate-100 bg-[#F7F9FC] p-4 shadow-[0_2px_8px_rgba(5,25,48,.025)]">
              <div className="space-y-3">
                {columns.map((column,index)=><div key={column.label} className={index===0?"border-b border-slate-200 pb-3":"flex items-start justify-between gap-4"}>
                  <span className={index===0?"block text-[10px] font-bold uppercase tracking-wider text-slate-400":"max-w-[40%] shrink-0 text-xs font-medium text-slate-500"}>{column.label}</span>
                  <div className={index===0?"mt-1 text-sm font-bold text-[#142A43]":"min-w-0 text-right text-sm font-semibold text-[#142A43]"}>{column.render(row)}</div>
                </div>)}
              </div>
              {(primaryAction||rowActions.length>0)&&<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                {primaryAction&&<Link href={primaryAction.href(row)} className="rounded-xl bg-[#0064E0] px-4 py-2.5 text-xs font-semibold text-white">{primaryAction.label}</Link>}
                {rowActions.map(action=>action.href?
                  <Link key={action.label} href={action.href(row)} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${action.tone==="danger"?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-white text-slate-700"}`}>{action.label}</Link>:
                  <button key={action.label} type="button" onClick={()=>action.onClick?.(row)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${action.tone==="danger"?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-white text-slate-700"}`}>{action.label}</button>)}
              </div>}
            </article>;
          })}
          {visibleRows.length===0&&<p className="rounded-xl bg-slate-50 p-7 text-center text-sm text-slate-500">{emptyTitle}. {emptyDescription}</p>}
        </div>
      </div>
    </section>
  );
}
