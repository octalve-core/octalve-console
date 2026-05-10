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
      <form onSubmit={handleSubmit} className="space-y-5">
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

        <div className="pt-2">
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

        <p className="pt-4 text-center text-sm font-medium text-slate-400">
          Remember your password?
        </p>

        <Link
          href="/login"
          className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#D7E3F2] bg-white text-sm font-medium text-[#0064E0] transition hover:border-[#0064E0]/40 hover:bg-[#F8FBFF]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </form>
    </AuthLayout>
  );
}