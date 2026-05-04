import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { KnowledgeBaseGrid } from "@/components/modules/KnowledgeBaseGrid";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader
        title="Knowledge Base"
        description="Create, edit, publish and manage help articles for customers and staff."
        actions={<Button href="/admin/knowledge-base/new">+ New Article</Button>}
      />
      <KnowledgeBaseGrid baseHref="/admin/knowledge-base" admin />
    </main>
  );
}
