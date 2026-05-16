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
    <div className="grid cols-3">
      {knowledgeBaseArticles.map((article) => (
        <Card padded key={article.id}>
          <Link className="kb-card-link" href={`${baseHref}/${article.id}`}>
            <div className="plan-top">
              <div className="avatar"><BookOpen size={18} /></div>
              <span className="badge">{article.category}</span>
            </div>

            <h2 className="card-title">{article.title}</h2>
            <p className="card-sub" style={{ lineHeight: 1.6 }}>{article.excerpt}</p>

            <div className="actions" style={{ marginTop: 18, color: "#64748b" }}>
              <span className="actions"><Eye size={15} /> {article.views}</span>
              <span className="actions"><ThumbsUp size={15} /> {article.likes}</span>
              <span className="badge green">{article.status}</span>
            </div>
          </Link>

          {admin ? (
            <div className="page-actions" style={{ marginTop: 18 }}>
              <Button href={`/admin/knowledge-base/${article.id}`} variant="secondary">Edit</Button>
              <Button variant="secondary">Unpublish</Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
