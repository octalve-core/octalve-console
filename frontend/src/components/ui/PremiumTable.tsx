"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";

export type PremiumTableColumn<T> = {
  key: string;
  header: string;
  accessor?: keyof T;
  render?: (row: T) => ReactNode;
  className?: string;
};

export type PremiumTableAction<T> = {
  label: string;
  href?: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  onClick?: (row: T) => void;
};

export type PremiumTableFilter = {
  label: string;
  value: string;
};

type PremiumTableProps<T extends { id: string }> = {
  title: string;
  description?: string;
  countLabel?: string;
  rows: T[];
  columns: PremiumTableColumn<T>[];
  filters?: PremiumTableFilter[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchKeys?: Array<keyof T>;
  primaryAction?: ReactNode;
  rowActions?: (row: T) => PremiumTableAction<T>[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function PremiumTable<T extends { id: string }>({
  title,
  description,
  countLabel,
  rows,
  columns,
  filters,
  activeFilter,
  onFilterChange,
  searchPlaceholder = "Search records...",
  searchKeys,
  primaryAction,
  rowActions,
  emptyTitle = "No records found",
  emptyDescription = "Try another search or filter.",
}: PremiumTableProps<T>) {
  const [query, setQuery] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return rows;

    return rows.filter((row) => {
      const keys = searchKeys?.length
        ? searchKeys
        : (Object.keys(row) as Array<keyof T>);

      return keys.some((key) =>
        String(row[key] ?? "").toLowerCase().includes(value)
      );
    });
  }, [query, rows, searchKeys]);

  return (
    <section className="premium-table-panel">
      <div className="premium-table-head">
        <div>
          <div className="premium-table-title-row">
            <h2>{title}</h2>
            <span>{countLabel ?? visibleRows.length}</span>
          </div>

          {description ? <p>{description}</p> : null}
        </div>

        {primaryAction ? <div>{primaryAction}</div> : null}
      </div>

      <div className="premium-table-controls">
        {filters?.length ? (
          <div className="premium-table-filters">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={activeFilter === filter.value ? "active" : ""}
                onClick={() => onFilterChange?.(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : <div />}

        <label className="premium-table-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      </div>

      <div className="hidden lg:block"><div className="premium-table-wrap">
        <div
          className="premium-table-grid premium-table-grid-head"
          style={{ gridTemplateColumns: `repeat(${columns.length + (rowActions ? 1 : 0)}, minmax(140px, 1fr))` }}
        >
          {columns.map((column) => (
            <span key={column.key} className={column.className}>
              {column.header}
            </span>
          ))}

          {rowActions ? <span>Actions</span> : null}
        </div>

        {visibleRows.map((row) => {
          const actions = rowActions?.(row) ?? [];
          const isOpen = openActionId === row.id;

          return (
            <div
              key={row.id}
              className="premium-table-grid premium-table-row"
              style={{ gridTemplateColumns: `repeat(${columns.length + (rowActions ? 1 : 0)}, minmax(140px, 1fr))` }}
            >
              {columns.map((column) => (
                <div key={column.key} className={column.className}>
                  {column.render
                    ? column.render(row)
                    : column.accessor
                      ? String(row[column.accessor] ?? "")
                      : null}
                </div>
              ))}

              {rowActions ? (
                <div className="premium-row-action-wrap">
                  <button
                    type="button"
                    className="premium-row-action-button"
                    onClick={() => setOpenActionId(isOpen ? null : row.id)}
                    aria-expanded={isOpen}
                  >
                    Actions
                    <ChevronDown size={16} className={isOpen ? "open" : ""} />
                  </button>

                  {isOpen ? (
                    <div className="premium-row-action-menu">
                      {actions.map((action) => {
                        const content = (
                          <>
                            {action.icon}
                            <span>{action.label}</span>
                          </>
                        );

                        if (action.href) {
                          return (
                            <Link
                              key={action.label}
                              href={action.href}
                              className={action.tone === "danger" ? "danger" : ""}
                            >
                              {content}
                            </Link>
                          );
                        }

                        return (
                          <button
                            key={action.label}
                            type="button"
                            className={action.tone === "danger" ? "danger" : ""}
                            onClick={() => action.onClick?.(row)}
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {visibleRows.length === 0 ? (
          <div className="premium-table-empty">
            <h3>{emptyTitle}</h3>
            <p>{emptyDescription}</p>
          </div>
        ) : null}
      </div></div>
      <div className="space-y-3 p-3 lg:hidden">
        {visibleRows.map(row=>{
          const actions=rowActions?.(row)??[];
          return <article key={row.id} className="rounded-2xl border border-slate-100 bg-[#F7F9FC] p-4">
            <div className="space-y-3">{columns.map((column,index)=>
              <div key={column.key} className={index===0?"border-b border-slate-200 pb-3":"flex items-start justify-between gap-3"}>
                <span className={index===0?"block text-[10px] font-bold uppercase tracking-wider text-slate-500":"max-w-[40%] shrink-0 text-xs font-medium text-slate-500"}>{column.header}</span>
                <div className={index===0?"mt-1 text-sm font-bold text-[#142A43]":"min-w-0 text-right text-sm font-semibold text-[#142A43]"}>
                  {column.render?column.render(row):column.accessor?String(row[column.accessor]??""):"—"}
                </div>
              </div>)}</div>
            {actions.length>0&&<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">{actions.map(action=>
              action.href?<Link key={action.label} href={action.href} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#0064E0]">{action.label}</Link>:
                <button type="button" key={action.label} onClick={()=>action.onClick?.(row)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">{action.label}</button>
            )}</div>}
          </article>;
        })}
        {visibleRows.length===0&&<p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-600">{emptyTitle}. {emptyDescription}</p>}
      </div>
    </section>
  );
}
