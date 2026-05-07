import { ProductDetailEditor } from "@/components/modules/admin/CatalogDetailEditor";
import { products } from "@/lib/platform-data";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  const decodedId = decodeURIComponent(params.id);

  const product =
    products.find((item) => item.id === decodedId || item.name === decodedId) ??
    products[0];

  return (
    <main className="page-container">
      <ProductDetailEditor mode="edit" product={product} />
    </main>
  );
}
