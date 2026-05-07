import { CustomerDetailEditor } from "@/components/modules/admin/CustomerOrderDetailEditor";
import { customers } from "@/lib/platform-data";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  const decodedId = decodeURIComponent(params.id);

  const customer =
    customers.find((item) => item.id === decodedId || item.name === decodedId) ??
    customers[0];

  return (
    <main className="page-container">
      <CustomerDetailEditor mode="edit" customer={customer} />
    </main>
  );
}
