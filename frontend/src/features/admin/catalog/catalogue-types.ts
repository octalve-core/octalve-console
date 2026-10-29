export type Category={id:number;name:string;slug?:string};
export type Product={id:number;name:string;slug?:string;product_type:string;category:number;status:string;is_public?:boolean;description?:string};
export type Provider={id:number;name:string;status:string;health_status:string;adapter_type:string;config?:{fulfillment_model?:string}};
export type Package={id:number;provider:number;provider_name:string;name:string;provider_package_id:string;specs:Record<string,string>;pricing?:{currency?:string;cycles?:Record<string,string>};is_active:boolean};
export type Feature={label:string;value:string;is_highlighted:boolean};
export type Cycle={cycle_key:string;price:string;setup_fee:string;regular_price:string;is_default:boolean};
export type Plan={id:number;product:number;name:string;slug?:string;description:string;currency:string;is_popular:boolean;features:Feature[];billing_cycles:(Cycle&{is_active:boolean})[]};
export type Mapping={plan:number;provider_id:number;provider_package_id:string;is_active:boolean};
export type Draft={id:number;status:string;product_name:string;provider:string;supplier_package:string;payload:{name:string;description?:string;currency?:string;billing_cycles?:{cycle_key:string;price:string}[]};updated_at?:string};
export const periods=[{key:"1mo",label:"Monthly"},{key:"3mo",label:"Quarterly"},{key:"6mo",label:"Semi-annually"},{key:"12mo",label:"Annually"},{key:"24mo",label:"Biennially"},{key:"36mo",label:"Triennially"}] as const;
export type CatalogSection="suppliers"|"products"|"plans"|"publish";
export const catalogTabs=[
 {key:"suppliers",label:"01 · Suppliers & Inventory",caption:"Connections & wholesale approval"},
 {key:"products",label:"02 · Products",caption:"Customer-facing categories"},
 {key:"plans",label:"03 · Hosting Plans",caption:"Resources & retail pricing"},
 {key:"publish",label:"04 · Review & Publish",caption:"Evidence-backed approval"}
] as const;
