/** Purchase continuations are navigation hints, never payment or access authority.
 * Reject absolute URLs, backslashes, encoded control characters and all non-cart
 * destinations. Use the same validator after signup and when rendering auth links.
 */
const PLANS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CYCLES = new Set(["1mo","3mo","6mo","12mo","24mo","36mo"]);
export function sanitizeCommerceNext(raw: string | null): string {
 if(!raw || raw.length>700 || !raw.startsWith("/") || raw.startsWith("//") ||
   /[\\\u0000-\u001f\u007f]/.test(raw))return "";
 try {
  const url=new URL(raw,"https://console.cloud.octalve.com");
  if(url.origin!=="https://console.cloud.octalve.com"||url.hash)return "";
  if(!["/client/order","/client/domains/register"].includes(url.pathname))return "";
  const keys=[...url.searchParams.keys()];
  const allowed=url.pathname==="/client/order"
   ? new Set(["product","plan","cycle","revision","category"])
   : new Set(["domain"]);
  if(keys.some(k=>!allowed.has(k))||keys.length>5||keys.length!==new Set(keys).size)return "";
  if(url.pathname==="/client/order"){
   const product=url.searchParams.get("product"),plan=url.searchParams.get("plan");
   const cycle=url.searchParams.get("cycle"),revision=url.searchParams.get("revision");
   const category=url.searchParams.get("category");
   if(product&&!PLANS.test(product) || plan&&!(/^[1-9]\d*$/.test(plan)||PLANS.test(plan))
     ||cycle&&!CYCLES.has(cycle)||revision&&!/^[1-9]\d{0,9}$/.test(revision)
     ||category&&!PLANS.test(category))return "";
   if(product&&!plan || plan&&!cycle)return "";
  }else{
   const domain=url.searchParams.get("domain");
   if(domain&&!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain))return "";
  }
  return url.pathname+url.search;
 }catch{return "";}
}
