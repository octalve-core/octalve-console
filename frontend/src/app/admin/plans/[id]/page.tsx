import { PlanDetailEditor } from "@/components/modules/admin/CatalogDetailEditor";
import { plans } from "@/lib/platform-data";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  const decodedId = decodeURIComponent(params.id);
  const plan = plans.find((item) => item.id === decodedId) ?? plans[0];

  return (
    <main className="page-container">
      <PlanDetailEditor mode="edit" plan={plan} />
    </main>
  );
}
