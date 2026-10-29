"use client";
import {ChevronLeft,ChevronRight} from "lucide-react";
export function DirectoryPagination({page,pages,onPage}:{page:number;pages:number;onPage:(next:number)=>void}){
 return <nav aria-label="Directory pages" className="flex items-center justify-between gap-2 border-t border-console-line px-3 py-3 sm:px-5">
  <button type="button" disabled={page<=1} onClick={()=>onPage(Math.max(1,page-1))}
   className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-console-line px-3 text-xs font-medium text-console-muted hover:bg-slate-50 disabled:opacity-40">
   <ChevronLeft className="h-4 w-4" aria-hidden="true"/>Previous</button>
  <span className="text-[11px] text-console-muted sm:text-xs">Page {page} of {pages}</span>
  <button type="button" disabled={page>=pages} onClick={()=>onPage(Math.min(pages,page+1))}
   className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-console-line px-3 text-xs font-medium text-console-muted hover:bg-slate-50 disabled:opacity-40">
   Next<ChevronRight className="h-4 w-4" aria-hidden="true"/></button>
 </nav>;
}
