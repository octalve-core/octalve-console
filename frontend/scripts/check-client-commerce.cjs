"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function requires(file,tokens){
 const source=read(file);
 if(/from\s*["'][^"']+\.css["']/.test(source))throw Error(file+": commerce components must not import a stylesheet");
 for(const token of tokens)if(!source.includes(token))throw Error(file+": missing contract "+token);
}
requires("features/client/views/ClientOrderView.tsx",[
 "loadSellablePlans().then","allowed.find(item => item.id === requestedPlan", "requestedProduct", "chosen?.revision !== Number(requestedRevision)", "setPlanId(\"\");setCycleKey(\"\")","HostingPlanCards","HostingOrderSummary","defaultCycle"
]);
requires("features/client/data/client-order-data.ts",[
 "publicApi.plans()",'p.status === "active" && p.is_public',"c.is_active && Number(c.price) > 0","published_revision"
]);
requires("features/client/views/ClientCheckoutView.tsx",[
 "crypto.randomUUID()","sessionStorage.getItem(storageKey)","checkoutKeyForSelection()",
 "clientApi.quoteOrder(checkoutPayload(stableKey))","clientApi.createOrder(checkoutPayload())",
 "result.currency!==selected?.currency","setConfirmation(result);setStage(\"completed\")",
 "result.invoice.status!==\"unpaid\"","stage===\"completed\"",
 "CheckoutProgress","CheckoutQuoteSummary","domainChoice===\"new\""
]);
requires("features/client/components/commerce/HostingPlanCards.tsx",["Panel","StatusBadge","aria-pressed={selected}"]);
requires("features/client/components/commerce/HostingOrderSummary.tsx",["defaultCycle","formatPlanAmount","onCycleChange","/client/order/checkout?plan="]);
requires("features/client/components/commerce/CheckoutQuoteSummary.tsx",[
 "quote?Number(quote.total):cycle.price+cycle.setupFee","Number(quote.discount_total)","onChangeRequest",
 "final prices on the server"
]);
requires("features/client/views/ClientResourceListView.tsx",[
 "config.loader()","BillingRecordDirectory","resource===\"orders\"||resource===\"invoices\"",
 "normalizeClientRecord(item, config.key)"
]);
requires("features/client/views/ClientResourceDetailView.tsx",[
 "config.loader()","setRecord(foundApiRecord ?? null)","BillingRecordDetail"
]);
requires("features/client/components/commerce/BillingRecordDirectory.tsx",[
 "ResponsiveTable","StatusBadge","record","r.actionHref","getRowKey={r=>r.id}"
]);
requires("features/client/views/ClientProcessingView.tsx",[
 "clientApi.checkoutOptions()","clientApi.invoice(String(id))",
 "clientApi.initializeHostedPayment(invoiceId,gateway)",
 'allowedHosts.has(target.hostname)',"target.protocol!==\"https:\"",
 'invoice.status!=="unpaid"',"doneStates.includes(status)","document.visibilityState!==\"visible\"",
 "Panel","StatusBadge"
]);
requires("features/client/views/ClientWalletView.tsx",[
 "clientApi.wallet()","setBalance(null);setStatus(\"unavailable\")","WalletBalanceCard"
]);
requires("app/client/payments/return/page.tsx",[
 "A gateway redirect is never financial truth","does not automatically mean the","ActionLink"
]);
for(const file of ["features/client/components/commerce/BillingRecordDetail.tsx",
 "features/client/components/commerce/BillingRecordDirectory.tsx",
 "features/client/components/commerce/HostingPlanCards.tsx",
 "features/client/components/commerce/HostingOrderSummary.tsx",
 "features/client/components/commerce/CheckoutProgress.tsx",
 "features/client/components/commerce/CheckoutQuoteSummary.tsx",
 "features/client/components/commerce/WalletBalanceCard.tsx"]){
 const source=read(file);
 if(/\bclientApi\b|\bauthApi\b|\bpublicApi\b|\bfetch\s*\(/.test(source))
  throw Error(file+": presentational component cannot mutate/fetch commerce authority");
}
if(process.argv.includes("--built")){
 const dir=path.resolve(__dirname,"../.next/static"),css=[];
 function scan(folder){
  if(!fs.existsSync(folder))return;
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
   const filename=path.join(folder,entry.name);
   if(entry.isDirectory())scan(filename);else if(entry.name.endsWith(".css"))css.push(filename);
  }
 }
 scan(dir);
 if(!css.length)throw Error("No generated Tailwind stylesheets");
 const output=css.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".bg-console-canvas",".text-console-ink",".border-console-line"])
  if(!output.includes(token))throw Error("Missing commerce Tailwind token "+token);
}
console.log("PASS: Batch 4 commerce and payment authority protected; typed Tailwind presentation");
