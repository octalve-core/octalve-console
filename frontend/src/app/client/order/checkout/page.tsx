import { ServiceCheckout } from "@/features/client/checkout/ServiceCheckout";
import { DomainCheckout } from "@/features/client/checkout/DomainCheckout";
import { CartView } from "@/features/client/checkout/CartView";
import { redirect } from "next/navigation";

export default async function ClientCheckoutPage({searchParams}: {
  searchParams: Promise<{domain?: string; product?: string; plan?: string; cycle?: string; category?: string; revision?: string; existing?: string; view?: string}>;
}) {
  const {domain, product, plan, cycle, category, revision, existing, view} = await searchParams;
  if (view === "cart") return <CartView/>;
  if (product === "domain") {
    if (existing === "1" && domain === undefined) return <DomainCheckout/>;
    if (typeof domain !== "string" || !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
      redirect("/client/domains/register");
    }
    return <DomainCheckout domain={domain.toLowerCase()}/>;
  }
  if (!plan || !cycle) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({plan, cycle, category, revision})) {
      if (typeof value === "string" && value) query.set(key, value);
    }
    redirect(query.size ? `/client/order?${query}` : "/client/order");
  }
  return <ServiceCheckout />;
}
