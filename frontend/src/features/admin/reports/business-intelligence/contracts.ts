/** Strict BIZ-02 view contract: reject malformed or missing financial evidence. */
export type MonthlyMoney={month:string;count:number;amount:string};
export type MonthlyCount={month:string;count:number};
export type BIZSnapshot={
 as_of:string;currency:string;
 methodology:{payment_basis:string;settlement_verified:false;profit_verified:false;
  provider_cost_evidence:string;invoice_status_is_settlement:false;currency_policy:string};
 overview:{payment_amounts:{this_month:string;last_month:string;year_to_date:string;refunded_this_month:string};
  verified_payment_count_this_month:number;verified_payment_count_last_month:number;paid_invoices_this_month:number;pending_invoices:number;
  active_services:number;new_customers_this_month:number;paid_renewal_invoices_this_month:number};
 finance:{payment_amounts:BIZSnapshot["overview"]["payment_amounts"];
  invoice_status:Record<string,number>;paid_before_due_this_month:number;
  paid_after_due_this_month:number;payment_months:MonthlyMoney[]};
 customers:{registered_total:number;registered_this_month:number;registered_last_month:number;
  paying_customers_this_month:number;accounts_with_repeat_failed_payments_14d:number;
  accounts_with_past_due_services:number;registrations_by_month:MonthlyCount[]};
 renewals:{services_due_in_7_days:number;services_due_in_30_days:number;
  services_past_due:number;domains_expiring_in_30_days:number;paid_renewal_invoices_this_month:number};
 providers:{active_services_with_provider:number;
  distribution:{id:string;name:string;active_services:number}[];
  margin:null;supplier_cost:null;note:string};
};
function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid report response.");
 return value as Record<string,unknown>;
}
function name(value:unknown):string{
 if(typeof value!=="string"||!value.trim())throw Error("Invalid report description.");
 return value;
}
function number(value:unknown):number{
 if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)throw Error("Invalid report count.");
 return value;
}
function amount(value:unknown):string{
 if(typeof value!=="string"||!/^\d{1,16}\.\d{2}$/.test(value))throw Error("Invalid financial amount.");
 return value;
}
function amounts(value:unknown){
 const r=record(value);
 return {this_month:amount(r.this_month),last_month:amount(r.last_month),
  year_to_date:amount(r.year_to_date),refunded_this_month:amount(r.refunded_this_month)};
}
function array(value:unknown):unknown[]{
 if(!Array.isArray(value)||value.length>100)throw Error("Invalid reporting series.");
 return value;
}
function monthly(value:unknown,hasAmount:boolean){
 return array(value).map(item=>{
  const r=record(item),month=name(r.month);
  if(!/^\d{4}-\d{2}$/.test(month))throw Error("Invalid report month.");
  return {month,count:number(r.count),...(hasAmount?{amount:amount(r.amount)}:{})};
 });
}
export function parseBIZSnapshot(value:unknown):BIZSnapshot{
 const r=record(value),m=record(r.methodology),o=record(r.overview),
 f=record(r.finance),c=record(r.customers),n=record(r.renewals),p=record(r.providers);
 if(m.settlement_verified!==false||m.profit_verified!==false||
    m.invoice_status_is_settlement!==false||p.margin!==null||p.supplier_cost!==null){
  throw Error("Reporting evidence contract violated.");
 }
 const asOf=name(r.as_of),currency=name(r.currency);
 if(Number.isNaN(Date.parse(asOf))||!/^([A-Z]{3})$/.test(currency))throw Error("Invalid report scope.");
 const byStatus=record(f.invoice_status);
 const invoiceStatus:Record<string,number>={};
 for(const [key,val] of Object.entries(byStatus))invoiceStatus[key]=number(val);
 return {
  as_of:asOf,currency,
  methodology:{payment_basis:name(m.payment_basis),settlement_verified:false,profit_verified:false,
   provider_cost_evidence:name(m.provider_cost_evidence),
   invoice_status_is_settlement:false,currency_policy:name(m.currency_policy)},
  overview:{payment_amounts:amounts(o.payment_amounts),
   verified_payment_count_this_month:number(o.verified_payment_count_this_month),
   verified_payment_count_last_month:number(o.verified_payment_count_last_month),
   paid_invoices_this_month:number(o.paid_invoices_this_month),
   pending_invoices:number(o.pending_invoices),active_services:number(o.active_services),
   new_customers_this_month:number(o.new_customers_this_month),
   paid_renewal_invoices_this_month:number(o.paid_renewal_invoices_this_month)},
  finance:{payment_amounts:amounts(f.payment_amounts),invoice_status:invoiceStatus,
   paid_before_due_this_month:number(f.paid_before_due_this_month),
   paid_after_due_this_month:number(f.paid_after_due_this_month),
   payment_months:monthly(f.payment_months,true) as MonthlyMoney[]},
  customers:{registered_total:number(c.registered_total),
   registered_this_month:number(c.registered_this_month),
   registered_last_month:number(c.registered_last_month),
   paying_customers_this_month:number(c.paying_customers_this_month),
   accounts_with_repeat_failed_payments_14d:number(c.accounts_with_repeat_failed_payments_14d),
   accounts_with_past_due_services:number(c.accounts_with_past_due_services),
   registrations_by_month:monthly(c.registrations_by_month,false) as MonthlyCount[]},
  renewals:{services_due_in_7_days:number(n.services_due_in_7_days),
   services_due_in_30_days:number(n.services_due_in_30_days),
   services_past_due:number(n.services_past_due),
   domains_expiring_in_30_days:number(n.domains_expiring_in_30_days),
   paid_renewal_invoices_this_month:number(n.paid_renewal_invoices_this_month)},
  providers:{active_services_with_provider:number(p.active_services_with_provider),
   distribution:array(p.distribution).map(row=>{const d=record(row);
    return {id:name(d.id),name:name(d.name),active_services:number(d.active_services)};}),
   margin:null,supplier_cost:null,note:name(p.note)},
 };
}
export function formatMoney(value:string,currency:string):string{
 // Decimal strings can exceed JS safe integer, so render without float conversion.
 const [whole,decimals]=value.split(".");
 const readable=whole.replace(/\B(?=(\d{3})+(?!\d))/g,",");
 return currency+" "+readable+"."+decimals;
}
export function monthLabel(value:string):string{
 const dt=new Date(value+"-01T00:00:00Z");
 return Number.isNaN(dt.getTime())?value:
  new Intl.DateTimeFormat("en",{month:"short",year:"numeric",timeZone:"UTC"}).format(dt);
}
