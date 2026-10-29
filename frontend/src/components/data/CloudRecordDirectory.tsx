"use client";
import {useMemo,type ReactNode} from "react";
import {Eye,type LucideIcon} from "lucide-react";
import {RecordDirectory} from "@/components/design-system/record-directory/RecordDirectory";
import type {DirectoryAction,DirectoryColumn,DirectoryRow} from "@/components/design-system/record-directory/types";
export type CloudRecord={
 id:string;title:string;subtitle?:string;reference?:string;amount?:string;date?:string;
 status:string;icon?:ReactNode;details?:Record<string,string>;category?:string;extra?:ReactNode;
};
export type CloudRecordAction={
 label:string;onSelect:(record:CloudRecord)=>void;danger?:boolean;
 available?:(record:CloudRecord)=>boolean;
};
export function CloudRecordDirectory({label,records,actions=[],onOpen,emptyMessage="No records found.",columns}:{
 label:string;records:readonly CloudRecord[];actions?:readonly CloudRecordAction[];
 onOpen?:(record:CloudRecord)=>void;emptyMessage?:string;
 columns?:readonly {key:string;label:string;render:(record:CloudRecord)=>ReactNode}[];
}){
 const lookup=useMemo(()=>new Map(records.map(row=>[row.id,row])),[records]);
 const rows=useMemo<DirectoryRow[]>(()=>records.map(r=>({
  id:r.id,title:r.title,subtitle:r.subtitle,reference:r.reference,amount:r.amount,
  date:r.date,status:r.status,category:r.category,icon:r.icon,extra:r.extra,
  searchTerms:r.details?Object.values(r.details):[]
 })),[records]);
 const mappedColumns=useMemo<DirectoryColumn[]>(()=>(columns||[
  {key:"record",label:"Record",render:(r:CloudRecord)=>r.reference||r.title},
  {key:"name",label:"Name",render:(r:CloudRecord)=>r.title},
  {key:"amount",label:"Amount",render:(r:CloudRecord)=>r.amount||"—"},
  {key:"date",label:"Date",render:(r:CloudRecord)=>r.date||"—"}
 ]).map(c=>({key:c.key,label:c.label,render:(r:DirectoryRow)=>{
  const original=lookup.get(r.id);return original?c.render(original):"—";
 }})),[columns,lookup]);
 const mappedActions=useMemo<DirectoryAction[]>(()=>actions.map((a,i)=>({
  key:String(i),label:a.label,icon:Eye,danger:a.danger,
  available:(r:DirectoryRow)=>{const original=lookup.get(r.id);return Boolean(original)&&a.available?.(original)!==false;},
  onSelect:(r:DirectoryRow)=>{const original=lookup.get(r.id);if(original)a.onSelect(original);}
 })),[actions,lookup]);
 return <RecordDirectory label={label} rows={rows} columns={mappedColumns}
  emptyMessage={emptyMessage} actions={mappedActions}
  onOpen={onOpen?row=>{const original=lookup.get(row.id);if(original)onOpen(original);}:undefined}/>;
}
