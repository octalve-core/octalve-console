import { CheckoutFlow } from "@/components/modules/CheckoutFlow";

type CheckoutPageProps = {
  searchParams?: {
    plan?: string;
    cycle?: string;
  };
};

export default function Page({ searchParams }: CheckoutPageProps) {
  return (
    <CheckoutFlow
      initialPlanId={searchParams?.plan}
      initialCycle={searchParams?.cycle}
    />
  );
}
