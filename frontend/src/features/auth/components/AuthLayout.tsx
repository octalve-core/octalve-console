import Link from "next/link";
import type {ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {Home} from "lucide-react";
import {AuthBrandLogo} from "./AuthBrandLogo";
import styles from "./AuthLayout.module.css";

type AuthLayoutProps={
  title:string;description:string;sideTitle:string;sideDescription:string;
  icon:LucideIcon;children:ReactNode;
};

/** Five independent Next routes share the exact scenic-form frame.
 * The preview's hash navigation/DOM scripts and mock authentication never ship.
 * All existing Django-backed form handlers remain in their page components.
 */
export function AuthLayout({title,description,icon:Icon,children}:AuthLayoutProps){
  const isPrimary=title.toLowerCase().includes("account")||title.toLowerCase().includes("welcome");
  return <>
    <main className={styles.art} id="main">
      <section aria-label="Octalve Cloud account access" className={styles.frame}>
        <header className={styles.top}>
          <div className={styles.logo}><AuthBrandLogo/></div>
          <Link href="https://cloud.octalve.com" className={styles.home} aria-label="Back to Octalve Cloud home">
            <Home size={19} strokeWidth={2.2} aria-hidden="true"/>
            <span>Back to home</span>
          </Link>
        </header>
        <div className={styles.screen}>
          {!isPrimary?<span className={styles.badge} aria-hidden="true"><Icon size={23} strokeWidth={1.8}/></span>:null}
          <h1 className={styles.heading}>{title}</h1>
          {description?<p className={styles.description}>{description}</p>:null}
          {children}
        </div>
      </section>
    </main>
    <footer className={styles.bottom}>
      <div>Powered by <Link href="https://octalve.com" className={styles.bottomBrand}>Octalve Holding</Link></div>
      <div className={styles.bottomLinks}>
        <span>© {new Date().getFullYear()} Octalve. All rights reserved.</span>
        <span aria-hidden="true">·</span>
        <Link href="https://cloud.octalve.com/privacy-policy" className={styles.link}>Privacy Policy</Link>
        <span aria-hidden="true">·</span>
        <Link href="https://cloud.octalve.com/terms-of-service" className={styles.link}>Terms of Service</Link>
      </div>
    </footer>
  </>;
}

export {AuthInput,AuthPasswordInput,AuthButton,authFieldIcons} from "./AuthFormControls";
