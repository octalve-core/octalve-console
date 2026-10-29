"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";
import {AdminCatalogIntro} from "../components/AdminCatalogIntro";
import {CatalogProductsPanel} from "../components/CatalogProductsPanel";

import type {Category,Product,Provider,Package,Feature,Cycle,Plan,Mapping,Draft,CatalogSection} from "../catalog/catalogue-types";
import {periods} from "../catalog/catalogue-types";
import {CatalogSuppliersTab} from "../catalog/CatalogSuppliersTab";
import {CatalogPlansTab} from "../catalog/CatalogPlansTab";
import {CatalogPublishTab} from "../catalog/CatalogPublishTab";
import {CatalogWorkspaceNavigation} from "../catalog/CatalogWorkspaceNavigation";
import {parsePlanFeatureLines,parseSupplierCostLines} from "../catalog/catalogue-input";
const blankCycle = (): Cycle => ({cycle_key:"1mo",price:"",setup_fee:"0",regular_price:"",is_default:true});
/** Reject invalid collection envelopes; never silently replace server errors with empty inventory. */
const unpack = <T,>(data: unknown): T[] => {
 const rows=Array.isArray(data)?data:(
  data && typeof data==="object" && "results" in data
  ? (data as {results:unknown}).results : null
 );
 if(!Array.isArray(rows) || rows.some(row=>!row || typeof row!=="object" || Array.isArray(row)))
   throw new Error("The catalog returned an unexpected response. Please retry.");
 return rows as T[];
};

