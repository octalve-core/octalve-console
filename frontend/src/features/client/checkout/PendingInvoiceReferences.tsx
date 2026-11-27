import Link from "next/link";
import {CommercePanel,secondary} from "@/components/shared-commerce/CommerceUI";
import {invoiceDownloadHref,invoiceHref} from "../components/commerce/invoice-links";
export function PendingInvoiceReferences({invoice,order,invoiceId}:{invoice?:string;order?:string;invoiceId?:string|number}){
 return <CommercePanel><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Purchase details</h3><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Awaiting payment</span></div><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[["Invoice reference",invoice],["Order reference",order]].filter(([,value])=>value).map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-all text-sm font-medium">{value}</dd></div>)}</dl>{invoiceId&&<div className="mt-4 flex flex-wrap gap-2"><Link href={invoiceHref(invoiceId)} className={secondary}>View invoice</Link><a href={invoiceDownloadHref(invoiceId)} className={secondary}>Download invoice</a></div>}</CommercePanel>;
}
