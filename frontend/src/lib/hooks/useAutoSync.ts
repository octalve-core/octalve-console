"use client";
import { useEffect, useRef } from "react";

/** Lightweight, read-only reconciliation. No recurring requests for idle lists.
 * Reload on navigation (component mount), or when returning after 2 minutes.
 * Mutations and payment/hosting execution must never call this hook.
 */
export function useAutoSync(refresh:(quiet:boolean)=>void|Promise<void>,key:string){
  const latest=useRef(refresh);
  latest.current=refresh;
  useEffect(()=>{
    let mounted=true;
    let pending=false;
    let last=0;
    async function run(quiet:boolean){
      if(!mounted||pending||(quiet&&document.visibilityState!=="visible"))return;
      const now=Date.now();
      if(quiet&&now-last<120000)return;
      last=now;pending=true;
      try{await latest.current(quiet);}
      catch{/* Each view owns its error state. */}
      finally{pending=false;}
    }
    const onFocus=()=>{void run(true);};
    const onVisible=()=>{if(document.visibilityState==="visible")void run(true);};
    void run(false);
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{mounted=false;window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisible);};
  },[key]);
}
