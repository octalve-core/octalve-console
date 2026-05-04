import { KnowledgeArticleReader } from "@/components/modules/KnowledgeArticleReader";

export default function Page({ params }: { params: { id: string } }) {
  return <KnowledgeArticleReader id={params.id} area="staff" />;
}
