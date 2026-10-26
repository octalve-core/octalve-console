"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {useParams,useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,BookOpen,FilePlus2,Search,Save,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {MarkdownEditor} from "@/components/modules/MarkdownEditor";
import {helpApi,asList,type HelpArticle,type HelpArticleWrite} from "@/lib/api/modules/help-center.api";

type Area="admin"|"staff";
const blank:HelpArticleWrite={title:"",category:"",summary:"",body_markdown:"",status:"draft",visibility:"client"};
const field="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]";
export function HelpManageView({role,editor=false,newArticle=false}:{role:Area;editor?:boolean;newArticle?:boolean}){
  const router=useRouter(),params=useParams<{id:string}>();
  const slug=String(params.id||"");
  const [items,setItems]=useState<HelpArticle[]>([]),[form,setForm]=useState<HelpArticleWrite>(blank);
  const [query,setQuery]=useState(""),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);
  const [notice,setNotice]=useState(""),[error,setError]=useState("");
  const path=`/${role}/knowledge-base`;
  useEffect(()=>{let active=true;
    const req=editor&&!newArticle?helpApi.article(slug):helpApi.articles();
    req.then(result=>{if(!active)return;
      if(editor&&!newArticle){const item=result as HelpArticle;
        setForm({title:item.title,category:item.category,summary:item.summary,
          body_markdown:item.body_markdown,status:item.status,visibility:item.visibility});
      }else if(!editor)setItems(asList(result as HelpArticle[]|{results:HelpArticle[]}));
    }).catch(()=>{if(active)setError("We couldn't open these articles. Check your access and try again.");})
    .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[editor,newArticle,slug]);
  const filtered=useMemo(()=>items.filter(item=>
    [item.title,item.summary,item.category,item.status].join(" ").toLowerCase().includes(query.toLowerCase())
  ),[items,query]);
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(saving)return;setSaving(true);setError("");setNotice("");
    try{
      const result=editor&&!newArticle?await helpApi.update(slug,form):await helpApi.create(form);
      setNotice(result.status==="published"?"Article published.":"Draft saved.");
      if(newArticle)router.replace(`${path}/${encodeURIComponent(result.slug)}`);
    }catch{setError("Couldn't save your article. Verify permissions and all required fields.");}
    finally{setSaving(false);}
  }
  return <DashboardShell role={role} title="Knowledge base" description="Write, review and publish accurate support guides.">
    <DashboardPage eyebrow="Help centre" title={editor?(newArticle?"Write a new guide":"Edit knowledge article"):"Manage knowledge articles"}
      description={editor?"Create clear steps with formatting and check the preview before publishing.":"Keep your support information accurate, searchable and easy to read."}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={editor?path:role==="admin"?"/admin/support":"/staff/tickets"}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>Back</Link>
          {!editor?<Link href={`${path}/new`} className="inline-flex items-center gap-2 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white"><FilePlus2 className="h-4 w-4"/>New guide</Link>:null}
        </div>
        {error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
        {notice?<p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{notice}</p>:null}
        {loading?<p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-500">Opening the knowledge base…</p>:null}
        {!loading&&editor?<form onSubmit={save} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <label className="block"><span className="mb-2 block text-sm font-medium">Article title</span>
              <input required maxLength={180} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className={field}/></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="mb-2 block text-sm font-medium">Category</span>
                <input required maxLength={80} placeholder="Domains / DNS" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={field}/></label>
              <label><span className="mb-2 block text-sm font-medium">Visibility</span>
                <select value={form.visibility} onChange={e=>setForm(f=>({...f,visibility:e.target.value as HelpArticleWrite["visibility"]}))} className={field}>
                  <option value="client">Customer help centre</option><option value="internal">Internal staff only</option>
                </select></label>
            </div>
            <label className="block"><span className="mb-2 block text-sm font-medium">Short article summary</span>
              <textarea required maxLength={320} rows={2} value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))}
                className="w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]"/></label>
            <MarkdownEditor value={form.body_markdown} onChange={value=>setForm(f=>({...f,body_markdown:value}))}/>
          </div>
          <aside className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-white p-5 xl:sticky xl:top-24">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#0064E0]"/><h3 className="font-medium">Publication</h3></div>
            <p className="text-sm leading-6 text-slate-600">Drafts remain private. Only approved published articles are shown in the customer help centre.</p>
            <label className="block"><span className="mb-2 block text-sm font-medium">Status</span>
              <select className={field} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as HelpArticleWrite["status"]}))}>
                <option value="draft">Draft</option><option value="published">Published (permission required)</option>
              </select></label>
            <button type="submit" disabled={saving||loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">
              <Save className="h-4 w-4"/>{saving?"Saving…":"Save article"}</button>
          </aside>
        </form>:null}
        {!loading&&!editor?<div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><Search className="h-5 w-5 text-slate-400"/>
            <input aria-label="Search articles" placeholder="Search guides, categories and drafts…" className="min-w-0 flex-1 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(article=><Link key={article.id} href={`${path}/${encodeURIComponent(article.slug)}`}
            className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-sm">
            <div className="flex items-start justify-between gap-2"><BookOpen className="h-5 w-5 text-[#0064E0]"/>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${article.status==="published"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-600"}`}>{article.status}</span></div>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-[#0064E0]">{article.category}</p>
            <h3 className="mt-2 text-base font-medium text-slate-950">{article.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{article.summary}</p>
          </Link>)}</div>
          {!filtered.length?<p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No articles found. Create a guide to get started.</p>:null}
        </div>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
