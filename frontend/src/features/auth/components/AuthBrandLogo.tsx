"use client";
import Link from "next/link";
import {useState} from "react";

/** Keep the approved auth asset and its fallback; no navigation or session change. */
export function AuthBrandLogo(){
 const [failed,setFailed]=useState(false);
 return <Link href="/login" aria-label="Octalve Console"
  className="inline-flex items-center rounded-xl bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2">
  {!failed?<img src="/assets/logo/octalve.png" alt="Octalve" onError={()=>setFailed(true)}
    className="block h-9 w-auto max-w-[170px] object-contain"/>:
   <span role="img" aria-label="Octalve" className="grid h-9 w-9 grid-cols-2 gap-1 rounded-xl bg-white p-1.5">
    <span className="rounded-full bg-console-primary"/>
    <span className="rounded-full bg-rose-600"/>
    <span className="rounded-full bg-orange-500"/>
    <span className="rounded-full bg-green-500"/>
   </span>}
 </Link>;
}
