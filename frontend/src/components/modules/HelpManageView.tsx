"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {useParams,useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,FilePlus2,Search} from "lucide-react";
import {HelpArticleCards} from "@/features/support/components/HelpArticleCards";
import {HelpArticleFormFields} from "@/features/support/components/HelpArticleFormFields";
import {TextField} from "@/components/design-system/TextField";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {helpApi,asList,type HelpArticle,type HelpArticleWrite} from "@/lib/api/modules/help-center.api";

type Area="admin"|"staff";
const blank:HelpArticleWrite={title:"",category:"",summary:"",body_markdown:"",status:"draft",visibility:"client"};
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
        {!loading&&editor?<form onSubmit={save} className="grid min-w-0 gap-5 xl:grid-cols-3">
          <HelpArticleFormFields form={form} saving={saving} loading={loading}
            onChange={next=>setForm(current=>({...current,...next}))}/>
        </form>:null}
        {!loading&&!editor?<div className="space-y-5">
          <TextField label="Search knowledge articles" type="search"
            value={query} onChange={event=>setQuery(event.target.value)}
            startIcon={<Search aria-hidden="true" className="h-4 w-4"/>}
            placeholder="Search guides, categories and drafts…"/>
          <HelpArticleCards articles={filtered} editor baseHref={path}/>
          {!filtered.length?<p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No articles found. Create a guide to get started.</p>:null}
        </div>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
