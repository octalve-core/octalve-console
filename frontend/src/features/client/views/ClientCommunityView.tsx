"use client";
import {useEffect,useState} from "react";
import {UsersRound,ExternalLink,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {clientApi,type CustomerCommunityLinks} from "@/lib/api/endpoints";
export function ClientCommunityView(){
  const [result,setResult]=useState<CustomerCommunityLinks|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    clientApi.community().then(data=>{if(active)setResult(data);})
      .catch(()=>{if(active)setError(true);});
    return()=>{active=false;};
  },[]);
  const links=[
    {name:"WhatsApp Channel",href:result?.links.whatsapp},
    {name:"Telegram Community",href:result?.links.telegram},
  ];
  return <DashboardShell role="client" title="O-Cloud Clan" description="Your Octalve Cloud community.">
    <DashboardPage eyebrow="Community" title="Join O-Cloud Clan"
      description="Discover updates, learning resources and our official community channels.">
      <div className="space-y-5">
        <Panel>
          <h2 className="flex items-center gap-2 text-lg font-medium text-console-ink">
            <UsersRound className="h-5 w-5 text-console-primary"/>Welcome to the Clan</h2>
          <p className="mt-3 text-sm leading-6 text-console-muted">
            Connect with other customers and get product tips and announcements through approved channels.
            Joining is always optional. We never add you automatically.
          </p>
        </Panel>
        <div className="grid gap-4 md:grid-cols-2">
          {links.map(item=><Panel key={item.name}>
            <h2 className="text-base font-medium text-console-ink">{item.name}</h2>
            <p className="mt-2 text-sm text-console-muted">
              {item.href?"Official channel link configured.":"Our official invitation link isn't published yet."}
            </p>
            {item.href?<a href={item.href} target="_blank" rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 text-sm font-medium text-white">
              Open channel<ExternalLink className="h-4 w-4" aria-hidden="true"/>
            </a>:<p className="mt-5 text-sm font-medium text-console-muted">Coming soon</p>}
          </Panel>)}
        </div>
        {error?<p role="alert" className="text-sm text-console-muted">
          Community links are temporarily unavailable.
        </p>:null}
        <Panel>
          <p className="flex gap-3 text-sm leading-6 text-console-muted">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-console-primary"/>
            Before joining an external group, review its membership visibility and privacy settings.
            Octalve Cloud will never ask for your password or verification code in a community channel.
          </p>
        </Panel>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
