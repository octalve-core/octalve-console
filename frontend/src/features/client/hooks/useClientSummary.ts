"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/api/endpoints";
import { normalizeClientRecord, unwrapClientList } from "../utils/client-record-normalizer";
import type { ClientRecord } from "../data/client-demo-data";

type State = "loading" | "ready" | "partial";
export type ClientSummary = {
  status: State;
  services: number | null;
  invoices: number | null;
  domains: number | null;
  tickets: number | null;
  wallet: number | null;
  serviceRecords: ClientRecord[];
  invoiceRecords: ClientRecord[];
  serviceRecordsAvailable: boolean;
  invoiceRecordsAvailable: boolean;
};

const initial: ClientSummary = {
  status:"loading", services:null, invoices:null, domains:null, tickets:null,
  wallet:null, serviceRecords:[], invoiceRecords:[],
  serviceRecordsAvailable:false, invoiceRecordsAvailable:false,
};

function countResults(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    const record = data as {count?:unknown;results?:unknown};
    if (typeof record.count==="number" && Number.isSafeInteger(record.count) && record.count>=0) return record.count;
    if (Array.isArray(record.results)) return record.results.length;
  }
  throw new Error("Account summary is unavailable.");
}

function asRecords(data: unknown, resource: "services" | "invoices"): ClientRecord[] {
  const rows=unwrapClientList(data);
  return rows.slice(0,3).map(item=>normalizeClientRecord(item,resource));
}
function walletBalance(data:unknown):number {
  if (!data || typeof data!=="object") throw new Error("Wallet balance unavailable.");
  const raw=(data as {available?:unknown}).available;
  if (typeof raw!=="number" && typeof raw!=="string") throw new Error("Wallet balance unavailable.");
  if (typeof raw==="string" && !/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) throw new Error("Wallet balance unavailable.");
  const amount=Number(raw);
  if (!Number.isFinite(amount) || amount<0) throw new Error("Wallet balance unavailable.");
  return amount;
}

/** Independent account reads. Failed requests never become invented zero values. */
export function useClientSummary() {
  const [summary,setSummary]=useState<ClientSummary>(initial);
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{
    let active=true;
    setSummary(current=>({...current,status:"loading"}));
    async function load() {
      const [services,invoices,domains,tickets,wallet]=await Promise.allSettled([
        clientApi.services(),
        clientApi.invoices({status:"unpaid"}),
        clientApi.domains(),
        clientApi.tickets(),
        clientApi.wallet(),
      ]);
      if (!active) return;
      const next:ClientSummary={...initial,status:"ready"};
      let failed=false;
      function read<T>(result:PromiseSettledResult<unknown>,extract:(data:unknown)=>T):T|null {
        if (result.status==="rejected"){failed=true;return null;}
        try{return extract(result.value);}
        catch{failed=true;return null;}
      }
      next.services=read(services,countResults);
      next.invoices=read(invoices,countResults);
      next.domains=read(domains,countResults);
      next.tickets=read(tickets,countResults);
      next.wallet=read(wallet,walletBalance);
      if (services.status==="fulfilled") {
        try {next.serviceRecords=asRecords(services.value,"services");next.serviceRecordsAvailable=true;}
        catch {failed=true;}
      }
      if (invoices.status==="fulfilled") {
        try {next.invoiceRecords=asRecords(invoices.value,"invoices");next.invoiceRecordsAvailable=true;}
        catch {failed=true;}
      }
      next.status=failed?"partial":"ready";
      setSummary(next);
    }
    void load();
    return ()=>{active=false;};
  },[revision]);
  return {summary,refresh};
}
