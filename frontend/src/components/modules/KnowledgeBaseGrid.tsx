import Link from "next/link";
import { BookOpen, Eye, ThumbsUp } from "lucide-react";
import { knowledgeBaseArticles } from "@/lib/knowledge-base";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function KnowledgeBaseGrid({
  baseHref = "/client/knowledge-base",
  admin = false
}: {
  baseHref?: string;
  admin?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {knowledgeBaseArticles.map((article) => (
        <Card padded key={article.id}>
          <Link className="block min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary" href={`${baseHref}/${article.id}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-console-primary"><BookOpen size={18} /></div>
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-console-primary">{article.category}</span>
            </div>

            <h2 className="text-base font-medium text-console-ink">{article.title}</h2>
            <p className="mt-1 text-[13px] leading-5 text-console-muted">{article.excerpt}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-console-muted">
              <span className="inline-flex items-center gap-1"><Eye size={15} /> {article.views}</span>
              <span className="actions"><ThumbsUp size={15} /> {article.likes}</span>
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">{article.status}</span>
            </div>
          </Link>

          {admin ? (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button href={`/admin/knowledge-base/${article.id}`} variant="secondary">Edit</Button>
              <Button variant="secondary" disabled title="Use the protected catalogue publication workflow">Unpublish</Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
