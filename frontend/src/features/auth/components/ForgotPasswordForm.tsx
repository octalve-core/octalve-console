"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/lib/routes";
import { authApiV2 } from "@/lib/api/modules/auth.api";
import { getAuthErrorMessage } from "../utils";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await authApiV2.requestPasswordReset(email.trim());
      setIsSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, "Unable to send reset link. Please check the email and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-700">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-emerald-900">Reset link requested</h3>
              <p className="mt-1 text-sm leading-6">
                If an account exists for this email, the backend will send password reset instructions.
              </p>
            </div>
          </div>
        </div>

        <Button href={routes.auth.login} variant="soft" size="lg" className="mt-6 w-full">
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        leftIcon={<Mail className="h-4 w-4" />}
        required
      />

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending reset link...
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Remembered your password?{" "}
        <Link href={routes.auth.login} className="font-medium text-[#0064E0] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
