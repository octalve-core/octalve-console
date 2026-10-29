import Link from "next/link";
import {ArrowRight,FileText} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import type {HelpArticle} from "@/lib/api/modules/help-center.api";
export function HelpArticleCards({articles,baseHref,editor=false}:{
 articles:readonly HelpArticle[];baseHref:string;editor?:boolean;
}){
 return <ul aria-label="Knowledge articles" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
  {articles.map(article=><li key={article.id} className="min-w-0">
   <Link href={baseHref+"/"+encodeURIComponent(article.slug)}
    className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <Panel className="flex h-full min-h-52 flex-col transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/30">
     <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-console-primary">
       <FileText aria-hidden="true" className="h-4 w-4"/>{article.category}
      </span>
      {editor?<StatusBadge tone={article.status==="published"?"success":"neutral"}>{article.status}</StatusBadge>:null}
     </div>
     <h3 className="mt-4 break-words text-lg font-medium text-console-ink">{article.title}</h3>
     <p className="mt-2 line-clamp-3 text-sm leading-6 text-console-muted">{article.summary}</p>
     <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-console-primary">
      {editor?"Open guide":"Read guide"}<ArrowRight aria-hidden="true" className="h-4 w-4"/>
     </span>
    </Panel>
   </Link>
  </li>)}
 </ul>;
}
