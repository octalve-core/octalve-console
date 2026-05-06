// src/components/auth/SignupForm.tsx
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    setIsSubmitting(true);

    try {
      const session = await signup({
        full_name: fullName,
        email: email,
        phone: phone || undefined,
        referral_code: referralCode || undefined,
        password: password
      });

      // Redirect based on user role
      router.push(getRoleDashboard(session.user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        // Handle Django's specific error responses
        if (typeof err.payload === 'object' && err.payload !== null) {
          const errors = err.payload as Record<string, string[]>;
          const firstError = Object.values(errors)[0]?.[0];
          setError(firstError || err.message);
        } else {
          setError(err.message);
        }
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
        <span className="form-label">Full name *</span>
        <input
          className="input"
          placeholder="Riliwan Yekini"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">Email address *</span>
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
        <span className="form-label">Phone number (optional)</span>
        <input
          className="input"
          type="tel"
          placeholder="+234 812 345 6789"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>

      <label className="form-field">
        <span className="form-label">Referral code (optional)</span>
        <input
          className="input"
          placeholder="ABC123XYZ"
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
        />
      </label>

      <label className="form-field">
        <span className="form-label">Password *</span>
        <input
          className="input"
          type="password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">Confirm password *</span>
        <input
          className="input"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </label>

      {error ? (
        <div className="alert error-alert" style={{ color: 'red', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>

      <p style={{ textAlign: "center", margin: 0, color: "#64748b" }}>
        Already registered? <Link className="text-link" href="/login">Log in</Link>
      </p>
    </form>
  );
}
