"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ShieldCheck} from "lucide-react";
import {authApi} from "@/lib/api/endpoints";
import {AuthLayout} from "@/features/auth/components/AuthLayout";

export function VerifyEmailPageClient(){
  const [token,setToken]=useState("");
  const [state,setState]=useState<"ready"|"working"|"verified">("ready");
  const [message,setMessage]=useState("");
  useEffect(()=>{
    const value=new URLSearchParams(window.location.hash.slice(1)).get("token")||"";
    if(value)setToken(value);
    // Remove secret fragment from address bar once read into component state.
    if(window.location.hash)window.history.replaceState(null,"",window.location.pathname);
    if(!value)setMessage("This verification link is invalid or incomplete.");
  },[]);
  async function confirm(){
    if(!token||state==="working")return;
    setState("working");setMessage("");
    try{
      await authApi.confirmEmailVerification(token);
      setState("verified");setToken("");
      setMessage("Your email address has been verified.");
    }catch{
      setState("ready");
      setMessage("This link is invalid, expired or already used. Sign in and request a new link.");
    }
  }
  return <AuthLayout icon={ShieldCheck} title="Verify your email"
    description="Confirm your address to secure your Octalve Cloud account."
    sideTitle="One account. Secure access."
    sideDescription="Verify the email address linked to your Octalve Cloud services.">
    <div className="space-y-5">
      {message?<p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{message}</p>:null}
      {state!=="verified"?<button type="button" onClick={confirm} disabled={!token||state==="working"}
        className="w-full rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {state==="working"?"Verifying…":"Confirm email address"}
      </button>:null}
      <Link href="/client/profile" className="block text-center text-sm font-medium text-[#0064E0]">Back to account details</Link>
    </div>
  </AuthLayout>;
}
