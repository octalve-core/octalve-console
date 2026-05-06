"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState(""); // Changed to support both email and username
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await login({ 
        email, 
        password 
      });
      router.push(getRoleDashboard(session.user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        // Extract specific error message from Django response if available
        const errorMessage = typeof err.payload === 'object' && err.payload !== null
          ? (err.payload as any).detail || (err.payload as any).non_field_errors?.[0] || err.message
          : err.message;
        setError(errorMessage);
      } else {
        setError("Unable to log in. Please confirm your backend is running and your details are correct.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid" onSubmit={handleSubmit}>
      <label className="form-field">
        <span className="form-label">Email Address</span> {/* Updated label */}
        <input
          className="input"
          type="text" // Changed from "email" to "text" to accept username
          placeholder="example@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">Password</span>
        <input
          className="input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error ? (
        <div className="alert error-alert" style={{ color: 'red', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "#64748b", fontSize: 14 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" /> Remember me
        </label>
        <Link className="text-link" href="/forgot-password">Forgot password?</Link>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </Button>

      <p style={{ textAlign: "center", margin: 0, color: "#64748b" }}>
        No account? <Link className="text-link" href="/signup">Create account</Link>
      </p>
    </form>
  );
}
