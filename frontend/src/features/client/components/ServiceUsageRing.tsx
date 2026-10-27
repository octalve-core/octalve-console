import {usagePercent} from "../utils/service-contract";
export function ServiceUsageRing({label,used,limit,compact=false}:{
  label:string;used:number;limit:number;compact?:boolean;
}){
  const percent=usagePercent(used,limit);
  const size=compact?"h-11 w-11":"h-20 w-20";
  if(percent===null)return <span className="text-xs text-console-muted">Usage unavailable</span>;
  const progress=Math.min(percent,100);
  const circumference=2*Math.PI*19;
  return <div className="flex items-center gap-2">
    <div role="progressbar" aria-label={label+" usage"} aria-valuemin={0}
      aria-valuemax={100} aria-valuenow={progress}
      aria-valuetext={percent+"% of allocated "+label.toLowerCase()+" used"}
      className={`relative shrink-0 ${size}`}>
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r="19" stroke="#E5EBF3" strokeWidth="5" fill="none"/>
        <circle cx="24" cy="24" r="19" stroke={percent>=90?"#EA580C":"#0064E0"}
          strokeWidth="5" strokeLinecap="round" fill="none"
          strokeDasharray={circumference} strokeDashoffset={circumference*(1-progress/100)}/>
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-semibold text-console-ink ${compact?"text-[10px]":"text-sm"}`}>
        {percent}%
      </span>
    </div>
    {!compact?<div className="text-xs text-console-muted">
      <span className="block font-semibold text-console-ink">{label}</span>
      {used.toLocaleString("en-NG")} / {limit.toLocaleString("en-NG")} MB
    </div>:null}
  </div>;
}
