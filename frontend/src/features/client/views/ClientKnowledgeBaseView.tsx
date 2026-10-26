"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,BookOpen,Search,LifeBuoy,Globe2} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {helpApi,asList,type HelpArticle} from "@/lib/api/modules/help-center.api";
export function ClientKnowledgeBaseView(){
  const [articles,setArticles]=useState<HelpArticle[]>([]);
  const [query,setQuery]=useState(""),[category,setCategory]=useState("All guides");
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let active=true;helpApi.articles().then(response=>{if(active)setArticles(asList(response));})
    .catch(()=>{if(active)setError("We couldn't load the help centre. Please reopen it shortly.");})
    .finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const cats=useMemo(()=>["All guides",...new Set(articles.map(a=>a.category))],[articles]);
  const shown=useMemo(()=>articles.filter(a=>{
    const q=query.trim().toLowerCase();
    return (category==="All guides"||a.category===category)&&
      (!q||[a.title,a.summary,a.category].join(" ").toLowerCase().includes(q));
  }),[articles,query,category]);
  return <DashboardShell role="client" title="Help centre" description="Clear guides and helpful answers for your Octalve Cloud services.">
    <DashboardPage eyebrow="Help centre" title="How can we help?"
      description="Find trusted step-by-step instructions for hosting, domains, billing and your account.">
      <div className="space-y-6">
        <section className="rounded-[1.75rem] bg-[#001426] px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-200"><BookOpen className="h-4 w-4"/> OCTALVE GUIDES</div>
          <h2 className="mt-3 max-w-xl text-2xl font-medium tracking-tight sm:text-3xl">Answers, without the wait.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Search our latest published articles, or send our support team a request.</p>
          <div className="mt-6 flex min-h-12 max-w-2xl items-center gap-3 rounded-xl bg-white px-4 text-slate-500">
            <Search className="h-5 w-5"/><input aria-label="Search articles" value={query}
              onChange={e=>setQuery(e.target.value)} placeholder="Search by topic, error or product…"
              className="w-full border-0 py-3 text-sm text-slate-950 outline-none"/>
          </div>
        </section>
        <div className="flex flex-wrap gap-2" aria-label="Knowledge categories">
          {cats.map(item=><button key={item} type="button" onClick={()=>setCategory(item)} aria-pressed={category===item}
            className={`rounded-full border px-4 py-2 text-xs font-medium ${category===item?"border-[#0064E0] bg-blue-50 text-[#0064E0]":"border-slate-200 bg-white text-slate-600"}`}>{item}</button>)}
        </div>
        {loading?<p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-500">Opening the help centre…</p>:null}
        {error?<p role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-700">{error}</p>:null}
        {!loading&&!error&&shown.length===0?<div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
          <Globe2 className="mx-auto h-8 w-8 text-[#0064E0]"/><p className="mt-3 text-base font-medium">No published guides match your search.</p>
          <p className="mt-2 text-sm text-slate-500">Try a different topic or contact our support team.</p>
        </div>:null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(article=><Link href={`/client/knowledge-base/${encodeURIComponent(article.slug)}`} key={article.id}
            className="group flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#0064E0]">{article.category}</span>
            <h3 className="mt-4 text-lg font-medium tracking-tight text-slate-950">{article.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{article.summary}</p>
            <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-medium text-[#0064E0]">Read guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span>
          </Link>)}
        </div>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-3"><LifeBuoy className="mt-1 h-5 w-5 text-[#0064E0]"/>
            <div><h3 className="text-base font-medium">Need more help?</h3><p className="mt-1 text-sm text-slate-600">Our team can follow up through a private support ticket.</p></div>
          </div>
          <Link href="/client/support/new" className="rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white">Open support ticket</Link>
        </section>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
