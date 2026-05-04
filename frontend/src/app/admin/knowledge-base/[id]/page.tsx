import { KnowledgeArticleEditor } from "@/components/modules/KnowledgeArticleEditor";

export default function Page({ params }: { params: { id: string } }) {
  return <KnowledgeArticleEditor id={params.id} />;
}
