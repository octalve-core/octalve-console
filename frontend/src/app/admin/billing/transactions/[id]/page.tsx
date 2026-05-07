import { TransactionDetailEditor } from "@/components/modules/admin/InvoiceTransactionDetailEditor";
import { transactions } from "@/lib/platform-data";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  const decodedId = decodeURIComponent(params.id);
  const transaction = transactions.find((item) => item.id === decodedId) ?? transactions[0];

  return (
    <main className="page-container">
      <TransactionDetailEditor mode="edit" transaction={transaction} />
    </main>
  );
}
