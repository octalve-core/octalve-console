export function StatusTabs({items,value,onChange,label}:{items:readonly string[];value:string;
 onChange:(next:string)=>void;label:string}){
 return <div aria-label={label+" status filters"} className="flex min-w-0 snap-x gap-2 overflow-x-auto border-b border-console-line px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5">
  {["all",...items].map(item=><button key={item} type="button" aria-pressed={value===item}
   onClick={()=>onChange(item)} className={`shrink-0 snap-start rounded-full px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-primary ${value===item?"bg-blue-50 text-console-primary":"bg-slate-100 text-console-muted hover:bg-slate-200"}`}>
   {item==="all"?"All":<span className="capitalize">{item.replaceAll("_"," ")}</span>}</button>)}
 </div>;
}
