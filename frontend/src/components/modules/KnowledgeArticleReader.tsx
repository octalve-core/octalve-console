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
    <main className="mx-auto w-full max-w-[1520px] min-w-0 space-y-4 px-1 py-2 sm:px-2">
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

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <Card padded>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-console-muted">
            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-medium text-console-primary">{article.category}</span>
            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{article.status}</span>
            <span><Eye size={15} /> {article.views} views</span>
            <span><ThumbsUp size={15} /> {article.likes} likes</span>
            <span>Updated {article.updatedAt}</span>
          </div>

          <article
            className="prose prose-sm max-w-none break-words text-console-ink"
            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
          />
        </Card>

        <Card padded>
          <div className="mb-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-console-primary">Article Help</p>
              <h2 className="mt-1 text-base font-medium text-console-ink">Need more help?</h2>
              <p className="mt-1 text-[13px] leading-5 text-console-muted">Open a ticket if this article does not solve your issue.</p>
            </div>
          </div>

          <div className="grid gap-2">
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
