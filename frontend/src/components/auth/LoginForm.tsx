"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  return (
    <form className="grid" onSubmit={(event) => { event.preventDefault(); window.localStorage.setItem("octalve-session", "demo"); router.push("/admin"); }}>
      <label className="form-field">
        <span className="form-label">Email address</span>
        <input className="input" type="email" placeholder="you@example.com" required />
      </label>
      <label className="form-field">
        <span className="form-label">Password</span>
        <input className="input" type="password" placeholder="••••••••" required />
      </label>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "#64748b", fontSize: 14 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" /> Remember me</label>
        <Link className="text-link" href="/forgot-password">Forgot password?</Link>
      </div>
      <Button type="submit">Log in</Button>
      <p style={{ textAlign: "center", margin: 0, color: "#64748b" }}>No account? <Link className="text-link" href="/signup">Create account</Link></p>
    </form>
  );
}
