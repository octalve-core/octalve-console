import Image from "next/image";
import {PlugZap} from "lucide-react";
import type {Integration} from "./catalog";
export function ProviderLogo({item}:{item:Integration}){
 return <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-console-line bg-white">
 {item.logo?<Image src={"/integrations/"+item.logo+".svg"} alt="" width={28} height={28} unoptimized/>:<PlugZap className="h-6 w-6 text-console-primary"/>}
 </span>;
}
