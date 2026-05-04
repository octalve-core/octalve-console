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

        <div className="premium-table-scroll">
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
        </div>
      </div>
    </section>
  );
}
