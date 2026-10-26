"use client";
import { useEffect, useRef } from "react";

/** Refresh read-only GET views only while visible, on focus and each minute.
 * Never use this for checkout, payments, provisioning or other writes.
 */
export function useAutoSync(refresh:(quiet:boolean)=>void|Promise<void>, key:string){
  const latest=useRef(refresh);
  latest.current=refresh;
  useEffect(()=>{
    let mounted=true;
    let pending=false;
    let last=0;
    async function run(quiet:boolean){
      if(!mounted||pending||(quiet&&document.visibilityState!=="visible"))return;
      const now=Date.now();
      if(quiet&&now-last<15000)return;
      last=now;pending=true;
      try{await latest.current(quiet);}
      catch{/* Individual screens display their own request failure states. */}
      finally{pending=false;}
    }
    const focus=()=>{void run(true);};
    const visible=()=>{if(document.visibilityState==="visible")void run(true);};
    void run(false);
    const interval=window.setInterval(()=>{void run(true);},60000);
    window.addEventListener("focus",focus);
    document.addEventListener("visibilitychange",visible);
    return()=>{mounted=false;window.clearInterval(interval);
      window.removeEventListener("focus",focus);
      document.removeEventListener("visibilitychange",visible);};
  },[key]);
}
