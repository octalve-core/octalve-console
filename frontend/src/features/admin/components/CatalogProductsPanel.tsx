"use client";
import Link from "next/link";
import {Boxes,Plus,Package,Info} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import type {Category,Product} from "../catalog/catalogue-types";
type Props={
 categories:Category[];products:Product[];
 newCategory:string;setNewCategory:(v:string)=>void;
 productCategory:string;setProductCategory:(v:string)=>void;
 newProduct:string;setNewProduct:(v:string)=>void;
 productSlug:string;setProductSlug:(v:string)=>void;
 productDescription:string;setProductDescription:(v:string)=>void;
 productType:string;setProductType:(v:string)=>void;
 busy:boolean;createCategory:()=>Promise<void>;createProduct:()=>Promise<void>;onActivate:(id:number)=>void;
};
const field="mt-2 min-h-11 w-full rounded-xl border border-console-line bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary";
const button="inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
export function CatalogProductsPanel(p:Props){
 const linked=p.products.filter(x=>x.category===Number(p.productCategory));
 return <div className="space-y-5">
  <div><h2 className="text-xl font-medium tracking-tight text-console-ink">Products & hosting categories</h2><p className="mt-1 text-sm text-console-muted">Organize customer-facing product families separately from hosting supplier inventory and commercial offers.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <Panel className="flex items-center gap-3"><Boxes aria-hidden="true" className="h-7 w-7 text-console-primary"/><div><p className="text-2xl font-medium">{p.categories.length}</p><p className="text-xs text-console-muted">Active categories</p></div></Panel>
   <Panel className="flex items-center gap-3"><Package aria-hidden="true" className="h-7 w-7 text-console-primary"/><div><p className="text-2xl font-medium">{p.products.length}</p><p className="text-xs text-console-muted">Product records</p></div></Panel>
   <Panel className="flex items-center gap-3"><Info aria-hidden="true" className="h-7 w-7 text-console-primary"/><div><p className="text-2xl font-medium">{p.products.filter(x=>x.status==="active"&&x.is_public).length}</p><p className="text-xs text-console-muted">Visible products (not necessarily published offers)</p></div></Panel>
  </div>
  <div className="grid min-w-0 gap-5 xl:grid-cols-2">
   <div className="min-w-0 space-y-5">
    <Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-medium">Hosting product directory</h3><p className="mt-1 text-xs text-console-muted">Real Admin catalogue records. Select Edit for the existing product editor.</p></div><Link href="/admin/products" className="rounded-xl border border-console-line px-4 py-2 text-xs font-medium">All products</Link></div>
     <div className="mt-4 overflow-x-auto rounded-xl border border-console-line"><table className="min-w-[490px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-console-muted"><tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Visibility</th><th className="p-3">Action</th></tr></thead><tbody>{p.products.map(item=><tr className="border-t border-console-line" key={item.id}><td className="p-3 font-medium">{item.name}<span className="block text-xs font-normal text-console-muted">/{item.slug||"unassigned"}</span></td><td className="p-3">{p.categories.find(c=>c.id===item.category)?.name||"Unassigned"}</td><td className="p-3"><StatusBadge tone={item.status==="active"&&item.is_public?"success":"warning"}>{item.status==="active"&&item.is_public?"Visible":"Not public"}</StatusBadge></td><td className="p-3"><div className="flex flex-col gap-2">
   <Link className="font-medium text-console-primary hover:underline" href={`/admin/products/${item.id}`}>Edit</Link>
   {item.status!=="active"||!item.is_public?<button type="button" disabled={p.busy} onClick={()=>p.onActivate(item.id)} className="text-left text-xs font-medium text-console-primary underline-offset-2 hover:underline disabled:opacity-50">Ready for offers</button>:null}
  </div></td></tr>)}{p.products.length===0?<tr><td colSpan={4} className="p-10 text-center text-console-muted">No product records yet. Create a product draft to begin.</td></tr>:null}</tbody></table></div>
    </Panel>
    <Panel><h3 className="text-base font-medium">Create category</h3><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label htmlFor="new-catalog-category" className="min-w-0 flex-1 text-xs font-medium text-console-muted">Category name<input id="new-catalog-category" value={p.newCategory} onChange={e=>p.setNewCategory(e.target.value)} className={field} maxLength={100} placeholder="Shared Hosting"/></label><button disabled={p.busy||!p.newCategory.trim()} onClick={()=>void p.createCategory()} type="button" className={button}><Plus className="h-4 w-4" aria-hidden="true"/>Add category</button></div></Panel>
   </div>
   <Panel><h3 className="text-base font-medium">Create hosting product</h3><p className="mt-1 text-xs text-console-muted">New products start private. An administrator must explicitly mark the product ready for offers; purchasing is separately gated by publication.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
     <label className="block text-xs font-medium text-console-muted">Product name<input className={field} maxLength={200} value={p.newProduct} onChange={e=>p.setNewProduct(e.target.value)} placeholder="Shared Web Hosting"/></label>
     <label className="block text-xs font-medium text-console-muted">Category<select className={field} value={p.productCategory} onChange={e=>p.setProductCategory(e.target.value)}><option value="">Select category</option>{p.categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
     <label className="block text-xs font-medium text-console-muted">Product type<select className={field} value={p.productType} onChange={e=>p.setProductType(e.target.value)}>{[["shared_hosting","Shared hosting"],["wordpress_hosting","WordPress hosting"],["vps","VPS hosting"]].map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
     <label className="block text-xs font-medium text-console-muted">Public URL slug<input className={field} value={p.productSlug} maxLength={50} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e=>p.setProductSlug(e.target.value.toLowerCase())} placeholder="shared-web-hosting"/></label>
     <label className="block text-xs font-medium text-console-muted sm:col-span-2">Short product description<textarea className={field+" min-h-24"} rows={3} value={p.productDescription} maxLength={2000} onChange={e=>p.setProductDescription(e.target.value)} placeholder="Explain which customer needs this product serves."/></label>
    </div>
    <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-console-muted"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-console-primary"/>Products do not create provider resources or charge customers. Publication occurs through a separate reviewed offer.</div>
    <div className="mt-5 flex justify-end"><button type="button" className={button} disabled={p.busy||!p.productCategory||!p.newProduct.trim()} onClick={()=>void p.createProduct()}><Plus aria-hidden="true" className="h-4 w-4"/>Save unpublished product</button></div>
   </Panel>
  </div>
 </div>;
}
