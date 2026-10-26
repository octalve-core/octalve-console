import {api} from "@/lib/api/client";
export type HelpArticle={
 id:number;slug:string;title:string;category:string;summary:string;
 body_markdown:string;status:"draft"|"published";visibility:"client"|"internal";
 published_at:string|null;updated_at:string;
};
export type HelpArticleWrite=Pick<HelpArticle,"title"|"category"|"summary"|"body_markdown"|"status"|"visibility">;
export type Department={id:number;name:string;description:string|null;is_active:boolean;assigned_staff:number[];auto_assign:boolean};
export type SupportTopic={id:number;department:number;label:string;slug:string;is_active:boolean;assigned_staff:number[]};
export type SupportAgent={id:number;full_name:string;role:string};
export type TicketMessage={id:number;sender_name_display:string;sender_role:string;message:string;is_internal:boolean;created_at:string};
export type TicketDetail={id:number;ticket_number:string;subject:string;status:string;priority:string;
 department:number;department_name:string;routing_tag:number|null;assigned_to:number|null;assigned_to_name:string|null;
 client_name:string;messages:TicketMessage[];created_at:string};
export function asList<T>(data:T[]|{results:T[]}):T[]{return Array.isArray(data)?data:data.results||[];}
export const helpApi={
  articles:()=>api.get<HelpArticle[]|{results:HelpArticle[]}>("/knowledge-base/"),
  article:(slug:string)=>api.get<HelpArticle>(`/knowledge-base/${encodeURIComponent(slug)}/`),
  create:(body:HelpArticleWrite)=>api.post<HelpArticle>("/knowledge-base/",body),
  update:(slug:string,body:Partial<HelpArticleWrite>)=>api.patch<HelpArticle>(`/knowledge-base/${encodeURIComponent(slug)}/`,body),
  departments:()=>api.get<Department[]|{results:Department[]}>("/support/departments/"),
  topics:()=>api.get<SupportTopic[]|{results:SupportTopic[]}>("/support/tags/"),
  agents:()=>api.get<SupportAgent[]>("/support/agents/"),
  updateDepartment:(id:number,assigned_staff:number[])=>api.patch<Department>(`/support/departments/${id}/`,{assigned_staff}),
  updateTopic:(id:number,assigned_staff:number[])=>api.patch<SupportTopic>(`/support/tags/${id}/`,{assigned_staff}),
  createTopic:(department:number,label:string,slug:string)=>api.post<SupportTopic>("/support/tags/",{department,label,slug,is_active:true}),
  ticket:(id:string)=>api.get<TicketDetail>(`/support/tickets/${encodeURIComponent(id)}/`),
  reply:(id:string,message:string,is_internal=false)=>api.post(`/support/tickets/${encodeURIComponent(id)}/reply/`,{message,is_internal}),
  action:(id:string,body:{action:string;staff_id?:number;priority?:string;reason?:string})=>
    api.post(`/support/tickets/${encodeURIComponent(id)}/action/`,body),
};
