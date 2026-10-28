import Link from "next/link";
import type {ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {AuthBrandLogo} from "./AuthBrandLogo";
import {AuthBrandPanel} from "./AuthBrandPanel";
import styles from "./AuthLayout.module.css";

type AuthLayoutProps={
 title:string;description:string;sideTitle:string;sideDescription:string;
 icon:LucideIcon;children:ReactNode;
};

export function AuthLayout({title,description,sideTitle,sideDescription,icon:Icon,children}:AuthLayoutProps){
 return <main className="min-h-dvh bg-console-canvas px-3 py-5 text-console-ink sm:px-6 sm:py-7">
  <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-[1180px] items-center justify-center">
   <div className={`${styles.frame} overflow-hidden rounded-[28px] border border-console-line bg-white shadow-xl lg:min-h-[680px]`}>
    <AuthBrandPanel sideTitle={sideTitle} sideDescription={sideDescription}/>
    <section className="flex min-w-0 items-center justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-12">
     <div className="w-full max-w-[432px] min-w-0">
      <div className="mb-8 flex justify-center lg:hidden"><AuthBrandLogo/></div>
      <header className="text-center">
       <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-console-primary">
        <Icon aria-hidden="true" className="h-8 w-8"/>
       </span>
       <h2 className="mt-6 text-3xl font-semibold tracking-tight text-console-ink sm:text-[34px]">{title}</h2>
       <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-console-muted">{description}</p>
      </header>
      <div className="mt-8">{children}</div>
     </div>
    </section>
   </div>
  </div>
  <footer className="mx-auto mt-5 flex max-w-[1180px] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs text-console-muted">
   <span>© 2026 Octalve. All rights reserved.</span>
   <span aria-hidden="true">•</span>
   <Link href="https://octalve.cloud/privacy-policy" className="text-console-primary hover:underline">Privacy Policy</Link>
   <span aria-hidden="true">•</span>
   <Link href="https://octalve.cloud/terms-of-service" className="text-console-primary hover:underline">Terms of Service</Link>
  </footer>
 </main>;
}

export {AuthInput,AuthPasswordInput,AuthButton,authFieldIcons} from "./AuthFormControls";
