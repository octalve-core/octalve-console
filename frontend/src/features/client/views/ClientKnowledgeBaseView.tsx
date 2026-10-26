"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {LifeBuoy,FileText} from "lucide-react";
import {KnowledgeBaseHero} from "../components/KnowledgeBaseHero";
import {HelpArticleCards} from "@/features/support/components/HelpArticleCards";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {helpApi,asList,type HelpArticle} from "@/lib/api/modules/help-center.api";

export function ClientKnowledgeBaseView(){
  const [articles,setArticles]=useState<HelpArticle[]>([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("All guides");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;
    helpApi.articles().then(response=>{if(active)setArticles(asList(response));})
    .catch(()=>{if(active)setError("We couldn't load the latest guides. Please try again.");})
    .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false};
  },[]);
  const categories=useMemo(()=>["All guides",...new Set(articles.map(a=>a.category))],[articles]);
  const results=useMemo(()=>articles.filter(article=>
    (category==="All guides"||article.category===category)&&
    (!query.trim()||[article.title,article.summary,article.category].join(" ").toLowerCase().includes(query.toLowerCase().trim()))
  ),[articles,category,query]);
  return <DashboardShell role="client" title="Knowledge base" description="Guides and assistance for your Octalve services.">
    <DashboardPage eyebrow="Help centre" title="Knowledge base" description="Find clear answers and useful step-by-step guides.">
      <div className="space-y-6">
        <KnowledgeBaseHero query={query} onQueryChange={setQuery}/>
        <div className="flex flex-wrap gap-2" aria-label="Guide categories">{categories.map(item=><button key={item} type="button"
          aria-pressed={category===item} onClick={()=>setCategory(item)}
          className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${category===item?"bg-[#0064E0] text-white":"border border-slate-200 bg-white text-slate-600 hover:bg-blue-50"}`}>{item}</button>)}</div>
        {loading&&<p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading guides…</p>}
        {error&&<p role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">{error}</p>}
        {!loading&&!error&&results.length===0&&<div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
          <FileText className="mx-auto h-9 w-9 text-[#0064E0]"/>
          <h3 className="mt-4 text-base font-bold text-slate-950">{articles.length?"No matching guides yet.":"Our help articles are being prepared."}</h3>
          <p className="mt-2 text-sm text-slate-500">You can still reach our team through a private support ticket.</p>
          <Link href="/client/support/new" className="mt-5 inline-flex rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-semibold text-white">Contact support</Link>
        </div>}
        {!loading&&!error?<HelpArticleCards articles={results} baseHref="/client/knowledge-base"/>:null}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-[#EAF3FF] p-3 text-[#0064E0]"><LifeBuoy className="h-5 w-5"/></span>
            <div><h3 className="text-base font-bold text-slate-950">Need a hand?</h3>
              <p className="mt-1 text-sm text-slate-600">Send your question directly to our support team.</p></div>
          </div>
          <Link href="/client/support/new" className="rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-semibold text-white">Open support ticket</Link>
        </section>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