export function CatalogAuthorityWorkbench() {
  const [providers,setProviders]=useState<Provider[]>([]);
  const [packages,setPackages]=useState<Package[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [plans,setPlans]=useState<Plan[]>([]);
  const [mappings,setMappings]=useState<Mapping[]>([]);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [newCategory,setNewCategory]=useState("");
  const [newProduct,setNewProduct]=useState("");
  const [productSlug,setProductSlug]=useState("");
  const [productDescription,setProductDescription]=useState("");
  const [productCategory,setProductCategory]=useState("");
  const [productType,setProductType]=useState("shared_hosting");
  const [providerId,setProviderId]=useState("");
  const [packageId,setPackageId]=useState("");
  const [costCurrency,setCostCurrency]=useState("NGN");
  const [wholesale,setWholesale]=useState("");
  const [selectedProduct,setSelectedProduct]=useState("");
  const [revisionPlan,setRevisionPlan]=useState("");
  const [name,setName]=useState("");
  const [slug,setSlug]=useState("");
  const [description,setDescription]=useState("");
  const [currency,setCurrency]=useState("NGN");
  const [popular,setPopular]=useState(false);
  const [features,setFeatures]=useState("");
  const [cycles,setCycles]=useState<Cycle[]>([blankCycle()]);
  const [loading,setLoading]=useState(true);
  const [section,setSection]=useState<CatalogSection>("suppliers");
  useEffect(()=>{
    const fromHash=()=>{const key=window.location.hash.slice(1);
      if(key==="suppliers"||key==="products"||key==="plans"||key==="publish")setSection(key);
    };
    fromHash();window.addEventListener("hashchange",fromHash);
    return ()=>window.removeEventListener("hashchange",fromHash);
  },[]);
  function selectSection(next:CatalogSection){
    setSection(next);window.history.replaceState(null,"","#"+next);
  }


  async function refresh() {
    const values = await Promise.all([
      api.get("/providers/providers/"),api.get("/providers/packages/"),
      api.get("/catalog/categories/"),api.get("/catalog/products/"),
      api.get("/catalog/plans/"),api.get("/catalog/provider-mappings/"),
      api.get("/catalog/offer-drafts/"),
    ]);
    // Parse all seven responses before committing any state. A malformed
    // provider envelope must not leave a partially refreshed supplier/pricing UI.
    const nextProviders=unpack<Provider>(values[0]),nextPackages=unpack<Package>(values[1]);
    const nextCategories=unpack<Category>(values[2]),nextProducts=unpack<Product>(values[3]);
    const nextPlans=unpack<Plan>(values[4]),nextMappings=unpack<Mapping>(values[5]);
    const nextDrafts=unpack<Draft>(values[6]);
    setProviders(nextProviders);setPackages(nextPackages);setCategories(nextCategories);
    setProducts(nextProducts);setPlans(nextPlans);setMappings(nextMappings);setDrafts(nextDrafts);
  }
  useEffect(()=>{let live=true;refresh().catch(e=>{if(live)setError(String(e?.message || e));}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
  async function execute(task:()=>Promise<unknown>, message:string) {
    setBusy(true);setError("");setNotice("");
    try {const result=await task();await refresh();setNotice(message);return result;}
    catch(e:unknown){setError(e instanceof Error?e.message:String(e));return undefined;}
    finally{setBusy(false);}
  }
  async function createCategory(){if(!newCategory.trim())return;
    const result=await execute(()=>api.post("/catalog/categories/",{name:newCategory.trim(),is_active:true}),"Category created.");
    if(result)setNewCategory("");
  }
  async function createProduct(){if(!newProduct.trim()||!productCategory)return;
    const result=await execute(()=>api.post("/catalog/products/",{
      name:newProduct.trim(),slug:productSlug.trim(),description:productDescription.trim(),category:Number(productCategory),product_type:productType,
      status:"inactive",is_public:false,features:[]
    }),"Product created. Its packages are not published automatically.");
    if(result){setNewProduct("");setProductSlug("");setProductDescription("");}
  }
  function useExistingPlan(id:string) {
    setRevisionPlan(id);
    const plan=plans.find(p=>String(p.id)===id);
    if(!plan){setSlug("");return;}
    setSelectedProduct(String(plan.product));setName(plan.name);setSlug(plan.slug||"");setDescription(plan.description||"");
    setCurrency(plan.currency);setPopular(plan.is_popular);
    setFeatures((plan.features||[]).map(f=>f.value?`${f.label}: ${f.value}`:f.label).join("\n"));
    const existing=(plan.billing_cycles||[]).filter(c=>c.is_active).map(c=>({
      cycle_key:c.cycle_key,price:String(c.price),setup_fee:String(c.setup_fee||"0"),
      regular_price:c.regular_price?String(c.regular_price):"",is_default:c.is_default,
    }));
    setCycles(existing.length?existing:[blankCycle()]);
    const mapping=mappings.find(m=>m.plan===plan.id&&m.is_active);
    const pkg=mapping ? packages.find(p=>p.provider===mapping.provider_id&&p.provider_package_id===mapping.provider_package_id) : undefined;
    if(pkg){setProviderId(String(pkg.provider));setPackageId(String(pkg.id));}
  }
  function editCycle(index:number,key:keyof Cycle,value:string|boolean) {
    setCycles(old=>old.map((c,i)=>i===index?{...c,[key]:value}:c));
  }
  async function saveDraft(){
    let parsed:Feature[];
    try{parsed=parsePlanFeatureLines(features);}
    catch(e){setError(e instanceof Error?e.message:"Invalid plan features.");return;}
    if(!selectedProduct||!packageId||!name.trim()){setError("Select a product, approved supplier inventory and offer name.");return;}
    if(!cycles.length||cycles.some(c=>!(Number(c.price)>0)||Number(c.setup_fee)<0)){setError("Each billing period needs a valid positive price and nonnegative setup fee.");return;}
    const payload={
      product_id:Number(selectedProduct),provider_package_id:Number(packageId),
      plan_id:revisionPlan?Number(revisionPlan):null,name:name.trim(),slug:slug.trim()||undefined,
      description,currency,is_popular:popular,features:parsed,
      billing_cycles:cycles.map(c=>({
        cycle_key:c.cycle_key,price:c.price,setup_fee:c.setup_fee||"0",
        regular_price:c.regular_price||null,is_default:c.is_default
      }))
    };
    return execute(()=>api.post("/catalog/offer-drafts/",payload),
      "Offer saved as draft. It is NOT available for customer purchase until published.");
  }
  async function approveSupplierPackage(){
    if(!supplier){setError("Choose an imported supplier package.");return;}
    const provider=providers.find(p=>p.id===supplier.provider);
    let costs:Record<string,string>;
    try{costs=parseSupplierCostLines(wholesale);}
    catch(e){setError(e instanceof Error?e.message:"Supplier rates are invalid.");return;}
    if(provider?.config?.fulfillment_model==="partner_reseller" && Object.keys(costs).length===0){
      setError("Partner resale requires documented supplier costs for each commercial period.");return;
    }
    await execute(()=>api.patch(`/providers/packages/${supplier.id}/`,{
      is_active:true,
      pricing:Object.keys(costs).length ? {currency:costCurrency,cycles:costs,origin:"admin_reviewed_supplier_quote"} : {},
    }),"Supplier inventory reviewed. This does NOT publish customer retail prices.");
  }


  const supplier=packages.find(p=>String(p.id)===packageId);
  return <DashboardShell role="admin" title="Hosting catalogue" description="Supplier inventory, products, published prices and offers in one workspace.">
    <DashboardPage eyebrow="Commerce / Hosting catalogue" title="Hosting catalogue"
      description="Connect approved suppliers, organise hosting products, configure retail offers and publish with confidence.">
      <div className="space-y-5">
        <AdminCatalogIntro/>
        <CatalogWorkspaceNavigation active={section} onSelect={selectSection}/>
        {loading?<div role="status" className="rounded-xl border border-console-line bg-white p-5 text-sm text-console-muted">Loading catalogue records…</div>:null}
        {error?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>:null}
        {notice?<div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{notice}</div>:null}
        {!loading&&<section role="tabpanel" id={`catalog-panel-${section}`} aria-labelledby={`catalog-tab-${section}`} tabIndex={0} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
          {section==="suppliers"?<CatalogSuppliersTab
            providers={providers} packages={packages} providerId={providerId} setProviderId={setProviderId}
            packageId={packageId} setPackageId={setPackageId} costCurrency={costCurrency}
            setCostCurrency={setCostCurrency} wholesale={wholesale} setWholesale={setWholesale}
            busy={busy} onVerify={()=>{if(providerId)void execute(()=>api.post(`/providers/providers/${providerId}/test_connection/`,{}),"Provider connection check completed. Review its verified health status.");}}
            onSync={()=>{if(providerId)void execute(()=>api.post(`/providers/providers/${providerId}/sync_packages/`,{}),"Supplier inventory refreshed for review.");}}
            onApprove={()=>void approveSupplierPackage()}
          />:null}
          {section==="products"?<CatalogProductsPanel
            categories={categories} products={products} newCategory={newCategory} setNewCategory={setNewCategory}
            newProduct={newProduct} setNewProduct={setNewProduct}
            productSlug={productSlug} setProductSlug={setProductSlug}
            productDescription={productDescription} setProductDescription={setProductDescription}
            productCategory={productCategory} setProductCategory={setProductCategory}
            productType={productType} setProductType={setProductType}
            busy={busy} createCategory={createCategory} createProduct={createProduct}
            onActivate={id=>void execute(()=>api.patch(`/catalog/products/${id}/`,{status:"active",is_public:true}),"Product is ready for offer publication; no customer purchase is enabled until a reviewed plan is published.")}
          />:null}
          {section==="plans"?<CatalogPlansTab
            products={products} plans={plans} packages={packages} revisionPlan={revisionPlan}
            onRevision={useExistingPlan} selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct}
            packageId={packageId} setPackageId={setPackageId}
            name={name} setName={setName} slug={slug} setSlug={setSlug}
            description={description} setDescription={setDescription} currency={currency} setCurrency={setCurrency}
            popular={popular} setPopular={setPopular} features={features} setFeatures={setFeatures} cycles={cycles}
            onCycle={editCycle} onDefault={index=>setCycles(old=>old.map((v,j)=>({...v,is_default:j===index})))}
            onRemove={index=>setCycles(old=>old.filter((_,j)=>j!==index))}
            onAdd={()=>setCycles(old=>{
              const available=periods.find(x=>!old.some(c=>c.cycle_key===x.key));
              return available?[...old,{...blankCycle(),cycle_key:available.key,is_default:false}]:old;
            })}
            busy={busy} onSave={()=>void saveDraft()}
          />:null}
          {section==="publish"?<CatalogPublishTab drafts={drafts} busy={busy}
            onEdit={()=>selectSection("plans")}
            onPublish={id=>void execute(()=>api.post(`/catalog/offer-drafts/${id}/publish/`,{}),
              "Offer approved and published by the server. Refresh the public storefront to view eligible offers.")}
          />:null}
        </section>}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
