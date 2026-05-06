"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setIsSubmitting(true);

    try {
      // Call the password reset endpoint
      await authApi.requestPasswordReset(email);
      setSuccess(true);
      
      // Optional: Clear form after successful submission
      setEmail("");
    } catch (err) {
      if (err instanceof ApiError) {
        // Django might return different error formats
        if (typeof err.payload === 'object' && err.payload !== null) {
          const errorDetail = (err.payload as any).detail || 
                             (err.payload as any).email?.[0] ||
                             (err.payload as any).non_field_errors?.[0];
          setError(errorDetail || err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError("Unable to send reset link. Please try again later.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell 
      title="Reset password" 
      description="Enter your email address and we'll send you a link to reset your password."
    >
      {success ? (
        <div className="success-container" style={{ textAlign: "center" }}>
          <div 
            className="alert success-alert" 
            style={{ 
              color: '#166534', 
              padding: '16px', 
              backgroundColor: '#dcfce7', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}
          >
            ✓ Password reset link sent!<br />
            <small>Check your email for the reset link (check spam folder if not in inbox).</small>
          </div>
          <Button 
            type="button" 
            onClick={() => router.push('/login')}
            variant="primary"
          >
            Back to login
          </Button>
        </div>
      ) : (
        <form className="grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-label">Email address</span>
            <input 
              className="input" 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>

          {error ? (
            <div 
              className="alert error-alert" 
              style={{ 
                color: '#991b1b', 
                padding: '10px', 
                backgroundColor: '#fee2e2', 
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}
            >
              {error}
            </div>
          ) : null}

          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
          
          <Button 
            type="button" 
            href="/login" 
            variant="secondary"
            onClick={() => router.push('/login')}
            disabled={isSubmitting}
          >
            Back to login
          </Button>
        </form>
      )}
    </AuthShell>
  );
}