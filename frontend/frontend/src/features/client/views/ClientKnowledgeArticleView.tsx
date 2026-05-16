"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { clientKnowledgeArticles } from "../data/client-knowledge-data";

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function ClientKnowledgeArticleView() {
  const params = useParams();
  const id = decodeURIComponent(getParamValue(params.id));

  const article =
    clientKnowledgeArticles.find((item) => item.id === id || item.title === id) ??
    clientKnowledgeArticles[0];

  return (
    <DashboardShell
      role="client"
      title={article.title}
      description={article.excerpt}
      actions={
        <Button href="/client/knowledge-base" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow="Knowledge Base"
        title={article.title}
        description={article.excerpt}
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <Badge tone="info">{article.category}</Badge>
            <div className="mt-6 prose prose-slate max-w-none">
              <p className="text-base leading-8 text-slate-600">{article.content}</p>
            </div>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <BookOpen className="h-6 w-6" />
            </div>

            <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">Need more help?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Open a support ticket if this guide does not solve your issue.
            </p>

            <Button href="/client/support/new" className="mt-5 w-full">
              Open ticket
            </Button>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}