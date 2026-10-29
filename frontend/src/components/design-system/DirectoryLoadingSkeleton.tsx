/** Matching responsive placeholder for the canonical Admin resource directory.
 * Decorative skeletons never contain fake customer records or counts.
 */
export function DirectoryLoadingSkeleton({label}:{label:string}) {
 const shimmer="animate-pulse motion-reduce:animate-none rounded-md bg-slate-100";
 return <section role="status" aria-busy="true" aria-live="polite"
  aria-label={`Loading ${label}`} className="min-w-0 overflow-hidden rounded-2xl border border-console-line bg-white shadow-sm">
  <span className="sr-only">Loading {label.toLowerCase()} from your account.</span>
  <div aria-hidden="true" className="border-b border-console-line p-4 sm:p-5">
   <div className="flex flex-col gap-3 md:flex-row md:items-center">
    <div className={`${shimmer} h-10 w-full md:max-w-xs`}/>
    <div className={`${shimmer} h-10 w-full md:ml-auto md:max-w-32`}/>
   </div>
  </div>
  <ul aria-hidden="true" className="space-y-2 p-3 md:hidden">
   {Array.from({length:3},(_,i)=><li key={i} className="rounded-xl bg-slate-50 p-3">
    <div className="flex items-center gap-3"><span className={`${shimmer} h-10 w-10 shrink-0 rounded-full`}/>
     <div className="min-w-0 flex-1 space-y-2"><div className={`${shimmer} h-3 w-2/3`}/><div className={`${shimmer} h-3 w-1/2`}/></div>
     <div className={`${shimmer} h-5 w-14`}/></div>
   </li>)}
  </ul>
  <div aria-hidden="true" className="hidden p-4 md:block">
   <div className={`${shimmer} mb-2 h-8 w-full`}/>
   {Array.from({length:5},(_,i)=><div key={i} className="flex items-center gap-5 border-b border-slate-100 px-3 py-4">
    <div className={`${shimmer} h-3 w-1/4`}/><div className={`${shimmer} h-3 w-1/3`}/>
    <div className={`${shimmer} ml-auto h-5 w-20`}/>
   </div>)}
  </div>
 </section>;
}
