import { BookOpen, Eye, ThumbsUp } from "lucide-react";
import { kbArticles } from "@/lib/platform-data";
import { Card } from "@/components/ui/Card";

export function KnowledgeBaseGrid() {
  return (
    <div className="grid cols-3">
      {kbArticles.map((article) => (
        <Card padded key={article.title}>
          <div className="plan-top">
            <div className="avatar"><BookOpen size={18} /></div>
            <span className="badge">{article.category}</span>
          </div>
          <h2 className="card-title">{article.title}</h2>
          <p className="card-sub" style={{ lineHeight: 1.6 }}>{article.excerpt}</p>
          <div className="actions" style={{ marginTop: 18, color: "#64748b" }}>
            <span className="actions"><Eye size={15} /> {article.views}</span>
            <span className="actions"><ThumbsUp size={15} /> {article.likes}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
