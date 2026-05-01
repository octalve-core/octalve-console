"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const router = useRouter();
  return (
    <form className="grid" onSubmit={(event) => { event.preventDefault(); window.localStorage.setItem("octalve-session", "demo-client"); router.push("/client"); }}>
      <label className="form-field"><span className="form-label">Full name</span><input className="input" placeholder="Riliwan Yekini" required /></label>
      <label className="form-field"><span className="form-label">Email address</span><input className="input" type="email" placeholder="you@example.com" required /></label>
      <label className="form-field"><span className="form-label">Phone number</span><input className="input" placeholder="0813..." /></label>
      <label className="form-field"><span className="form-label">Referral code optional</span><input className="input" placeholder="OCTALVE-REF" /></label>
      <label className="form-field"><span className="form-label">Password</span><input className="input" type="password" required /></label>
      <Button type="submit">Create account</Button>
      <p style={{ textAlign: "center", margin: 0, color: "#64748b" }}>Already registered? <Link className="text-link" href="/login">Log in</Link></p>
    </form>
  );
}
