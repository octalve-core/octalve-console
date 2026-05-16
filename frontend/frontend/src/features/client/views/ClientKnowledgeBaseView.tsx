"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { clientKnowledgeArticles } from "../data/client-knowledge-data";

export function ClientKnowledgeBaseView() {
  const [query, setQuery] = useState("");

  const articles = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return clientKnowledgeArticles;

    return clientKnowledgeArticles.filter((article) =>
      [article.title, article.category, article.excerpt].join(" ").toLowerCase().includes(term),
    );
  }, [query]);

  return (
    <DashboardShell
      role="client"
      title="Knowledge base"
      description="Find helpful guides for hosting, billing, domains, and support."
    >
      <DashboardPage
        eyebrow="Help Center"
        title="Knowledge base"
        description="Self-service guides for common hosting, DNS, billing, and support tasks."
      >
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guides..."
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <Link href={article.actionHref} key={article.id}>
                <Card className="h-full transition hover:border-[#0064E0]/30 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                      <BookOpen className="h-6 w-6" />
                    </div>

                    <Badge tone="info">{article.category}</Badge>
                  </div>

                  <h2 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">{article.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{article.excerpt}</p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-medium text-[#0064E0]">
                    Read guide
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}