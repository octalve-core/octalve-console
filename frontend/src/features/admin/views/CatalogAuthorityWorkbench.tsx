"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";
import {AdminCatalogIntro} from "../components/AdminCatalogIntro";
import {CatalogProductsPanel} from "../components/CatalogProductsPanel";

type Category = { id: number; name: string };
type Product = { id: number; name: string; product_type: string; category: number; status: string };
type Provider = { id: number; name: string; status: string; health_status: string; adapter_type: string; config?: { fulfillment_model?: string } };
type Package = { id: number; provider: number; provider_name: string; name: string; provider_package_id: string; specs: Record<string,string>; pricing?: {currency?: string; cycles?:Record<string,string>}; is_active: boolean };
type Feature = { label: string; value: string; is_highlighted: boolean };
type Cycle = { cycle_key:string; price:string; setup_fee:string; regular_price:string; is_default:boolean };
type Plan = { id:number; product:number; name:string; description:string; currency:string; is_popular:boolean; features:Feature[]; billing_cycles:(Cycle & {is_active:boolean})[] };
type Mapping = {plan:number; provider_id:number; provider_package_id:string; is_active:boolean};
type Draft = {id:number;status:string;product_name:string;provider:string;supplier_package:string;payload:{name:string}};
const periods = [{key:"1mo",label:"Monthly"},{key:"3mo",label:"Quarterly"},{key:"6mo",label:"Semiannual"},{key:"12mo",label:"Yearly"},{key:"24mo",label:"Two years"},{key:"36mo",label:"Three years"}];
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
  const [productCategory,setProductCategory]=useState("");
  const [productType,setProductType]=useState("shared_hosting");
  const [providerId,setProviderId]=useState("");
  const [packageId,setPackageId]=useState("");
  const [costCurrency,setCostCurrency]=useState("NGN");
  const [wholesale,setWholesale]=useState("");
  const [selectedProduct,setSelectedProduct]=useState("");
  const [revisionPlan,setRevisionPlan]=useState("");
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [currency,setCurrency]=useState("NGN");
  const [popular,setPopular]=useState(false);
  const [features,setFeatures]=useState("Storage: 1 GB\nBandwidth: 10 GB");
  const [cycles,setCycles]=useState<Cycle[]>([blankCycle()]);
  const [loading,setLoading]=useState(true);

  async function refresh() {
    const values = await Promise.all([
      api.get("/providers/providers/"),api.get("/providers/packages/"),
      api.get("/catalog/categories/"),api.get("/catalog/products/"),
      api.get("/catalog/plans/"),api.get("/catalog/provider-mappings/"),
      api.get("/catalog/offer-drafts/"),
    ]);
    setProviders(unpack<Provider>(values[0]));setPackages(unpack<Package>(values[1]));
    setCategories(unpack<Category>(values[2]));setProducts(unpack<Product>(values[3]));
    setPlans(unpack<Plan>(values[4]));setMappings(unpack<Mapping>(values[5]));
    setDrafts(unpack<Draft>(values[6]));
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
      name:newProduct.trim(),category:Number(productCategory),product_type:productType,
      status:"active",is_public:true,features:[]
    }),"Product created. Its packages are not published automatically.");
    if(result)setNewProduct("");
  }
  function useExistingPlan(id:string) {
    setRevisionPlan(id);
    const plan=plans.find(p=>String(p.id)===id);
    if(!plan)return;
    setSelectedProduct(String(plan.product));setName(plan.name);setDescription(plan.description||"");
    setCurrency(plan.currency);setPopular(plan.is_popular);
    setFeatures((plan.features||[]).map(f=>`${f.label}: ${f.value}`).join("\n"));
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
    const parsed:Feature[]=[];
    for(const line of features.split("\n").map(v=>v.trim()).filter(Boolean)){
      const sep=line.indexOf(":");
      if(sep<=0||!line.slice(sep+1).trim()){setError("Each feature must be written as Label: value.");return;}
      parsed.push({label:line.slice(0,sep).trim(),value:line.slice(sep+1).trim(),is_highlighted:true});
    }
    if(!selectedProduct||!packageId||!name.trim()){setError("Select a product, approved supplier inventory and offer name.");return;}
    if(!cycles.length||cycles.some(c=>!(Number(c.price)>0)||Number(c.setup_fee)<0)){setError("Each billing period needs a valid positive price and nonnegative setup fee.");return;}
    const payload={
      product_id:Number(selectedProduct),provider_package_id:Number(packageId),
      plan_id:revisionPlan?Number(revisionPlan):null,name:name.trim(),
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
    const costs:Record<string,string>={};
    for(const line of wholesale.split("\\n").map(x=>x.trim()).filter(Boolean)){
      const parts=line.split("=");
      if(parts.length!==2 || !periods.some(p=>p.key===parts[0].trim()) ||
         !(Number(parts[1].trim())>0)){
        setError("Supplier costs must use a valid billing period and positive amount, e.g. 1mo=2000.");return;
      }
      costs[parts[0].trim()]=parts[1].trim();
    }
    if(provider?.config?.fulfillment_model==="partner_reseller" && Object.keys(costs).length===0){
      setError("Partner resale requires documented supplier costs for each commercial period.");return;
    }
    await execute(()=>api.patch(`/providers/packages/${supplier.id}/`,{
      is_active:true,
      pricing:Object.keys(costs).length ? {currency:costCurrency,cycles:costs,origin:"admin_reviewed_supplier_quote"} : {},
    }),"Supplier inventory reviewed. This does NOT publish customer retail prices.");
  }

  const supplier=packages.find(p=>String(p.id)===packageId);
  const activeProvider=providers.find(p=>String(p.id)===providerId);
  const actionClasses="rounded-xl bg-[#0064E0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
  const field="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
  const label="block text-xs font-semibold text-slate-600 mb-1";

  return <DashboardShell role="admin" title="Catalog authority" description="Supplier inventory, approved retail pricing and package publication.">
    <DashboardPage eyebrow="Catalog / A1+A2" title="Providers and retail offers"
      description="Provider capacity and wholesale costs stay internal; customer prices are published only after administrator review.">
      <div className="space-y-6">
        <AdminCatalogIntro/>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/integrations" className={actionClasses}>Browse supplier integrations</Link>
          <Link href="/admin/servers" className="text-sm font-medium text-console-primary">View providers</Link>
          <button type="button" onClick={()=>void execute(async()=>{await refresh();return true;},"Catalog refreshed.")} disabled={busy} className="rounded-xl border px-4 py-2 text-sm">Refresh records</button>
        </div>
        {loading&&<p role="status">Loading live catalog...</p>}
        {error&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice&&<div role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{notice}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold">A1 · Supplier inventory staging</h2>
          <p className="text-sm text-slate-600">Owned servers and authorised resale partners use one private provider directory. Only DirectAdmin and WHM inventory imports are qualified in this batch.</p>
          <label className={label} htmlFor="provider">Provider connection</label>
          <select id="provider" className={field} value={providerId} onChange={e=>{setProviderId(e.target.value);setPackageId("");}}>
            <option value="">Select provider</option>{providers.map(p=><option key={p.id} value={p.id}>{p.name} · {p.adapter_type} · {p.health_status}</option>)}
          </select>
          {activeProvider&&<p className="text-xs text-slate-600">Model: {activeProvider.config?.fulfillment_model||"Not configured"} · Status: {activeProvider.status} · Health: {activeProvider.health_status}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={actionClasses} disabled={busy||!providerId} onClick={()=>void execute(()=>api.post(`/providers/providers/${providerId}/test_connection/`,{}),"Connection and read-only inventory verified.")}>Verify connection</button>
            <button type="button" className={actionClasses} disabled={busy||!providerId} onClick={()=>void execute(()=>api.post(`/providers/providers/${providerId}/sync_packages/`,{}),"Supplier inventory staged; review individual packages before selling.")}>Sync package inventory</button>
          </div>
          <div className="grid gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 md:grid-cols-3">
            <div><label className={label} htmlFor="wholesale-selected">Supplier package to review</label>
              <select id="wholesale-selected" className={field} value={packageId} onChange={e=>{const p=packages.find(x=>String(x.id)===e.target.value);setPackageId(e.target.value);setCostCurrency(p?.pricing?.currency||"NGN");setWholesale(Object.entries(p?.pricing?.cycles||{}).map(([k,v])=>`${k}=${v}`).join("\\n"));}}>
                <option value="">Choose imported package</option>{packages.filter(p=>!providerId||String(p.provider)===providerId).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
              </select></div>
            <div><label className={label} htmlFor="cost-currency">Supplier-cost currency</label><input id="cost-currency" className={field} maxLength={3} value={costCurrency} onChange={e=>setCostCurrency(e.target.value.toUpperCase())}/></div>
            <div><label className={label} htmlFor="supplier-costs">Supplier wholesale quotes (for resale)</label>
              <textarea id="supplier-costs" className={field} rows={3} placeholder={"1mo=1500\\n12mo=15000"} value={wholesale} onChange={e=>setWholesale(e.target.value)}/></div>
            <div className="md:col-span-3">
              <p className="mb-2 text-xs text-slate-600">For Octalve-owned servers the supplier list contains technical capacities, not an invented wholesale price. For reseller partners enter the costs from their approved agreement before selling.</p>
              <button type="button" className={actionClasses} onClick={()=>void approveSupplierPackage()} disabled={busy||!packageId}>Approve supplier inventory</button>
            </div>
          </div>
          <h3 className="text-sm font-semibold">Imported supplier packages (private)</h3>
          {packages.filter(p=>!providerId||String(p.provider)===providerId).map(p=><div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><strong>{p.name}</strong> <span className="text-slate-500">· {p.provider_name} · {p.is_active?"Approved inventory":"Needs admin review"}</span></div>
              <button type="button" disabled={busy} onClick={()=>{setPackageId(String(p.id));setProviderId(String(p.provider));setCostCurrency(p.pricing?.currency||"NGN");setWholesale(Object.entries(p.pricing?.cycles||{}).map(([period,amount])=>`${period}=${amount}`).join("\\n"));}} className="rounded-xl border px-3 py-1 text-xs">Review package and costs</button>
            </div>
            <p className="mt-1 break-words text-xs text-slate-600">{Object.entries(p.specs||{}).map(([k,v])=>`${k}: ${v}`).join(" · ")||"No verified specifications"}</p>
          </div>)}
        </section>

        <CatalogProductsPanel categories={categories} newCategory={newCategory} setNewCategory={setNewCategory}
          productCategory={productCategory} setProductCategory={setProductCategory}
          newProduct={newProduct} setNewProduct={setNewProduct} productType={productType}
          setProductType={setProductType} busy={busy} createCategory={createCategory} createProduct={createProduct}/>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold">A2 · Draft customer-facing offer</h2>
          <p className="text-sm text-slate-600">Create a new offer or revise an existing published package. Supplier costs and technical API keys are never shown to customers.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label htmlFor="revision" className={label}>Revise existing plan (optional)</label>
              <select id="revision" className={field} value={revisionPlan} onChange={e=>useExistingPlan(e.target.value)}>
                <option value="">New plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} (ID {p.id})</option>)}</select></div>
            <div><label htmlFor="offer-product" className={label}>Octalve product</label>
              <select id="offer-product" className={field} value={selectedProduct} onChange={e=>setSelectedProduct(e.target.value)}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label htmlFor="offer-supplier" className={label}>Approved supplier package</label>
              <select id="offer-supplier" className={field} value={packageId} onChange={e=>setPackageId(e.target.value)}><option value="">Select supplier package</option>{packages.filter(p=>p.is_active).map(p=><option key={p.id} value={p.id}>{p.provider_name} · {p.name}</option>)}</select>
              {supplier&&<p className="mt-1 text-xs text-slate-600">Provider ID {supplier.provider}; technical package {supplier.provider_package_id}</p>}</div>
            <div><label htmlFor="offer-name" className={label}>Retail plan name</label><input id="offer-name" className={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Octalve Business"/></div>
            <div><label htmlFor="offer-currency" className={label}>Retail currency</label><input id="offer-currency" className={field} maxLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={popular} onChange={e=>setPopular(e.target.checked)} id="popular"/><label htmlFor="popular" className="text-sm">Featured / popular package</label></div>
          </div>
          <div><label htmlFor="offer-desc" className={label}>Description</label><textarea id="offer-desc" className={field} value={description} onChange={e=>setDescription(e.target.value)} rows={2}/></div>
          <div><label htmlFor="offer-features" className={label}>Approved features (one Label: Value per line)</label><textarea id="offer-features" className={field} value={features} onChange={e=>setFeatures(e.target.value)} rows={4}/></div>
          <h3 className="text-sm font-semibold">Retail billing periods</h3>
          {cycles.map((c,i)=><div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-5">
            <div><label className={label}>Period</label><select className={field} value={c.cycle_key} onChange={e=>editCycle(i,"cycle_key",e.target.value)}>{periods.map(p=><option value={p.key} key={p.key}>{p.label}</option>)}</select></div>
            <div><label className={label}>Retail price</label><input className={field} type="number" min="0.01" step="0.01" value={c.price} onChange={e=>editCycle(i,"price",e.target.value)}/></div>
            <div><label className={label}>Setup fee</label><input className={field} type="number" min="0" step="0.01" value={c.setup_fee} onChange={e=>editCycle(i,"setup_fee",e.target.value)}/></div>
            <div><label className={label}>Regular price (optional)</label><input className={field} type="number" min="0.01" step="0.01" value={c.regular_price} onChange={e=>editCycle(i,"regular_price",e.target.value)}/></div>
            <div className="flex items-center gap-2"><label className="text-xs"><input type="radio" checked={c.is_default} onChange={()=>setCycles(old=>old.map((v,j)=>({...v,is_default:j===i})))}/> Default</label><button type="button" disabled={cycles.length===1} onClick={()=>setCycles(old=>old.filter((_,j)=>j!==i))} className="text-xs text-red-700">Remove</button></div>
          </div>)}
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={()=>setCycles(old=>[...old,{...blankCycle(),cycle_key:periods.find(p=>!old.some(c=>c.cycle_key===p.key))?.key||"1mo",is_default:false}])} disabled={cycles.length===periods.length}>Add billing period</button>
          <div><button type="button" onClick={()=>void saveDraft()} className={actionClasses} disabled={busy}>Save unpublished draft</button></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold">Review and publish</h2>
          <p className="text-sm text-slate-600">Publishing validates provider health, supplier approval, resource limits and partner costs; it does not provision servers or collect payment.</p>
          {drafts.length===0&&<p className="text-sm text-slate-500">No offer drafts yet.</p>}
          {drafts.map(d=><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm" key={d.id}>
            <span><strong>{d.payload?.name}</strong> · {d.product_name} · {d.supplier_package} · {d.status}</span>
            <button type="button" disabled={busy||d.status!=="draft"} className={actionClasses}
              onClick={()=>void execute(()=>api.post(`/catalog/offer-drafts/${d.id}/publish/`,{}),"Retail offer approved, versioned and published.")}>Publish approved offer</button>
          </div>)}
        </section>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
