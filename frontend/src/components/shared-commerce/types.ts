/** Presentation contract only. Backend adapters must supply authoritative snapshots. */
export type ProductKind="domain"|"hosting"|"vps"|"email"|"ssl";
export type CartLine={id:string;kind:ProductKind;name:string;description:string;period:string;priceLabel:string;renewalLabel?:string;domain?:string;domainOptions?:readonly string[]};
export type CartView={lines:readonly CartLine[];subtotal:string;tax:string;total:string;busy?:boolean;error?:string;notice?:string;checkoutAllowed:boolean};
/** A lookup is not a reservation. The adapter determines whether a draft addition is permitted. */
export type DomainPickerOffer={domain:string;available:boolean|null;priceLabel:string;renewalLabel?:string;selectable:boolean;checkoutEnabled?:boolean};
export type DomainPickerActions={
 search:(query:string,extension:string,signal:AbortSignal)=>Promise<readonly DomainPickerOffer[]>;
 /** Send identifiers only; the backend must atomically add the domain and configure the line. Resolve only on acceptance. */
 addAndConfigure:(lineId:string,domain:string)=>Promise<void>;
};
export type CartActions={remove:(id:string)=>void;configure:(id:string,domain:string)=>void|Promise<void>;domainPicker?:DomainPickerActions;review:()=>void;checkout:()=>void;continueShopping:()=>void;addHosting?:()=>void};
export const steps=["Cart","Checkout","Payment","Confirmation"] as const;
export type GatewayCode="paystack"|"flutterwave"|"monnify"|"google_pay";
export type GatewayOption={code:GatewayCode;enabled:boolean;test?:boolean};
