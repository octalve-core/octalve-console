import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlanCards } from "@/components/modules/PlanCards";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Plans & Pricing" description="Configure packages, billing cycles, features and provider mappings that customers can order directly." actions={<Button href="/admin/plans/new">+ Add Plan</Button>} />
      <PlanCards admin />
    </main>
  );
}
