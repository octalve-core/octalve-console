import type {ReactNode} from "react";
import {EmptyState} from "./EmptyState";
export type ResponsiveColumn<Row>={key:string;heading:string;cell:(row:Row)=>ReactNode};
export type ResponsiveTableProps<Row>={
 caption:string;columns:readonly ResponsiveColumn<Row>[];rows:readonly Row[];
 getRowKey:(row:Row)=>string|number;emptyTitle?:string;emptyDescription?:string;
};
export function ResponsiveTable<Row>({caption,columns,rows,getRowKey,emptyTitle="No records found",
 emptyDescription}:ResponsiveTableProps<Row>){
 if(!rows.length)return <EmptyState title={emptyTitle} description={emptyDescription}/>;
 return <div className="min-w-0">
  <ul aria-label={caption} className="space-y-3 md:hidden">
   {rows.map(row=><li key={getRowKey(row)} className="min-w-0 rounded-2xl border border-console-line bg-white p-4">
    <dl className="space-y-3">
     {columns.map(column=><div key={column.key} className="min-w-0">
      <dt className="text-xs font-medium text-console-muted">{column.heading}</dt>
      <dd className="mt-1 break-words text-sm text-console-ink">{column.cell(row)}</dd>
     </div>)}
    </dl>
   </li>)}
  </ul>
  <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-console-line bg-white md:block">
   <table className="w-full border-collapse text-left text-sm text-console-ink">
    <caption className="sr-only">{caption}</caption>
    <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr>
     {columns.map(column=><th key={column.key} scope="col" className="px-4 py-3">{column.heading}</th>)}
    </tr></thead>
    <tbody className="divide-y divide-slate-100">
     {rows.map(row=><tr key={getRowKey(row)} className="hover:bg-slate-50">
      {columns.map(column=><td key={column.key} className="px-4 py-4 align-top">{column.cell(row)}</td>)}
     </tr>)}
    </tbody>
   </table>
  </div>
 </div>;
}
