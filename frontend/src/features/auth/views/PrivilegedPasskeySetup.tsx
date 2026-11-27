"use client";

import Link from "next/link";
import {useRef,useState,type FormEvent} from "react";
import {enrollPrivilegedPasskey} from "@/lib/api/privileged-passkey";

export function PrivilegedPasskeySetup(){
  const busyRef=useRef(false);
  const [busy,setBusy]=useState(false);
  const [enrolled,setEnrolled]=useState(false);
  const [error,setError]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busyRef.current)return;
    const form=event.currentTarget;
    const data=new FormData(form);
    busyRef.current=true;
    setBusy(true);
    setError("");
    try{
      await enrollPrivilegedPasskey(String(data.get("code")??"").trim(),String(data.get("password")??""));
      form.reset();
      setEnrolled(true);
    }catch(error){
      setError(error instanceof Error?error.message:"Could not set up the passkey.");
    }finally{
      busyRef.current=false;
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-md px-4 py-12 text-console-ink">
    <h1 className="text-2xl font-medium">Set up a privileged passkey</h1>
    {enrolled?<p role="status" className="mt-4 text-sm">Your passkey is ready. <Link href="/login?passkey=verify" className="text-console-primary underline">Verify passkey sign-in</Link></p>:
    <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="text-sm text-console-muted">Use the one-time setup code issued by your authorized operator.</p>
      <label className="block text-sm">Setup code
        <input name="code" type="password" autoComplete="off" required minLength={43} maxLength={43}
          className="mt-1 block min-h-11 w-full rounded-xl border border-console-line px-3"/>
      </label>
      <label className="block text-sm">Account password
        <input name="password" type="password" autoComplete="current-password" required maxLength={1024}
          className="mt-1 block min-h-11 w-full rounded-xl border border-console-line px-3"/>
      </label>
      {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button disabled={busy} className="min-h-11 rounded-xl bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">
        {busy?"Waiting for passkey…":"Create passkey"}
      </button>
    </form>}
  </main>;
}
