"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, Search, SlidersHorizontal, X } from "lucide-react";

export type CloudRecord = {
  id: string;
  title: string;
  subtitle?: string;
  reference?: string;
  amount?: string;
  date?: string;
  status: string;
  icon?: ReactNode;
  details?: Record<string, string>;
};
export type CloudRecordAction = {
  label: string;
  onSelect: (record: CloudRecord) => void;
  danger?: boolean;
  /** The caller must enforce its own permission and domain authority. */
  available?: (record: CloudRecord) => boolean;
};
type Props = {
  label: string;
  records: readonly CloudRecord[];
  actions?: readonly CloudRecordAction[];
  onOpen?: (record: CloudRecord) => void;
  emptyMessage?: string;
  /** Optional domain-specific columns without changing the canonical layout. */
  columns?: readonly { key: string; label: string; render: (record: CloudRecord) => ReactNode }[];
};

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (["paid", "active", "completed", "provisioned", "resolved"].includes(s)) return "bg-emerald-50 text-emerald-700";
  if (["failed", "cancelled", "overdue", "suspended", "refunded"].includes(s)) return "bg-rose-50 text-rose-700";
  if (["pending", "pending_payment", "unpaid", "draft", "open", "processing"].includes(s)) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}
function readable(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function CloudRecordDirectory({
  label, records, actions = [], onOpen, emptyMessage = "No records found.", columns,
}: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<CloudRecord | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const statuses = useMemo(() => [...new Set(records.map(r => r.status))], [records]);
  const filtered = useMemo(() => records.filter(r => {
    if (status !== "all" && r.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || [r.title, r.subtitle, r.reference, r.amount, r.status, ...(r.details ? Object.values(r.details) : [])]
      .some(v => (v || "").toLowerCase().includes(q));
  }), [records, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice((Math.min(page, pages) - 1) * 10, Math.min(page, pages) * 10);
  const cols = columns ?? [
    { key: "record", label: "Record", render: (r: CloudRecord) => <span className="font-medium text-[#0064E0]">{r.reference || r.title}</span> },
    { key: "name", label: "Name", render: (r: CloudRecord) => r.title },
    { key: "amount", label: "Amount", render: (r: CloudRecord) => r.amount || "—" },
    { key: "date", label: "Date", render: (r: CloudRecord) => r.date || "—" },
  ];
  function chooseStatus(next: string) { setStatus(next); setPage(1); setFiltersOpen(false); }
  const chosenActions = selected ? actions.filter(a => a.available?.(selected) !== false) : [];

  return <section aria-label={label} className="min-w-0 overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,.035)]">
    <div className="border-b border-[#EFF2F6] px-3 py-3 sm:px-5">
      <div className="flex flex-wrap gap-1.5" aria-label="Status filters">
        {["all", ...statuses].map(s => <button key={s} type="button" aria-pressed={status === s}
          onClick={() => chooseStatus(s)}
          className={`rounded-full px-3 py-2 text-xs font-medium transition ${status === s ? "bg-[#EAF3FF] text-[#0064E0]" : "bg-[#F2F4F7] text-slate-500 hover:bg-[#E9EDF3]"}`}>{readable(s)}</button>)}
      </div>
    </div>
    <div className="flex items-center gap-2 border-b border-[#EFF2F6] px-3 py-3 sm:px-5">
      <span className="hidden shrink-0 text-xs font-semibold text-[#34465D] sm:inline">{filtered.length} {label.toLowerCase()}</span>
      <label className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input aria-label={`Search ${label}`} type="search" value={search} onChange={e => {setSearch(e.target.value); setPage(1);}}
          placeholder="Search" className="h-10 w-full rounded-xl border border-[#E5EBF3] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0064E0]"/>
      </label>
      <button type="button" onClick={() => setFiltersOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E5EBF3] px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">
        <SlidersHorizontal size={16}/><span className="hidden sm:inline">Filters</span>
      </button>
    </div>
    <div className="hidden px-3 pb-2 lg:block">
      <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-xs sm:text-sm">
        <thead><tr className="bg-[#F2F5F9] text-[#536782]">
          <th className="w-12 rounded-l-xl px-3 py-3 font-medium" scope="col"><span className="sr-only">Icon</span></th>
          {cols.map(c => <th key={c.key} scope="col" className="px-3 py-3 font-semibold">{c.label}</th>)}
          <th scope="col" className="w-28 px-3 py-3 font-medium">Status</th>
          <th scope="col" className="w-12 rounded-r-xl px-2 py-3"><span className="sr-only">Options</span></th>
        </tr></thead>
        <tbody>{visible.map(r => <tr key={r.id} className="text-[#24374D]">
          <td className="rounded-l-xl bg-[#F6F8FB] px-3 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF3FF] text-[#0064E0]">{r.icon || "•"}</span></td>
          {cols.map(c => <td key={c.key} className="truncate bg-[#F6F8FB] px-3 py-4">
            {onOpen ? <button type="button" onClick={() => onOpen(r)} className="max-w-full truncate text-left hover:underline">{c.render(r)}</button> : c.render(r)}
          </td>)}
          <td className="bg-[#F6F8FB] px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(r.status)}`}>{readable(r.status)}</span></td>
          <td className="rounded-r-xl bg-[#F6F8FB] px-2 py-4"><button type="button" aria-label={`Actions for ${r.title}`} onClick={() => setSelected(r)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"><MoreVertical size={17}/></button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 p-3 lg:hidden">{visible.map(r => <button key={r.id} type="button" onClick={() => setSelected(r)}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-[#F6F8FB] p-4 text-left transition hover:border-blue-200">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#0064E0]">{r.icon || "•"}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold text-[#142A43]">{r.title}</span><span className="shrink-0 text-xs font-semibold text-[#142A43]">{r.amount}</span></span>
        <span className="mt-1 block truncate text-[11px] font-medium text-[#0064E0]">{r.reference || r.subtitle}</span>{r.subtitle && r.subtitle !== r.title ? <span className="mt-1 block truncate text-[11px] text-slate-500">{r.subtitle}</span> : null}
        <span className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-slate-400">{r.date}</span><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${statusClass(r.status)}`}>{readable(r.status)}</span></span>
      </span><MoreVertical size={17} className="shrink-0 text-slate-400"/>
    </button>)}</div>
    {visible.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{emptyMessage}</p>}
    <div className="flex items-center justify-between border-t border-[#EFF2F6] px-4 py-3 text-xs">
      <button type="button" disabled={page <= 1} onClick={() => setPage(v => v - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={14}/>Previous</button>
      <span className="text-slate-500">Page {Math.min(page, pages)} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => setPage(v => v + 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30">Next<ChevronRight size={14}/></button>
    </div>
    {filtersOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#06192A]/50 p-0 sm:items-center sm:p-4" onMouseDown={e => {if(e.target === e.currentTarget) setFiltersOpen(false);}}>
      <section role="dialog" aria-modal="true" aria-label="Filter records" className="w-full max-w-md rounded-t-[24px] bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">Filter {label}</h2><button aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={19}/></button></div>
        <div className="flex flex-wrap gap-2">{["all", ...statuses].map(s => <button key={s} type="button" onClick={() => chooseStatus(s)} className={`rounded-full px-3 py-2 text-xs ${status === s ? "bg-[#EAF3FF] text-[#0064E0]" : "bg-slate-100 text-slate-600"}`}>{readable(s)}</button>)}</div>
        <button type="button" onClick={() => setFiltersOpen(false)} className="mt-5 w-full rounded-full bg-[#0064E0] py-3 text-sm font-semibold text-white">Done</button>
      </section>
    </div>}
    {selected && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#06192A]/55 sm:items-center sm:p-4" onMouseDown={e => {if(e.target === e.currentTarget) setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-label={`Actions for ${selected.title}`} className="w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-200 sm:hidden"/>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div><h2 className="font-semibold text-[#142A43]">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.reference || selected.subtitle}</p></div>
          <button type="button" aria-label="Close actions" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500"><X size={18}/></button>
        </div>
        <div className="mt-3 space-y-1">
          {onOpen && <button type="button" onClick={() => {onOpen(selected); setSelected(null);}} className="block w-full rounded-xl px-3 py-3 text-left text-sm text-[#0064E0] hover:bg-[#EAF3FF]">View details</button>}
          {chosenActions.map(a => <button key={a.label} type="button" onClick={() => {a.onSelect(selected); setSelected(null);}}
            className={`block w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-slate-50 ${a.danger ? "text-red-600" : "text-slate-700"}`}>{a.label}</button>)}
          {!onOpen && chosenActions.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No actions available.</p>}
        </div>
        <button type="button" onClick={() => setSelected(null)} className="mt-3 w-full rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-600">Cancel</button>
      </section>
    </div>}
  </section>;
}
