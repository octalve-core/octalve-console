import {AuthBrandLogo} from "./AuthBrandLogo";
export function AuthBrandPanel({sideTitle,sideDescription}:{
 sideTitle:string;sideDescription:string;
}){
 return <aside className="hidden min-w-0 flex-col justify-between bg-console-sidebar p-10 text-white lg:flex xl:p-12">
  <div>
   <AuthBrandLogo/>
   <div className="mt-20 max-w-md">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Octalve Console</p>
    <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">{sideTitle}</h1>
    <p className="mt-6 text-base leading-8 text-slate-300">{sideDescription}</p>
   </div>
  </div>
  <div aria-hidden="true" className="h-px w-full bg-white/15"/>
 </aside>;
}
