"use client";
type Category={id:number;name:string};
type Props={
  categories:Category[];newCategory:string;setNewCategory:(v:string)=>void;
  productCategory:string;setProductCategory:(v:string)=>void;
  newProduct:string;setNewProduct:(v:string)=>void;
  productType:string;setProductType:(v:string)=>void;
  busy:boolean;createCategory:()=>Promise<void>;createProduct:()=>Promise<void>;
};
/** One product/category entry point shared by the Catalogue authority.
 * Commercial plan pricing is never handled by this component.
 */
export function CatalogProductsPanel({categories,newCategory,setNewCategory,productCategory,setProductCategory,newProduct,setNewProduct,productType,setProductType,busy,createCategory,createProduct}:Props){
 const actionClasses="rounded-xl bg-[#0064E0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
 const field="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
 const label="block text-xs font-semibold text-slate-600 mb-1";
 return (<section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold">A2 · Products</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label htmlFor="cat" className={label}>New category</label><input id="cat" className={field} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Hosting"/>
            <button disabled={busy||!newCategory.trim()} onClick={()=>void createCategory()} className={actionClasses+" mt-2"}>Create category</button></div>
            <div className="space-y-2"><label htmlFor="prod-category" className={label}>Product category</label>
              <select id="prod-category" className={field} value={productCategory} onChange={e=>setProductCategory(e.target.value)}><option value="">Choose category</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>
              <input className={field} aria-label="New product name" value={newProduct} onChange={e=>setNewProduct(e.target.value)} placeholder="Shared Web Hosting"/>
              <select className={field} aria-label="Product type" value={productType} onChange={e=>setProductType(e.target.value)}>{["shared_hosting","wordpress_hosting","vps"].map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select>
              <button disabled={busy||!productCategory||!newProduct.trim()} onClick={()=>void createProduct()} className={actionClasses}>Create product</button>
            </div>
          </div>
        </section>);
}
