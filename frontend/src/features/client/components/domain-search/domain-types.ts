export type DomainLookup={
  domain:string;availability:"unverified"|"available"|"registered"|"unknown";
  checkout_enabled:boolean;registrar_connected:boolean;tld:string|null;
  registration_price:string|null;renewal_price:string|null;currency:string|null;message:string;
};
export function formatDomainPrice(amount:string,currency:string|null){
  const value=Number(amount);if(!Number.isFinite(value))return "Price unavailable";
  try{return new Intl.NumberFormat("en-NG",{style:"currency",currency:currency||"NGN",maximumFractionDigits:2}).format(value)}
  catch{return `NGN ${value.toLocaleString("en-NG")}`;}
}
