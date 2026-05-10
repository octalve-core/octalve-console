"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { authApi } from "@/lib/api/endpoints";
import { parseApiValidationError } from "@/lib/api/validation";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import {
  AuthButton,
  AuthInput,
  AuthLayout,
} from "../components/AuthLayout";

export function ForgotPasswordPageClient() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsSubmitting(true);

    try {
      await authApi.requestPasswordReset(email.trim().toLowerCase());
      setNotice("If this email exists, a secure password reset link will be sent.");
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to request password reset. Please try again.",
      );
      setError(parsed.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      icon={MailCheck}
      title="Reset password"
      description="Enter your email address to receive a secure reset link."
      sideTitle="Recover your account securely."
      sideDescription="Request a secure password reset link for your Octalve Console account without exposing account information."
    >
      <form onSubmit={handleSubmit} className="auth-form-stack">
        <AuthInput
          label="Email address"
          name="email"
          type="email"
          icon={Mail}
          placeholder="you@example.com"
          value={email}
          autoComplete="email"
          required
          onChange={(event) => setEmail(event.target.value)}
        />

        {notice ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-800">
            {notice}
          </div>
        ) : null}

        <ApiFormError message={error} />

        <div className="auth-submit-zone">
          <AuthButton disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </span>
          ) : (
            "Send reset link"
          )}
        </AuthButton>
        </div>

        <p className="auth-helper-text">
          Remember your password?
        </p>

        <Link
          href="/login"
          className="auth-secondary-link auth-form-footer-gap"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </form>
    </AuthLayout>
  );
}