"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await signup({
        full_name: fullName,
        email,
        phone,
        referral_code: referralCode || undefined,
        password
      });

      router.push(getRoleDashboard(session.user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to create account. Please confirm your backend is running and accepting signup requests.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid" onSubmit={handleSubmit}>
      <label className="form-field">
        <span className="form-label">Full name</span>
        <input
          className="input"
          placeholder="Riliwan Yekini"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">Email address</span>
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">Phone number</span>
        <input
          className="input"
          placeholder="0813..."
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>

      <label className="form-field">
        <span className="form-label">Referral code optional</span>
        <input
          className="input"
          placeholder="OCTALVE-REF"
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
        />
      </label>

      <label className="form-field">
        <span className="form-label">Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error ? (
        <div className="alert error-alert">{error}</div>
      ) : null}

      <Button type="submit">{isSubmitting ? "Creating account..." : "Create account"}</Button>

      <p style={{ textAlign: "center", margin: 0, color: "#64748b" }}>
        Already registered? <Link className="text-link" href="/login">Log in</Link>
      </p>
    </form>
  );
}
