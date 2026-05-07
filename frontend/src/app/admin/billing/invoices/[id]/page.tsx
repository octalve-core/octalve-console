import { InvoiceDetailEditor } from "@/components/modules/admin/InvoiceTransactionDetailEditor";
import { invoices } from "@/lib/platform-data";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  const decodedId = decodeURIComponent(params.id);
  const invoice = invoices.find((item) => item.id === decodedId) ?? invoices[0];

  return (
    <main className="page-container">
      <InvoiceDetailEditor mode="edit" invoice={invoice} />
    </main>
  );
}
