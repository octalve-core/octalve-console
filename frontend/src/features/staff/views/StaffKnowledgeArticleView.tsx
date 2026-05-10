"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { staffDemo } from "../data/staff-demo-data";

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function StaffKnowledgeArticleView() {
  const params = useParams();
  const id = decodeURIComponent(getParamValue(params.id));

  const article =
    staffDemo.knowledgeBase.find((item) => item.id === id || item.title === id) ??
    staffDemo.knowledgeBase[0];

  return (
    <DashboardShell
      role="staff"
      title={article.title}
      description={article.subtitle}
      actions={
        <Button href="/staff/knowledge-base" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow="Knowledge Base"
        title={article.title}
        description={article.subtitle}
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <Badge tone={article.status}>{article.status}</Badge>
            <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em] text-slate-950">{article.title}</h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              This article is ready to connect to the knowledge base API. Staff can use it as an internal guide for resolving customer issues quickly and consistently.
            </p>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <BookOpen className="h-6 w-6" />
            </div>

            <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">Staff guide</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use this to support tickets, domain issues, billing questions, and provisioning tasks.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}