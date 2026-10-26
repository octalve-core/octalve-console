"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,BookOpen,LifeBuoy} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {MarkdownArticle} from "@/components/modules/MarkdownEditor";
import {helpApi,type HelpArticle} from "@/lib/api/modules/help-center.api";
export function ClientKnowledgeArticleView(){
  const params=useParams<{id:string}>(),slug=String(params.id||"");
  const [article,setArticle]=useState<HelpArticle|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;helpApi.article(slug).then(value=>{if(active)setArticle(value);})
    .catch(()=>{if(active)setError("This guide is unavailable or has not been published.");});
    return()=>{active=false;};},[slug]);
  return <DashboardShell role="client" title={article?.title||"Help centre"} description="Read clear, verified Octalve Cloud guides.">
    <DashboardPage eyebrow="Help centre" title={article?.title||"Knowledge base"}
      description={article?.summary||"Helpful instructions for your services."}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-7 sm:px-10 sm:py-10">
          <Link href="/client/knowledge-base" className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>All guides</Link>
          {error?<p role="alert" className="mt-5 text-sm text-rose-700">{error}</p>:null}
          {!article&&!error?<p role="status" className="mt-6 text-sm text-slate-500">Opening guide…</p>:null}
          {article?<div className="mt-7">
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#0064E0]">{article.category}</span>
            <h2 className="mt-5 text-2xl font-medium tracking-tight text-slate-950">{article.title}</h2>
            <p className="mt-2 text-sm text-slate-500">Last updated {new Date(article.updated_at).toLocaleDateString()}</p>
            <div className="mt-8 border-t border-slate-100 pt-5"><MarkdownArticle body={article.body_markdown}/></div>
          </div>:null}
        </div>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-24">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#0064E0]"><BookOpen/></div>
          <h3 className="mt-4 text-base font-medium">Didn't find your answer?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Describe your issue in a support request. We'll direct it to the appropriate team.</p>
          <Link href="/client/support/new" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><LifeBuoy className="h-4 w-4"/>Contact support</Link>
        </aside>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
