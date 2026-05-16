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

      <div className="premium-table-wrap">
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
      </div>
    </section>
  );
}
