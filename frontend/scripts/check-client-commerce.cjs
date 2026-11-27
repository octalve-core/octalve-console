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
 "loadPublishedPlans().then","allowed.find(item => item.id === requestedPlan", "requestedProduct", "chosen?.revision !== Number(requestedRevision)", "setPlanId(\"\");setCycleKey(\"\")","HostingPlanCards","selectedCycle={cycleKey}","defaultCycle"
]);
requires("features/client/data/client-order-data.ts",[
 "publicApi.plans()",'p.status === "active" && p.is_public',"c.is_active && Number(c.price) > 0","published_revision"
]);
requires("features/client/checkout/ServiceCheckout.tsx",[
 "crypto.randomUUID()","sessionStorage.getItem(storageKey)","checkoutKeyForSelection()",
 "clientApi.quoteOrder(checkoutPayload(stableKey))","clientApi.createOrder(checkoutPayload())",
 "result.currency!==selected?.currency","setConfirmation(result);setStage(\"completed\")",
 "result.invoice.status!==\"unpaid\"","stage===\"completed\"",
 "CommerceCheckoutFrame","CheckoutQuoteSummary","ServiceDomainChoice"
]);
requires("features/client/checkout/ui/ServiceDomainChoice.tsx",['choice==="new"',"ClientDomainSearch","onDomainChange"]);
requires("app/client/order/checkout/page.tsx",['product === "domain"',"<DomainCheckout","<ServiceCheckout"]);
requires("features/client/checkout/DomainCheckout.tsx",["DomainSandboxPurchase","checkoutPage"]);
requires("features/client/checkout/DomainCart.tsx",["CheckoutSummary","Registration date","Expiry date","Explore hosting","CommerceCheckoutFrame"]);
requires("features/client/components/commerce/HostingPlanCards.tsx",["PublishedPackageCard","StatusBadge","AddToCartButton","plan.canOrder","Billing period"]);
requires("features/client/components/commerce/HostingOrderSummary.tsx",["defaultCycle","formatPlanAmount","onCycleChange","AddToCartButton"]);
requires("features/client/checkout/CartView.tsx",["readCart","removeFromCart","view=combined-review","!!snapshot"]);
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
 "RecordDirectory","DirectoryRow","r.actionHref","rows={rows}","emptyMessage"
]);
requires("features/client/views/ClientProcessingView.tsx",[
 "clientApi.checkoutOptions()","clientApi.invoice(String(id))",
 "clientApi.initializeHostedPayment(invoiceId,gateway)",
 'allowedHosts.has(target.hostname)',"target.protocol!==\"https:\"",
 'invoice.status!=="unpaid"',"doneStates.includes(status)","document.visibilityState!==\"visible\"",
 "CommercePanel","StatusBadge"
]);
requires("features/client/components/commerce/WalletBalanceCard.tsx",["useState(false)","aria-label={visible?\"Hide wallet balance\":\"Show wallet balance\"}"]);
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

requires("features/client/views/ClientDomainTransferView.tsx",["DomainSearchField","clientApi.domainTransferReadiness(domain)","checkout_enabled!==false"]);
requires("features/client/components/domain-search/DomainSearchResult.tsx",["DomainResultCard","value.test_checkout_enabled","verified&&priced"]);
requires("features/client/components/DomainSandboxPurchase.tsx",['url.origin!=="https://checkout.paystack.com"']);

for(const file of ["DomainCart","ServiceCheckout","ServiceCartCheckout","CombinedCartCheckout"]){const source=read("features/client/checkout/"+file+".tsx");if(!source.includes("CommerceCheckoutFrame")||source.includes("<DashboardPage")||source.includes("<WorkspaceGrid"))throw Error(file+": legacy checkout layout returned");}

requires("features/client/checkout/CombinedCartCheckout.tsx",["accountCartSnapshot","CartItem","CheckoutSummary","CheckoutPayment","OrderConfirmation","readOnly","public_payment_test"]);
if(read("features/client/checkout/CombinedCartCheckout.tsx").includes("./ui/CheckoutSections"))throw Error("Combined cart returned to a separate checkout summary");

requires("features/client/checkout/cart-selections.ts",["privateQueryGeneration","pendingRead","confirmedCartEvent","new CustomEvent(cartChangedEvent","removePurchasedItems"]);
requires("features/client/checkout/ClientCartShortcuts.tsx",["CommerceNotice","confirmedCartEvent","router.prefetch"]);
requires("features/client/components/ClientDomainSearch.tsx",["Try another name","void lookup(name)","AbortSignal.timeout(15000)"]);

requires("features/client/checkout/cart-selections.ts",["recoverAccountCart","scopedKey","subtotal","return account;"]);

requires("features/client/checkout/cart-selections.ts",["pendingWrite","mutationVersion","configureCartItem","version!==mutationVersion"]);
requires("features/client/checkout/ClientCartShortcuts.tsx",["<CartTrigger count={null}","count={count}","readCart(account,false)"]);

requires("components/layout/DashboardShell.tsx",["ClientCartCountContext.Provider value={cartCount}","ClientCartButton count={cartCount}"]);
requires("features/client/checkout/ClientPurchaseShortcuts.tsx",["useContext(ClientCartCountContext)","href={cartHref}"]);
requires("features/client/checkout/CheckoutBillingDetails.tsx",["authApi.saveProfile","ClientProfileDetailsForm","Your account email cannot be changed here"]);
requires("features/client/checkout/CartView.tsx",["<ClientDomainSearch discovery","CommerceRecommendations","Billing period","CheckoutBillingDetails"]);
requires("features/client/checkout/CombinedCartCheckout.tsx",["VerifiedPaymentReceipt","Download test invoice","payment_reference","CheckoutBillingDetails"]);
requires("features/client/components/commerce/BillingRecordDirectory.tsx",["Payment reference","r.paymentReference"]);

requires("features/client/checkout/CombinedCartCheckout.tsx",["action:\"pay\"","CheckoutConsent","PaymentGatewayChoices","Preparing secure payment"]);

requires("features/client/checkout/CartView.tsx",["CartDomainSearchPanel","draftCartAmounts"]);
requires("features/client/checkout/ClientCartShortcuts.tsx",["draftCartAmounts"]);
requires("components/layout/DashboardShell.tsx",["ClientCartCountContext.Provider value={cartCount}","ClientCartButton count={cartCount}"]);
requires("features/client/checkout/ClientPurchaseShortcuts.tsx",["useContext(ClientCartCountContext)","href={cartHref}"]);
requires("features/client/checkout/CheckoutBillingDetails.tsx",["<ClientProfileDetailsForm embedded"]);

requires("features/client/checkout/CartView.tsx",["hostingPicker:{load:loadHostingOffers","revision:offer.revision,domain},true)"]);
requires("features/client/checkout/cart-selections.ts",["requireConfirmed","The cart did not confirm the hosting selection"]);

requires("features/client/views/ClientProcessingView.tsx",["checkout_context","CombinedCartCheckout invoice={invoiceId}","DomainCheckout invoiceId={invoiceId}","CheckoutColumns","CheckoutSummary","CartItem","PaymentGatewayChoices","CheckoutConsent","payment_attempt","payingRef"]);
requires("features/client/components/commerce/invoice-links.ts",["invoiceCheckoutHref","view=invoice&invoice="]);
requires("features/client/components/DomainSandboxPurchase.tsx",["data.purchase?.invoice_id===invoiceId","params.set(\"invoice\",String(invoiceId))"]);
