"use client";
import {useEffect,useState} from "react";
import {Gift,Users,Copy,Medal,Coins} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {clientApi,type CustomerRewardOverview} from "@/lib/api/endpoints";

export function ClientRewardsView(){
  const [data,setData]=useState<CustomerRewardOverview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [agreed,setAgreed]=useState(false);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let active=true;
    clientApi.rewards().then(result=>{if(active)setData(result);})
      .catch(()=>{if(active)setError("Rewards are being prepared. Existing purchases and invoices are not affected.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  async function apply(){
    if(!data||!agreed||working)return;
    setWorking(true);setMessage("");setError("");
    try{
      const reply=await clientApi.affiliateApply(data.affiliate.terms_version);
      setData({...data,affiliate:{...data.affiliate,status:reply.status as CustomerRewardOverview["affiliate"]["status"],
        referral_code:reply.referral_code}});
      setMessage("Your affiliate application has been submitted for review.");
    }catch{setError("We couldn't submit your request. Please try again.");}
    finally{setWorking(false);}
  }
  async function copyLink(){
    const code=data?.affiliate.referral_code;
    if(!code||typeof window==="undefined")return;
    const link=new URL("/signup",window.location.origin);
    link.searchParams.set("ref",code);
    try{await navigator.clipboard.writeText(link.toString());setMessage("Referral signup link copied.");}
    catch{setMessage("Copy isn't available in this browser. Use your referral code: "+code);}
  }
  return <DashboardShell role="client" title="O-Cloud Rewards"
    description="Celebrate your Octalve Cloud journey, invite friends and review approved benefits.">
    <DashboardPage eyebrow="My account" title="Rewards & Referrals"
      description="Recognising your support with transparent, responsibly managed benefits.">
      <div className="space-y-5">
        {loading?<Panel><p role="status" className="text-sm text-console-muted">Opening your rewards…</p></Panel>:null}
        {error?<Panel><p role="status" className="text-sm text-console-muted">{error}</p></Panel>:null}
        {data?<div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Panel><Coins className="h-6 w-6 text-console-primary"/><h2 className="mt-3 text-sm font-medium">O-Cloud Points</h2>
              <p className="mt-2 text-3xl font-medium text-console-ink">{data.points.balance.toLocaleString("en-NG")}</p>
              <p className="mt-1 text-xs text-console-muted">Non-cash loyalty points</p></Panel>
            <Panel><Users className="h-6 w-6 text-console-primary"/><h2 className="mt-3 text-sm font-medium">Referred signups</h2>
              <p className="mt-2 text-3xl font-medium text-console-ink">{data.affiliate.attributed_signups}</p>
              <p className="mt-1 text-xs text-console-muted">Verified link attribution, not website visitors</p></Panel>
            <Panel><Gift className="h-6 w-6 text-console-primary"/><h2 className="mt-3 text-sm font-medium">Available offers</h2>
              <p className="mt-2 text-lg font-medium text-console-ink">{data.offer?.title||"Not available yet"}</p>
              <p className="mt-1 text-xs text-console-muted">Admin-approved tier eligibility</p></Panel>
          </div>
          <Panel>
            <h2 className="text-lg font-medium text-console-ink">Your points and offers</h2>
            <p className="mt-2 text-sm text-console-muted">
              You've earned {data.points.earned} points. Points cannot be withdrawn or exchanged for cash.
            </p>
            {data.offer?<div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="font-medium text-console-ink">{data.offer.title}</p>
              <p className="mt-2 text-sm text-console-muted">
                Up to {data.offer.discount_percent}% on eligible orders,
                capped at ₦{Number(data.offer.max_discount_ngn).toLocaleString("en-NG")}.
              </p>
              <p className="mt-2 text-xs text-console-muted">{data.offer.explanation}</p>
            </div>:<p className="mt-3 text-sm text-console-muted">
              New offers will appear when an Admin-approved programme is active and your points qualify.
            </p>}
            <p className="mt-4 text-xs text-console-muted">
              Discounts are not currently enabled at checkout. A benefit can only be redeemed
              after verifying the actual item, supplier cost, existing discounts and minimum margin.
            </p>
          </Panel>
          <Panel>
            <h2 className="text-lg font-medium text-console-ink">Affiliate Programme</h2>
            <p className="mt-2 text-sm text-console-muted">
              Status: <strong className="capitalize">{data.affiliate.status.replaceAll("_"," ")}</strong>.
              Eligible signup attribution and payable commissions are different milestones.
            </p>
            {data.affiliate.status==="not_applied"?<div className="mt-5 space-y-4">
              <p className="text-sm leading-6 text-console-muted">
                Apply to share your unique signup link. Applications are reviewed before
                commission eligibility. Self-referrals, artificial signups, refunded orders
                and unverified transactions do not earn commissions. Programme rates and
                payout schedules require separate published approval.
              </p>
              <label className="flex items-start gap-3 text-sm text-console-ink">
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-blue-600"/>
                <span>I accept the current affiliate programme conditions, including manual approval
                and no guaranteed commission or payout at signup.</span>
              </label>
              <ActionButton onClick={()=>void apply()} disabled={!agreed||working}
                loading={working}>Apply to become an Affiliate</ActionButton>
            </div>:<div className="mt-4 space-y-3">
              {data.affiliate.referral_code?<div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-console-muted">Your unique signup referral code</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="text-base font-medium text-console-ink">{data.affiliate.referral_code}</code>
                  <ActionButton variant="outline" onClick={()=>void copyLink()}
                    leadingIcon={<Copy className="h-4 w-4"/>}>Copy signup link</ActionButton>
                </div>
              </div>:null}
              <p className="text-sm text-console-muted">
                Pending commissions: ₦{data.affiliate.commissions_ngn.pending}.
                Approved: ₦{data.affiliate.commissions_ngn.approved}.
                Payouts remain disabled until financial reconciliation and payout approval.
              </p>
            </div>}
          </Panel>
          {data.recognition.length?<Panel>
            <h2 className="flex items-center gap-2 text-lg font-medium text-console-ink">
              <Medal className="h-5 w-5 text-console-primary"/>A thank-you from Octalve Cloud</h2>
            {data.recognition.map(item=><div key={item.id} className="mt-4 rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-medium text-console-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-console-muted">{item.message}</p>
            </div>)}
          </Panel>:null}
        </div>:null}
        {message?<p role="status" className="text-sm text-emerald-700">{message}</p>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
