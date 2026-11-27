import {redirect} from "next/navigation";
import {invoiceCheckoutHref} from "@/features/client/components/commerce/invoice-links";
export default async function Page({searchParams}:{searchParams:Promise<{invoice?:string;reference?:string;trxref?:string;returning?:string}>}){
 const params=await searchParams;
 if(typeof params.invoice!=="string"||!/^(?:[1-9][0-9]{0,14}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(params.invoice))redirect("/client/invoices");
 redirect(invoiceCheckoutHref(params.invoice)+(params.reference||params.trxref||params.returning==="1"?"&returning=1":""));
}
