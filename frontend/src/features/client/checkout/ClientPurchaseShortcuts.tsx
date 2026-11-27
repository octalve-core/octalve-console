"use client";

import {useContext} from "react";
import Link from "next/link";
import {Globe2,Package,ShoppingCart} from "lucide-react";
import {ClientCartCountContext} from "./ClientCartShortcuts";
import {cartHref} from "./cart-selections";

const resources={
  domains:{href:"/client/domains",label:"My domains",Icon:Globe2},
  services:{href:"/client/services",label:"My services",Icon:Package},
} as const;

const action="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary sm:px-4";

export function ClientPurchaseShortcuts({resource}:{resource:keyof typeof resources}){
  const count=useContext(ClientCartCountContext);
  const {href,label,Icon}=resources[resource];
  return <nav aria-label="Shopping shortcuts" className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-console-line bg-slate-100 p-1">
    <Link href={href} className={action+" bg-white text-console-ink hover:bg-slate-50"}>
      <Icon size={19} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-console-muted"/>
      {label}
    </Link>
    <Link href={cartHref} aria-label={count===null?"View cart":"View cart, "+count+(count===1?" item":" items")}
      className={action+" text-console-ink hover:bg-white/70"}>
      <ShoppingCart size={19} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-console-primary"/>
      View cart
      {count!==null&&count>0&&<span aria-hidden="true" className="grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full bg-console-primary px-1 text-xs leading-none text-white">{count}</span>}
    </Link>
  </nav>;
}
