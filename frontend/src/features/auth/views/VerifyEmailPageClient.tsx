"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Loader2,MailCheck,ShieldCheck} from "lucide-react";
import {authApi} from "@/lib/api/endpoints";
import {AuthLayout} from "@/features/auth/components/AuthLayout";
import styles from "../components/AuthLayout.module.css";

/** The supplied preview draws a six-digit OTP entry, but Console's current
 * backend verifies a signed email-link token, not an arbitrary six-digit PIN.
 * This keeps the fifth screen while refusing to fake verification success.
 */
export function VerifyEmailPageClient(){
 const [token,setToken]=useState("");
 const [state,setState]=useState<"ready"|"working"|"verified">("ready");
 const [message,setMessage]=useState("");
 useEffect(()=>{
  const value=new URLSearchParams(window.location.hash.slice(1)).get("token")||"";
  if(value)setToken(value);
  if(window.location.hash)window.history.replaceState(null,"",window.location.pathname+window.location.search);
  if(!value)setMessage("Open the secure verification link from your email to confirm your address. Six-digit code entry is not enabled for this account.");
 },[]);
 async function confirm(){
  if(!token||state==="working")return;
  setState("working");setMessage("");
  try{
   await authApi.confirmEmailVerification(token);
   setState("verified");setToken("");setMessage("Your email address has been verified.");
  }catch{
   setState("ready");setMessage("This link is invalid, expired or already used. Please use a new verification link.");
  }
 }
 return <AuthLayout icon={ShieldCheck} title="Verify your email"
  description="Use the secure verification link sent to your email address."
  sideTitle="One account. Secure access."
  sideDescription="Confirm the email address linked to your Octalve Cloud services.">
  <div className={styles.form}>
   <div className={styles.support}><MailCheck size={17} aria-hidden="true"/>
    <span>Verification links are validated by Octalve Cloud, not by this page.</span>
   </div>
   {message?<p role="status" className={styles.notice}>{message}</p>:null}
   {state!=="verified"?<button type="button" onClick={confirm} disabled={!token||state==="working"}
    className={styles.action}>
     {state==="working"?<><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/>Verifying…</>:"Confirm email address"}
   </button>:null}
   <p className={styles.footer}><Link href="/login" className={styles.link}>← Back to sign in</Link></p>
  </div>
 </AuthLayout>;
}
