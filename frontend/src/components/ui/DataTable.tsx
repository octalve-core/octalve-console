import Link from "next/link";
import { Badge } from "./Badge";
import type { StatusTone } from "@/lib/platform-data";

export type Column = { header: string; accessor: string };
export type Row = Record<string, any> & {
  id?: string;
  status?: string;
  href?: string;
  editHref?: string;
  manageHref?: string;
  tone?: StatusTone;
};

function toneFromStatus(status?: string): StatusTone {
  const value = (status || "").toLowerCase();
  if (["active", "paid", "approved", "provisioned", "ready"].some((word) => value.includes(word))) return "green";
  if (["pending", "test", "waiting", "planned", "unpaid"].some((word) => value.includes(word))) return "orange";
  if (["failed", "suspended", "cancelled", "disabled", "error"].some((word) => value.includes(word))) return "red";
  return "dark";
}

export function DataTable({ title, subtitle, columns, rows, action }: { title: string; subtitle?: string; columns: Column[]; rows: Row[]; action?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle ? <div className="card-sub">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.accessor}>{column.header}</th>)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => {
                  const value = row[column.accessor];
                  if (column.accessor === "status") {
                    return <td key={column.accessor}><Badge tone={row.tone || toneFromStatus(String(value))}>{value}</Badge></td>;
                  }
                  if (column.accessor === "id" && row.href) {
                    return <td key={column.accessor}><Link className="text-link" href={row.href}>{value}</Link></td>;
                  }
                  return <td key={column.accessor}>{value}</td>;
                })}
                <td>
                  <div className="actions">
                    {row.href ? <Link className="text-link" href={row.href}>Open</Link> : null}
                    {row.editHref ? <Link className="text-link" href={row.editHref}>Edit</Link> : null}
                    {row.manageHref ? <Link className="text-link" href={row.manageHref}>Manage</Link> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
