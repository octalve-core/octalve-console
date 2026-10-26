"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
for(const configPath of ["../tailwind.config.js","../tailwind.config.ts"]){
 const config=fs.readFileSync(path.resolve(__dirname,configPath),"utf8");
 if(!config.includes("./src/features/support/**/*.{js,ts,jsx,tsx,mdx}"))
  throw Error("Batch 5 support Tailwind content path is not scanned by "+configPath);
}
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
function required(file,items){
 const text=read(file);
 for(const token of items)if(!text.includes(token))throw Error(file+": required support/knowledge contract missing: "+token);
}
required("features/client/views/ClientSupportTicketEditorView.tsx",[
 "helpApi.departments()","helpApi.topics()","item.is_active","clientApi.createTicket({",
 "department_id:Number(department)","routing_tag_id:topic?Number(topic):null",
 "if(!response.id||!response.ticket_number)","SupportRequestFields"
]);
required("features/support/components/SupportRequestFields.tsx",[
 "SelectField","TextField","TextAreaField","onChange(\"topic\",\"\")",
 "relevant=topics.filter(item=>String(item.department)===values.department)",
 'minLength={10}','maxLength={20000}','type="submit"'
]);
required("components/modules/SupportDeskView.tsx",[
 "supportApi.tickets()","asList(result","open.has(t.status)","SupportTicketCards",
 "role={role}","TextField"
]);
required("components/modules/ClientSupportHomeView.tsx",[
 "clientApi.tickets()","SupportTicketCards","TextField","role=\"client\""
]);
required("features/support/components/SupportTicketCards.tsx",[
 'role==="staff"?"/staff/tickets":role==="admin"?"/admin/support":"/client/support"',
 "ticket.ticket_number","ticket.department_name","ticket.status.replaceAll"
]);
required("components/modules/TicketConversationView.tsx",[
 "helpApi.ticket(id)","helpApi.reply(id,reply.trim(),role===\"client\"?false:internal)",
 "helpApi.action(id,{action,...(staff_id?{staff_id}:{})})",
 "if(!department?.assigned_staff.includes(agent.id))return false",
 "topic?.assigned_staff.includes(agent.id)","TicketMessageThread","TicketReplyComposer",
 "TicketContextPanels","canReply"
]);
required("features/support/components/TicketReplyComposer.tsx",[
 'role!=="client"','Internal note (hidden from customer)','disabled={!reply.trim()}'
]);
required("features/support/components/TicketContextPanels.tsx",[
 'role==="admin"',"eligibleAgents.map","onAssign(id)","onAction(\"reopen\")",
 'role!=="client"',"onAction(\"resolve\")","onAction(\"close\")"
]);
required("components/modules/SupportTeamSettingsView.tsx",[
 "helpApi.departments()","helpApi.topics()","helpApi.agents()",
 "helpApi.updateDepartment(dept.id,next)","helpApi.updateTopic(topic.id,next)",
 "helpApi.createDepartment(departmentName.trim())","helpApi.createTopic(dept.id,name.trim(),clean)",
 "topic?topic.assigned_staff:dept.assigned_staff","SupportRoutingCreateForms"
]);
required("features/support/components/SupportRoutingCreateForms.tsx",[
 "onCreateDepartment","onCreateTopic","hasDepartment","TextField","ActionButton"
]);
required("features/client/views/ClientKnowledgeBaseView.tsx",[
 "helpApi.articles()","asList(response)","article.category===category","HelpArticleCards"
]);
required("features/client/views/ClientKnowledgeArticleView.tsx",[
 "helpApi.article(slug)","MarkdownArticle","Panel"
]);
required("components/modules/HelpManageView.tsx",[
 "helpApi.article(slug)","helpApi.articles()","helpApi.update(slug,form)",
 "helpApi.create(form)","result.status===\"published\"","HelpArticleFormFields","HelpArticleCards"
]);
required("features/support/components/HelpArticleFormFields.tsx",[
 "MarkdownEditor","onChange({body_markdown:value})","visibility","published","type=\"submit\""
]);
required("features/support/components/HelpArticleCards.tsx",[
 "article.slug","article.status","editor","HelpArticle"]);
for(const file of [
 "features/support/components/SupportRequestFields.tsx",
 "features/support/components/SupportTicketCards.tsx",
 "features/support/components/TicketMessageThread.tsx",
 "features/support/components/TicketReplyComposer.tsx",
 "features/support/components/TicketContextPanels.tsx",
 "features/support/components/SupportRoutingCreateForms.tsx",
 "features/support/components/HelpArticleFormFields.tsx",
 "features/support/components/HelpArticleCards.tsx"
]){
 const source=read(file);
 if(/from\s*["'][^"']+\.css["']/.test(source)||/\b(?:clientApi|helpApi|supportApi)\b|\bfetch\s*\(/.test(source))
  throw Error(file+": presentational component cannot import CSS or own API authority");
}
if(process.argv.includes("--built")){
 const dir=path.resolve(__dirname,"../.next/static"),css=[];
 function scan(folder){
  if(!fs.existsSync(folder))return;
  for(const e of fs.readdirSync(folder,{withFileTypes:true})){
   const p=path.join(folder,e.name);if(e.isDirectory())scan(p);else if(e.name.endsWith(".css"))css.push(p);
  }
 }
 scan(dir);
 if(!css.length)throw Error("Generated Tailwind CSS not found");
 const styles=css.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".text-console-ink",".border-console-line",".min-h-48"])
  if(!styles.includes(token))throw Error("Batch5 Tailwind utility absent from production CSS: "+token);
}
console.log("PASS: Batch 5 Support and Knowledge UI, role paths, ticket routing and article authority protected");
