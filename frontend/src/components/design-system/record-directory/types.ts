import type {LucideIcon} from "lucide-react";
import type {ReactNode} from "react";
/** Presentational snapshot of an authorized API row. No business mutation authority. */
export type DirectoryRow={
 id:string;title:string;subtitle?:string;reference?:string;
 amount?:string;amountLabel?:string;date?:string;dateISO?:string;dateLabel?:string;
 status:string;category?:string;icon?:ReactNode;extra?:ReactNode;
 href?:string;searchTerms?:readonly string[];
};
export type DirectoryColumn={
 key:string;label:string;render:(row:DirectoryRow)=>ReactNode;wideOnly?:boolean;
};
export type DirectoryAction={
 key:string;label:string;icon:LucideIcon;danger?:boolean;
 available?:(row:DirectoryRow)=>boolean;
 href?:(row:DirectoryRow)=>string|undefined;
 onSelect?:(row:DirectoryRow)=>void;
};
export type DirectoryCreate={href:string;label:string};
export type DirectoryFilter={status:string;category:string;from:string;to:string};

/** Optional authoritative server page. Other directories remain local-only. */
export type ServerDirectoryState={
 count:number;page:number;pageSize:number;
 query:string;status:string;filter:DirectoryFilter;ordering:string;
 statuses:readonly string[];
 onQuery:(next:string)=>void;onStatus:(next:string)=>void;
 onFilter:(next:DirectoryFilter)=>void;onPage:(next:number)=>void;
 onOrdering:(next:string)=>void;
};
