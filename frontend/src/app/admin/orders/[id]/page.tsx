import { OrderDetailEditor } from "@/components/modules/admin/CustomerOrderDetailEditor";
import { orders } from "@/lib/platform-data";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  const decodedId = decodeURIComponent(params.id);
  const order = orders.find((item) => item.id === decodedId) ?? orders[0];

  return (
    <main className="page-container">
      <OrderDetailEditor mode="edit" order={order} />
    </main>
  );
}
