import type {MonthlyCount,MonthlyMoney} from "./contracts";
import {monthLabel,formatMoney} from "./contracts";
import {Panel} from "@/components/design-system/Panel";

const W=760,H=238,LEFT=44,RIGHT=18,TOP=19,BOTTOM=33;
const plotW=W-LEFT-RIGHT,plotH=H-TOP-BOTTOM;
function axisLabel(value:number):string{
 if(value>=1e9)return (value/1e9).toFixed(1)+"b";
 if(value>=1e6)return (value/1e6).toFixed(1)+"m";
 if(value>=1e3)return (value/1e3).toFixed(0)+"k";
 return String(Math.round(value));
}
/** SVG is presentation only; all authoritative values remain decimal strings. */
export function MonthlyPaymentsChart({rows,currency}:{rows:readonly MonthlyMoney[];currency:string}){
 const series=rows.slice(-12).map(x=>({...x,value:Number(x.amount)}));
 const valid=series.length>0&&series.every(x=>Number.isFinite(x.value)&&x.value>=0);
 if(!valid)return <Panel><h2 className="text-sm font-medium">Monthly payment trend</h2>
  <p className="mt-5 text-sm text-console-muted">No qualifying payment activity to chart yet.</p></Panel>;
 const max=Math.max(1,...series.map(x=>x.value));
 const step=plotW/series.length,width=Math.min(36,step*.58);
 return <Panel>
  <h2 className="text-sm font-medium text-console-ink">Monthly payment trend</h2>
  <p className="mt-1 text-xs text-console-muted">Gateway-verified payment records · {currency} · last 12 months</p>
  <div className="mt-5 w-full overflow-x-auto">
   <svg viewBox={`0 0 ${W} ${H}`} className="h-auto min-w-[520px] w-full" role="img"
     aria-label="Column chart of monthly verified payment amounts">
    {[0,.25,.5,.75,1].map(t=>{
     const y=TOP+plotH*(1-t);
     return <g key={t}><line x1={LEFT} x2={W-RIGHT} y1={y} y2={y} stroke="#edf2f7"/>
      <text x={LEFT-8} y={y+4} textAnchor="end" fontSize="10" fill="#8292a6">{axisLabel(max*t)}</text></g>;
    })}
    {series.map((entry,i)=>{
     const x=LEFT+step*(i+.5),height=plotH*entry.value/max,y=TOP+plotH-height;
     return <g key={entry.month}>
      <rect x={x-width/2} y={y} width={width} height={height}
        rx="4" fill={i===series.length-1?"#0064e0":"#7aa9f3"}>
       <title>{monthLabel(entry.month)+": "+formatMoney(entry.amount,currency)}</title>
      </rect>
      <text x={x} y={H-8} textAnchor="middle" fontSize="10" fill="#788a9f">{monthLabel(entry.month).split(" ")[0]}</text>
     </g>;
    })}
   </svg>
  </div>
 </Panel>;
}
export function RegistrationTrendChart({rows}:{rows:readonly MonthlyCount[]}){
 const series=rows.slice(-12),max=Math.max(1,...series.map(x=>x.count));
 if(!series.length)return <Panel><h2 className="text-sm font-medium">Customer registration trend</h2>
  <p className="mt-5 text-sm text-console-muted">Registration trends will appear as customers join.</p></Panel>;
 const step=series.length===1?0:plotW/(series.length-1);
 const points=series.map((x,i)=>{
  const px=series.length===1?LEFT+plotW/2:LEFT+i*step;
  return {x:px,y:TOP+plotH*(1-x.count/max),month:x.month,count:x.count};
 });
 return <Panel>
  <h2 className="text-sm font-medium text-console-ink">Customer growth</h2>
  <p className="mt-1 text-xs text-console-muted">Monthly new registrations</p>
  <div className="mt-5 w-full overflow-x-auto">
   <svg viewBox={`0 0 ${W} ${H}`} className="h-auto min-w-[520px] w-full"
     role="img" aria-label="Line chart showing new customer registrations by month">
    {[0,.25,.5,.75,1].map(t=><g key={t}>
     <line x1={LEFT} x2={W-RIGHT} y1={TOP+plotH*(1-t)} y2={TOP+plotH*(1-t)} stroke="#edf2f7"/>
     <text x={LEFT-8} y={TOP+plotH*(1-t)+4} textAnchor="end" fontSize="10" fill="#8292a6">{Math.round(max*t)}</text>
    </g>)}
    <polyline fill="none" stroke="#0f9d78" strokeWidth="3" strokeLinecap="round"
      strokeLinejoin="round" points={points.map(p=>p.x+","+p.y).join(" ")}/>
    {points.map(p=><g key={p.month}>
     <circle cx={p.x} cy={p.y} r="4.5" fill="#0f9d78" stroke="white" strokeWidth="2">
      <title>{monthLabel(p.month)+": "+p.count+" new customers"}</title>
     </circle>
     <text x={p.x} y={H-8} textAnchor="middle" fontSize="10" fill="#788a9f">{monthLabel(p.month).split(" ")[0]}</text>
    </g>)}
   </svg>
  </div>
 </Panel>;
}
const STATUS_COLORS:Record<string,string>={paid:"#0865e9",unpaid:"#f4bc59",overdue:"#f08181",partially_paid:"#9b82e9",draft:"#cbd5e1",void:"#64748b",cancelled:"#94a3b8",refunded:"#1da983"};
export function InvoiceStatusChart({statuses}:{statuses:Record<string,number>}){
 const entries=Object.entries(statuses).filter(([,count])=>count>0);
 const total=entries.reduce((sum,[,count])=>sum+count,0);
 if(!total)return <Panel><h2 className="text-sm font-medium">Invoice status breakdown</h2>
  <p className="mt-5 text-sm text-console-muted">Invoice activity will appear here when available.</p></Panel>;
 let end=0;
 const segments=entries.map(([key,count],i)=>{const start=end;end+=count/total*100;
  return `${STATUS_COLORS[key]||["#0064e0","#10b981","#a78bfa"][i%3]} ${start}% ${end}%`;});
 return <Panel>
  <h2 className="text-sm font-medium text-console-ink">Invoice collection status</h2>
  <p className="mt-1 text-xs text-console-muted">Recorded invoice states, not bank settlements</p>
  <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
   <div className="relative h-36 w-36 shrink-0 rounded-full" role="img"
    aria-label={total+" invoices grouped by status"}
    style={{background:"conic-gradient("+segments.join(",")+")"}}>
    <div className="absolute inset-[27px] flex flex-col items-center justify-center rounded-full bg-white">
     <span className="text-2xl font-medium tabular-nums text-console-ink">{total.toLocaleString("en-NG")}</span>
     <span className="text-xs text-console-muted">invoices</span>
    </div>
   </div>
   <dl className="grid w-full flex-1 grid-cols-2 gap-3">
    {entries.map(([status,count],i)=><div key={status} className="min-w-0">
     <dt className="flex items-center gap-2 text-xs capitalize text-console-muted">
      <span aria-hidden="true" className="h-2 w-2 rounded-full"
        style={{backgroundColor:STATUS_COLORS[status]||["#0064e0","#10b981","#a78bfa"][i%3]}}/>
      {status.replaceAll("_"," ")}
     </dt><dd className="mt-1 text-base font-medium tabular-nums text-console-ink">{count.toLocaleString("en-NG")}</dd>
    </div>)}
   </dl>
  </div>
 </Panel>;
}
