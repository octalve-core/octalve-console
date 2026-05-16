import { ArrowLeft, Eye, ThumbsUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getKnowledgeBaseArticle } from "@/lib/knowledge-base";

type ReaderArea = "client" | "staff";

export function KnowledgeArticleReader({
  id,
  area
}: {
  id: string;
  area: ReaderArea;
}) {
  const article = getKnowledgeBaseArticle(id);
  const backHref = area === "staff" ? "/staff/knowledge-base" : "/client/knowledge-base";

  return (
    <main className="page-container">
      <PageHeader
        title={article.title}
        description={article.excerpt}
        actions={
          <Button href={backHref} variant="secondary">
            <ArrowLeft size={16} />
            Back to Knowledge Base
          </Button>
        }
      />

      <div className="kb-layout">
        <Card padded>
          <div className="kb-article-meta">
            <span className="badge">{article.category}</span>
            <span className="badge green">{article.status}</span>
            <span><Eye size={15} /> {article.views} views</span>
            <span><ThumbsUp size={15} /> {article.likes} likes</span>
            <span>Updated {article.updatedAt}</span>
          </div>

          <article
            className="kb-article-body"
            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
          />
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Article Help</p>
              <h2>Need more help?</h2>
              <p>Open a ticket if this article does not solve your issue.</p>
            </div>
          </div>

          <div className="grid">
            <Button href={area === "staff" ? "/staff/tickets" : "/client/support/new"}>
              {area === "staff" ? "View Tickets" : "Open Support Ticket"}
            </Button>
            <Button href={backHref} variant="secondary">
              Browse More Articles
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
